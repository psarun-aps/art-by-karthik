interface D1Result<T = unknown> {
  results?: T[];
  meta?: { changes?: number };
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(sql: string): D1Statement;
}

interface R2ObjectBody {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ArrayBuffer, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
}

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Database;
  ARTWORKS: R2Bucket;
  ADMIN_EMAILS: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  TURNSTILE_SECRET_KEY?: string;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const emailRecipient = 'artistkarthik23@gmail.com';
const maxImageBytes = 15 * 1024 * 1024;
const maxJsonBytes = 16 * 1024;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function required(value: string | undefined, name: string): string {
  if (!value || value.startsWith('REPLACE_WITH_')) {
    throw new HttpError(503, `Service configuration is incomplete: ${name}.`);
  }
  return value;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxJsonBytes) throw new HttpError(413, 'Request is too large.');
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Send a JSON request.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'A JSON request body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    let result: ReadableStreamReadResult<Uint8Array>;
    try {
      result = await reader.read();
    } catch {
      throw new HttpError(400, 'Could not read the request body.');
    }
    if (result.done) break;
    size += result.value.byteLength;
    if (size > maxJsonBytes) {
      await reader.cancel();
      throw new HttpError(413, 'Request is too large.');
    }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new HttpError(400, 'Invalid JSON request.');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'A JSON object is required.');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw new HttpError(400, `${label} is required.`);
  const result = value.trim();
  if (!result || result.length > max) throw new HttpError(400, `${label} must be between 1 and ${max} characters.`);
  return result;
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function base64UrlToJson(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as Record<string, unknown>;
}

async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return false;
  const team = required(env.ACCESS_TEAM_DOMAIN, 'ACCESS_TEAM_DOMAIN').replace(/^https:\/\//, '').replace(/\/$/, '');
  const audience = required(env.ACCESS_AUD, 'ACCESS_AUD');
  const adminEmails = required(env.ADMIN_EMAILS, 'ADMIN_EMAILS')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

  const parts = token.split('.');
  if (parts.length !== 3) return false;
  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  try {
    header = base64UrlToJson(parts[0]);
    claims = base64UrlToJson(parts[1]);
  } catch {
    return false;
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false;
  if (claims.iss !== `https://${team}`) return false;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) return false;
  if (typeof claims.exp !== 'number' || claims.exp <= Date.now() / 1000) return false;
  if (typeof claims.nbf === 'number' && claims.nbf > Date.now() / 1000) return false;
  if (typeof claims.email !== 'string' || !adminEmails.includes(claims.email.toLowerCase())) return false;

  let jwksResponse: Response;
  try {
    jwksResponse = await fetch(`https://${team}/cdn-cgi/access/certs`);
  } catch {
    throw new HttpError(503, 'Could not verify the admin sign-in. Try again shortly.');
  }
  if (!jwksResponse.ok) throw new HttpError(503, 'Could not verify the admin sign-in. Try again shortly.');
  let jwks: { keys?: JsonWebKey[] };
  try {
    jwks = await jwksResponse.json() as { keys?: JsonWebKey[] };
  } catch {
    throw new HttpError(503, 'Could not verify the admin sign-in. Try again shortly.');
  }
  const jwk = jwks.keys?.find(key => (key as JsonWebKey & { kid?: string }).kid === header.kid);
  if (!jwk) return false;
  try {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      new Uint8Array(base64UrlToBytes(parts[2])),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return false;
  }
}

async function requireAdmin(request: Request, env: Env): Promise<void> {
  if (!await isAdmin(request, env)) throw new HttpError(403, 'Admin access is required.');
}

async function verifyTurnstile(request: Request, token: unknown, env: Env): Promise<void> {
  const secret = required(env.TURNSTILE_SECRET_KEY, 'TURNSTILE_SECRET_KEY');
  if (typeof token !== 'string' || !token || token.length > 2048) {
    throw new HttpError(400, 'Complete the security check and try again.');
  }
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  const remoteIp = request.headers.get('CF-Connecting-IP');
  if (remoteIp) form.set('remoteip', remoteIp);
  let response: Response;
  try {
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
  } catch {
    throw new HttpError(503, 'Could not contact the security check. Try again shortly.');
  }
  if (!response.ok) throw new HttpError(503, 'Could not verify the security check. Try again shortly.');
  let result: { success?: boolean; hostname?: string };
  try {
    result = await response.json() as { success?: boolean; hostname?: string };
  } catch {
    throw new HttpError(503, 'Could not verify the security check. Try again shortly.');
  }
  if (!result.success || result.hostname !== new URL(request.url).hostname) {
    throw new HttpError(400, 'The security check expired. Please try again.');
  }
}

async function sendEmail(subject: string, message: string, env: Env): Promise<void> {
  const apiKey = required(env.RESEND_API_KEY, 'RESEND_API_KEY');
  const from = required(env.RESEND_FROM_EMAIL, 'RESEND_FROM_EMAIL');
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [emailRecipient], subject, text: message }),
    });
  } catch {
    throw new HttpError(502, 'Email could not be delivered right now. Please try again later.');
  }
  if (!response.ok) {
    console.error('Resend rejected email delivery:', response.status, await response.text());
    throw new HttpError(502, 'Your message could not be delivered right now. Please try again later.');
  }
}

async function getArtworks(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT a.id, a.title, a.category, a.year, a.image, a.description,
      (SELECT COUNT(*) FROM reactions r WHERE r.artwork_id = a.id AND r.reaction = 'like') AS likes,
      (SELECT COUNT(*) FROM reactions r WHERE r.artwork_id = a.id AND r.reaction = 'heart') AS hearts,
      (SELECT COUNT(*) FROM comments c WHERE c.artwork_id = a.id AND c.status = 'approved') AS comments
     FROM artworks a ORDER BY a.created_at DESC, a.id`,
  ).all();
  return json({ artworks: result.results || [] });
}

async function handleComments(request: Request, artworkId: string, env: Env): Promise<Response> {
  if (request.method === 'GET') {
    const result = await env.DB.prepare(
      'SELECT id, name, message, created_at AS createdAt FROM comments WHERE artwork_id = ? AND status = ? ORDER BY created_at DESC',
    ).bind(artworkId, 'approved').all();
    return json({ comments: result.results || [] });
  }
  if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
  const body = await readJson(request);
  const name = text(body.name, 'Name', 80);
  const message = text(body.message, 'Comment', 1000);
  await verifyTurnstile(request, body.turnstileToken, env);
  const artwork = await env.DB.prepare('SELECT title FROM artworks WHERE id = ?').bind(artworkId).first<{ title: string }>();
  if (!artwork) throw new HttpError(404, 'Artwork not found.');
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO comments (id, artwork_id, name, message) VALUES (?, ?, ?, ?)')
    .bind(id, artworkId, name, message).run();
  try {
    await sendEmail(
      `New artwork comment: ${artwork.title}`,
      `A comment is waiting for approval.\n\nArtwork: ${artwork.title}\nName: ${name}\nComment: ${message}\n\nReview it in the admin page.`,
      env,
    );
  } catch (error) {
    console.error('Comment was saved, but its email notification failed:', id, error);
    return json({
      message: 'Your comment was saved for approval, but the artist could not be notified by email. Please contact the site owner.',
    }, 202);
  }
  return json({ message: 'Your comment was sent for approval.' }, 201);
}

async function handleReactions(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
  const body = await readJson(request);
  const artworkId = text(body.artworkId, 'Artwork', 80);
  const visitorId = text(body.visitorId, 'Visitor ID', 80);
  if (body.reaction !== 'like' && body.reaction !== 'heart') throw new HttpError(400, 'Unsupported reaction.');
  if (typeof body.active !== 'boolean') throw new HttpError(400, 'Reaction state is required.');
  if (body.active) {
    await env.DB.prepare('INSERT OR IGNORE INTO reactions (artwork_id, reaction, visitor_id) VALUES (?, ?, ?)')
      .bind(artworkId, body.reaction, visitorId).run();
  } else {
    await env.DB.prepare('DELETE FROM reactions WHERE artwork_id = ? AND reaction = ? AND visitor_id = ?')
      .bind(artworkId, body.reaction, visitorId).run();
  }
  const counts = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM reactions WHERE artwork_id = ? AND reaction = 'like') AS likes,
      (SELECT COUNT(*) FROM reactions WHERE artwork_id = ? AND reaction = 'heart') AS hearts`,
  ).bind(artworkId, artworkId).first<{ likes: number; hearts: number }>();
  return json(counts);
}

function safeFileName(value: unknown): string {
  const name = text(value, 'File name', 80).replace(/\.[^.]+$/, '');
  const slug = name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) throw new HttpError(400, 'Choose a file name containing letters or numbers.');
  return slug;
}

async function uploadArtwork(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxImageBytes + 256 * 1024) throw new HttpError(413, 'Image uploads are limited to 15 MB.');
  const form = await request.formData();
  const file = form.get('image');
  if (!(file instanceof File) || !file.size || file.size > maxImageBytes) {
    throw new HttpError(400, 'Choose an image smaller than 15 MB.');
  }
  const title = text(form.get('title'), 'Artwork title', 120);
  const category = text(form.get('category'), 'Category', 60);
  const description = typeof form.get('description') === 'string' ? String(form.get('description')).trim().slice(0, 500) : '';
  const filename = safeFileName(form.get('filename'));
  const bytes = await file.arrayBuffer();
  const view = new Uint8Array(bytes);
  let extension: string;
  let contentType: string;
  if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) {
    extension = 'jpg';
    contentType = 'image/jpeg';
  } else if (view.length >= 8 && view.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10') {
    extension = 'png';
    contentType = 'image/png';
  } else if (view.length >= 12 && new TextDecoder().decode(view.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(view.slice(8, 12)) === 'WEBP') {
    extension = 'webp';
    contentType = 'image/webp';
  } else {
    throw new HttpError(400, 'Use a valid JPEG, PNG, or WebP image.');
  }
  const id = crypto.randomUUID();
  const key = `artworks/${id}/${filename}.${extension}`;
  await env.ARTWORKS.put(key, bytes, { httpMetadata: { contentType } });
  try {
    await env.DB.prepare('INSERT INTO categories (name) VALUES (?) ON CONFLICT(name) DO NOTHING')
      .bind(category).run();
    await env.DB.prepare(
      'INSERT INTO artworks (id, title, category, year, image, description) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(id, title, category, String(new Date().getFullYear()), `/media/${key}?watermarked=1`, description).run();
  } catch (error) {
    try {
      await env.ARTWORKS.delete(key);
    } catch (cleanupError) {
      console.error('Could not remove an incomplete artwork upload:', key, cleanupError);
    }
    throw error;
  }
  return json({ id, title }, 201);
}

async function adminApi(request: Request, url: URL, env: Env): Promise<Response> {
  if (url.pathname === '/api/admin/session') {
    if (request.method !== 'GET') throw new HttpError(405, 'Method not allowed.');
    const authorized = await isAdmin(request, env);
    return json({ authorized });
  }
  await requireAdmin(request, env);
  if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) {
    throw new HttpError(403, 'Cross-origin admin requests are not allowed.');
  }
  if (url.pathname === '/api/admin/categories' && request.method === 'GET') {
    const categories = await env.DB.prepare('SELECT name FROM categories ORDER BY name').all<{ name: string }>();
    return json({ categories: (categories.results || []).map(item => item.name) });
  }
  if (url.pathname === '/api/admin/artworks' && request.method === 'POST') {
    return uploadArtwork(request, env);
  }
  if (url.pathname === '/api/admin/comments' && request.method === 'GET') {
    const comments = await env.DB.prepare(
      `SELECT c.id, c.name, c.message, c.created_at AS createdAt, a.title AS artworkTitle
       FROM comments c JOIN artworks a ON a.id = c.artwork_id
       WHERE c.status = 'pending' ORDER BY c.created_at ASC`,
    ).all();
    return json({ comments: comments.results || [] });
  }
  const commentMatch = url.pathname.match(/^\/api\/admin\/comments\/([a-f0-9-]+)$/i);
  if (commentMatch && request.method === 'POST') {
    const body = await readJson(request);
    if (body.status !== 'approved' && body.status !== 'rejected') {
      throw new HttpError(400, 'Choose approved or rejected.');
    }
    const result = await env.DB.prepare('UPDATE comments SET status = ? WHERE id = ? AND status = ?')
      .bind(body.status, commentMatch[1], 'pending').run();
    if (!result.meta?.changes) throw new HttpError(404, 'Pending comment not found.');
    return json({ status: body.status });
  }
  throw new HttpError(404, 'Admin endpoint not found.');
}

async function handleApi(request: Request, url: URL, env: Env): Promise<Response> {
  if (url.pathname === '/api/artworks' && request.method === 'GET') return getArtworks(env);
  if (url.pathname === '/api/reactions') return handleReactions(request, env);
  if (url.pathname === '/api/contact' && request.method === 'POST') {
    const body = await readJson(request);
    const name = text(body.name, 'Name', 80);
    const message = text(body.message, 'Message', 2000);
    await verifyTurnstile(request, body.turnstileToken, env);
    await sendEmail('Website message', `Name: ${name}\n\n${message}`, env);
    return json({ message: 'Your message was sent. Thank you!' }, 201);
  }
  const commentMatch = url.pathname.match(/^\/api\/artworks\/([^/]+)\/comments$/);
  if (commentMatch) return handleComments(request, decodeURIComponent(commentMatch[1]), env);
  if (url.pathname.startsWith('/api/admin/')) return adminApi(request, url, env);
  throw new HttpError(404, 'API endpoint not found.');
}

async function fetchHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    try {
      return await handleApi(request, url, env);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error('Unhandled API error:', error);
      return json({ error: 'The request could not be completed. Please try again later.' }, 500);
    }
  }
  if (url.pathname.startsWith('/media/')) {
    const key = url.pathname.slice('/media/'.length);
    if (!key || key.includes('..') || key.includes('\\')) return new Response('Not found', { status: 404 });
    let object: R2ObjectBody | null;
    try {
      object = await env.ARTWORKS.get(key);
    } catch (error) {
      console.error('Could not read an artwork image from R2:', key, error);
      return new Response('Artwork image is temporarily unavailable.', { status: 503 });
    }
    if (!object) return new Response('Not found', { status: 404 });
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
    try {
      await requireAdmin(request, env);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (!(error instanceof HttpError)) console.error('Could not verify admin page access:', error);
      return new Response(status === 503 ? 'Admin sign-in is temporarily unavailable.' : 'Admin access is required.', { status });
    }
  }
  return env.ASSETS.fetch(request);
}

export default { fetch: fetchHandler };
