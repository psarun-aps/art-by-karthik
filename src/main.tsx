import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Link,NavLink,Route,Routes,useParams} from 'react-router-dom';
import {ArrowUpRight,ArrowLeft,Menu,X,ChevronLeft,ChevronRight,ZoomIn,ZoomOut,RotateCcw,ThumbsUp,Heart,MessageCircle,Upload,Check,Trash2} from 'lucide-react';
import {artworks as starterArtworks,categories as starterCategories,Artwork} from './data';
import {apiRequest,ApiError,turnstileSiteKey} from './api';
import './style.css';

type GalleryArtwork = Artwork & {likes:number;hearts:number;comments:number};
type Comment = {id:string;name:string;message:string;createdAt:string;artworkTitle?:string};
type GalleryState = {
  artworks:GalleryArtwork[];
  categories:string[];
  error:string;
  updateArtwork:(id:string,values:Partial<GalleryArtwork>)=>void;
  refresh:()=>Promise<void>;
};

const GalleryContext=createContext<GalleryState>({
  artworks:starterArtworks.map(art=>({...art,likes:0,hearts:0,comments:0})),
  categories:starterCategories.filter(category=>category!=='All Works'),
  error:'',
  updateArtwork:()=>{},
  refresh:async()=>{},
});

function GalleryProvider({children}:{children:React.ReactNode}){
  const [artworks,setArtworks]=useState<GalleryArtwork[]>(starterArtworks.map(art=>({...art,likes:0,hearts:0,comments:0})));
  const [categories,setCategories]=useState<string[]>(starterCategories.filter(category=>category!=='All Works'));
  const [error,setError]=useState('');
  const refresh=async()=>{
    try{
      const result=await apiRequest<{artworks:GalleryArtwork[]}>('/api/artworks');
      setArtworks(result.artworks);
      setCategories(Array.from(new Set(result.artworks.map(art=>art.category))));
      setError('');
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Could not load the artwork collection.');
    }
  };
  useEffect(()=>{void refresh()},[]);
  const updateArtwork=(id:string,values:Partial<GalleryArtwork>)=>{
    setArtworks(current=>current.map(art=>art.id===id?{...art,...values}:art));
  };
  return <GalleryContext.Provider value={{artworks,categories,error,updateArtwork,refresh}}>{children}</GalleryContext.Provider>;
}

function useGallery(){return useContext(GalleryContext)}

function Header(){
  const [open,setOpen]=useState(false);
  const [isAdmin,setIsAdmin]=useState(false);
  useEffect(()=>{
    apiRequest<{authorized:boolean}>('/api/admin/session')
      .then(session=>setIsAdmin(session.authorized))
      .catch(error=>{
        if(!(error instanceof ApiError&&error.status===403)) console.error('Could not check admin sign-in:',error);
      });
  },[]);
  const links:[string,string][]=[['/','Home'],['/gallery','Gallery'],['/about','About'],['/feedback','Feedback']];
  if(isAdmin) links.push(['/admin','Admin']);
  return <header className="site-header"><Link to="/" className="brand" onClick={()=>setOpen(false)}>ABK<span className="brand-dot">.</span></Link><button className="menu-toggle" aria-label="Toggle navigation" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button><nav className={open?'nav open':'nav'}>{links.map(([to,name])=><NavLink key={to} to={to} end={to==='/'} onClick={()=>setOpen(false)} className={({isActive})=>isActive?'active':''}>{name}</NavLink>)}</nav><span className="header-caption">A STUDY IN LINES</span></header>;
}

function Footer(){return <footer className="footer"><span>© {new Date().getFullYear()} ART BY KARTHIK ARUN</span><span>Made with care, one line at a time.</span><Link to="/feedback">SAY HELLO <ArrowUpRight size={13}/></Link></footer>}

function visitorId(){
  const key='art-by-karthik:visitor';
  try{
    let id=localStorage.getItem(key);
    if(!id){id=crypto.randomUUID();localStorage.setItem(key,id)}
    return id;
  }catch{
    return crypto.randomUUID();
  }
}

function storedReaction(artworkId:string,reaction:'like'|'heart'){
  try{return localStorage.getItem(`art-by-karthik:${artworkId}:${reaction}`)==='true'}
  catch{return false}
}

function ReactionButtons({art}:{art:GalleryArtwork}){
  const {updateArtwork}=useGallery();
  const [active,setActive]=useState<{like:boolean;heart:boolean}>(()=>({
    like:storedReaction(art.id,'like'),
    heart:storedReaction(art.id,'heart'),
  }));
  const [pending,setPending]=useState<{like:boolean;heart:boolean}>({like:false,heart:false});
  const [error,setError]=useState('');
  const change=async(reaction:'like'|'heart')=>{
    if(pending[reaction])return;
    const next=!active[reaction];
    const previous=active[reaction];
    const key=reaction==='like'?'likes':'hearts';
    setPending(current=>({...current,[reaction]:true}));
    setActive(current=>({...current,[reaction]:next}));
    updateArtwork(art.id,{[key]:Math.max(0,art[key]+(next?1:-1))});
    setError('');
    try{
      const counts=await apiRequest<{likes:number;hearts:number}>('/api/reactions',{
        method:'POST',
        body:JSON.stringify({artworkId:art.id,reaction,active:next,visitorId:visitorId()}),
      });
      localStorage.setItem(`art-by-karthik:${art.id}:${reaction}`,String(next));
      updateArtwork(art.id,counts);
    }catch(reason){
      setActive(current=>({...current,[reaction]:previous}));
      updateArtwork(art.id,{[key]:art[key]});
      setError(reason instanceof Error?reason.message:'Could not save your reaction.');
    }finally{
      setPending(current=>({...current,[reaction]:false}));
    }
  };
  return <div className="reaction-area"><div className="reaction-buttons"><button type="button" disabled={pending.like} aria-pressed={active.like} aria-label={`${active.like?'Remove like':'Like'} ${art.title}`} onClick={()=>void change('like')}><ThumbsUp size={16}/><span>{art.likes}</span></button><button type="button" disabled={pending.heart} aria-pressed={active.heart} aria-label={`${active.heart?'Remove heart':'Heart'} ${art.title}`} onClick={()=>void change('heart')}><Heart size={16}/><span>{art.hearts}</span></button></div>{error&&<p className="inline-error" role="alert">{error}</p>}</div>;
}

function ArtCard({art}:{art:GalleryArtwork}){
  return <article className="art-card"><Link className="art-image" to={'/artwork/'+art.id}><img src={art.image} alt={'Artwork: '+art.title} loading="lazy"/><span className="art-view">VIEW ARTWORK <ArrowUpRight size={14}/></span></Link><Link className="art-meta" to={'/artwork/'+art.id}><div><h3>{art.title}</h3><span>{art.category}</span></div><span>{art.year}</span></Link><div className="art-engagement"><ReactionButtons art={art}/><Link className="comment-count" to={`/artwork/${art.id}#comments`} aria-label={`${art.comments} comments on ${art.title}`} title={`${art.comments} comments`}><MessageCircle size={16}/><span>{art.comments}</span></Link></div></article>;
}

function Home(){
  const {artworks}=useGallery();
  return <><section className="hero"><div className="hero-top"><p className="eyebrow"><span className="eyebrow-line"/> THE ART OF A SINGLE STROKE</p><Link className="text-link" to="/about">MEET THE ARTIST <ArrowUpRight size={17}/></Link></div><h1>Art by <em>Karthik Arun.</em></h1><div className="hero-bottom"><p>Where imagination finds its way through ink. A collection of drawings, one line at a time.</p></div></section><section className="work-section"><div className="section-heading"><div><p className="eyebrow">01 / THE COLLECTION</p><h2>Selected works<span className="accent">.</span></h2></div><Link to="/gallery" className="text-link">VIEW ALL WORKS <ArrowUpRight size={17}/></Link></div><div className="gallery-grid">{artworks.map(art=><ArtCard key={art.id} art={art}/>)}</div><div className="gallery-bottom"><Link to="/gallery" className="outline-button">EXPLORE THE GALLERY <ArrowUpRight size={16}/></Link></div></section><section className="quote-band"><span className="eyebrow">THE PHILOSOPHY</span><p>“Every line has a story to tell.”</p><span>AN EXPLORATION OF CREATIVITY THROUGH INK</span></section></>;
}

function Gallery(){
  const {artworks,categories}=useGallery();
  const [filter,setFilter]=useState('All Works');
  const filtered=artworks.filter(art=>filter==='All Works'||art.category===filter);
  return <main className="inner-page"><p className="eyebrow">01 / EXPLORE THE COLLECTION</p><h1 className="page-title">The gallery<span className="accent">.</span></h1><p className="page-intro">A growing collection of original pen drawings, shaped by curiosity and imagination.</p><div className="filters" aria-label="Filter artwork by category">{['All Works',...categories].map(category=><button className={filter===category?'selected':''} key={category} onClick={()=>setFilter(category)}>{category}</button>)}</div><div className="gallery-grid">{filtered.map(art=><ArtCard key={art.id} art={art}/>)}</div>{!filtered.length&&<p>No artwork in this category yet.</p>}</main>;
}

function About(){return <main className="inner-page about-page"><p className="eyebrow">02 / BEHIND THE LINES</p><h1 className="page-title">Meet Karthik Arun<span className="accent">.</span></h1><div className="about-grid"><div className="about-visual"><img src="/Karthik%20Arun.JPG" alt="Karthik Arun"/></div><div className="about-copy"><span className="eyebrow">THE ARTIST & HIS IMAGINATION</span><h2>A world drawn<br/>one line at a time.</h2><p>Karthik Arun is a young artist whose imagination finds its way onto paper through drawing. He began drawing at the age of four, and art remains an important way for him to communicate and explore the world around him. He lives in Cary, North Carolina with his family and loves spending time with them. His brother, Arya, is his best friend.</p><p>His subjects and interests change over time, inspired by films, Indian culture, Hindu deities, comic characters, monuments, geography, and the wider world, including its countries, flags, and aircraft. Working on small pieces of paper with a black ballpoint pen, Karthik usually draws from memory, capturing what he sees in a single, quick sitting. His expressive line work turns simple strokes into thoughtful forms.</p><Link to="/gallery" className="text-link">EXPLORE HIS WORK <ArrowUpRight size={17}/></Link></div></div></main>}

type TurnstileApi={render:(element:HTMLElement,options:{sitekey:string;callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':()=>void})=>string;remove:(id:string)=>void};
declare global{interface Window{turnstile?:TurnstileApi}}

function TurnstileWidget({onToken}:{onToken:(token:string)=>void}){
  const element=useRef<HTMLDivElement>(null);
  const callback=useRef(onToken);
  const [error,setError]=useState('');
  useEffect(()=>{callback.current=onToken},[onToken]);
  useEffect(()=>{
    const siteKey=turnstileSiteKey();
    if(!siteKey){setError('Secure form verification is not configured yet.');return}
    let widgetId:string|undefined;
    let cancelled=false;
    const render=()=>{
      if(!cancelled&&element.current&&window.turnstile){
        try{
          widgetId=window.turnstile.render(element.current,{
            sitekey:siteKey,
            callback:token=>{setError('');callback.current(token)},
            'expired-callback':()=>{callback.current('');setError('The security check expired. Please try again.')},
            'error-callback':()=>{callback.current('');setError('The security check could not load. Refresh and try again.')},
          });
        }catch{
          setError('The security check could not start. Check its site key and refresh the page.');
        }
      }
    };
    const loadFailure=()=>setError('The security check could not load. Check your connection and refresh the page.');
    let script=document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile"]');
    if(!script){
      script=document.createElement('script');
      script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async=true;
      script.defer=true;
      document.head.appendChild(script);
    }
    script.addEventListener('load',render);
    script.addEventListener('error',loadFailure);
    if(window.turnstile) render();
    return ()=>{
      cancelled=true;
      script?.removeEventListener('load',render);
      script?.removeEventListener('error',loadFailure);
      if(widgetId) window.turnstile?.remove(widgetId);
    };
  },[]);
  return <><div ref={element}/>{error&&<p className="small-note" role="status">{error}</p>}</>;
}

function Feedback(){
  const [name,setName]=useState('');
  const [message,setMessage]=useState('');
  const [token,setToken]=useState('');
  const [challengeVersion,setChallengeVersion]=useState(0);
  const [status,setStatus]=useState('');
  const [sending,setSending]=useState(false);
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    setSending(true);setStatus('');
    try{
      const result=await apiRequest<{message:string}>('/api/contact',{method:'POST',body:JSON.stringify({name,message,turnstileToken:token})});
      setStatus(result.message);setName('');setMessage('');
    }catch(error){setStatus(error instanceof Error?error.message:'Could not send your message.')}
    finally{setToken('');setChallengeVersion(current=>current+1);setSending(false)}
  };
  return <main className="inner-page feedback-page"><p className="eyebrow">03 / LEAVE A NOTE</p><h1 className="page-title">Say hello<span className="accent">.</span></h1><p className="page-intro">Enjoyed a drawing? We'd love to hear what you think. Your encouragement means a lot.</p><div className="feedback-shell"><div><h2>Kind words inspire<br/>new creations.</h2><p>Share your thoughts, favorite artwork, or a little encouragement for the artist.</p><p className="small-note">Your message will be sent privately to the artist.</p></div><form onSubmit={submit}><label htmlFor="visitor">YOUR NAME</label><input id="visitor" value={name} onChange={event=>setName(event.target.value)} placeholder="Your name" required maxLength={80}/><label htmlFor="message">YOUR MESSAGE</label><textarea id="message" value={message} onChange={event=>setMessage(event.target.value)} rows={5} placeholder="Write a kind note..." required maxLength={2000}/><TurnstileWidget key={challengeVersion} onToken={setToken}/><button className="solid-button" type="submit" disabled={sending||!token}>{sending?'SENDING...':'SEND A MESSAGE'} <ArrowUpRight size={16}/></button>{status&&<p className="form-status" role="status">{status}</p>}</form></div></main>;
}

function CommentSection({art}:{art:GalleryArtwork}){
  const [comments,setComments]=useState<Comment[]>([]);
  const [name,setName]=useState('');
  const [message,setMessage]=useState('');
  const [token,setToken]=useState('');
  const [challengeVersion,setChallengeVersion]=useState(0);
  const [status,setStatus]=useState('');
  const [sending,setSending]=useState(false);
  useEffect(()=>{
    apiRequest<{comments:Comment[]}>(`/api/artworks/${encodeURIComponent(art.id)}/comments`)
      .then(result=>setComments(result.comments))
      .catch(error=>setStatus(error instanceof Error?error.message:'Could not load comments.'));
  },[art.id]);
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSending(true);setStatus('');
    try{
      const result=await apiRequest<{message:string}>(`/api/artworks/${encodeURIComponent(art.id)}/comments`,{
        method:'POST',body:JSON.stringify({name,message,turnstileToken:token}),
      });
      setName('');setMessage('');setStatus(result.message);
    }catch(error){setStatus(error instanceof Error?error.message:'Could not send your comment.')}
    finally{setToken('');setChallengeVersion(current=>current+1);setSending(false)}
  };
  return <section className="comments-section" id="comments"><div className="section-heading"><div><p className="eyebrow">A NOTE FOR THIS DRAWING</p><h2>Comments<span className="accent">.</span></h2></div></div><p className="small-note">Comments are reviewed before they appear publicly.</p><div className="approved-comments" aria-live="polite">{comments.map(comment=><article key={comment.id}><h3>{comment.name}</h3><p>{comment.message}</p><time>{new Date(comment.createdAt).toLocaleDateString()}</time></article>)}{comments.length===0&&<p className="small-note">No approved comments yet. Leave the first kind note.</p>}</div><form className="comment-form" onSubmit={submit}><label htmlFor="comment-name">YOUR NAME</label><input id="comment-name" value={name} onChange={event=>setName(event.target.value)} required maxLength={80} placeholder="Your name"/><label htmlFor="comment-message">YOUR COMMENT</label><textarea id="comment-message" value={message} onChange={event=>setMessage(event.target.value)} required maxLength={1000} rows={4} placeholder="Write a kind note..."/><TurnstileWidget key={challengeVersion} onToken={setToken}/><button className="solid-button" type="submit" disabled={sending||!token}>{sending?'SENDING...':'SUBMIT FOR APPROVAL'} <ArrowUpRight size={16}/></button>{status&&<p className="form-status" role="status">{status}</p>}</form></section>;
}

function ArtworkDetail(){
  const {id}=useParams();
  const {artworks}=useGallery();
  const art=artworks.find(item=>item.id===id);
  const [zoom,setZoom]=useState(1);
  useEffect(()=>{
    setZoom(1);
    if(window.location.hash==='#comments'){
      requestAnimationFrame(()=>document.getElementById('comments')?.scrollIntoView({behavior:'smooth'}));
    }else{
      window.scrollTo(0,0);
    }
  },[id]);
  if(!art)return <main className="inner-page"><h1>Artwork not found.</h1><Link to="/gallery">Back to gallery</Link></main>;
  const index=artworks.indexOf(art);
  return <main className="inner-page detail-page"><Link className="back-link" to="/gallery"><ArrowLeft size={16}/> BACK TO GALLERY</Link><div className="detail-layout"><div className="detail-image"><button className="detail-zoom-trigger" type="button" aria-label={zoom===1?'Zoom in on artwork':'Reset artwork zoom'} onClick={()=>setZoom(current=>current===1?2:1)}><img src={art.image} alt={'Artwork: '+art.title} style={{transform:`scale(${zoom})`}}/></button><div className="detail-zoom-controls" aria-label="Artwork zoom controls"><button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom<=1} onClick={()=>setZoom(current=>Math.max(1,current-0.25))}><ZoomOut size={17}/></button><span aria-live="polite">{Math.round(zoom*100)}%</span><button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom>=3} onClick={()=>setZoom(current=>Math.min(3,current+0.25))}><ZoomIn size={17}/></button><button type="button" aria-label="Reset zoom" title="Reset zoom" disabled={zoom===1} onClick={()=>setZoom(1)}><RotateCcw size={15}/></button></div></div><div className="detail-info"><p className="eyebrow">ARTWORK NO. {art.id}</p><h1>{art.title}<span className="accent">.</span></h1><p>{art.description}</p><dl><div><dt>MEDIUM</dt><dd>Pen drawing</dd></div><div><dt>CATEGORY</dt><dd>{art.category}</dd></div><div><dt>YEAR</dt><dd>{art.year}</dd></div></dl><ReactionButtons art={art}/><div className="detail-controls"><Link aria-label="Previous artwork" to={'/artwork/'+artworks[(index-1+artworks.length)%artworks.length].id}><ChevronLeft/></Link><span>{index+1} / {artworks.length}</span><Link aria-label="Next artwork" to={'/artwork/'+artworks[(index+1)%artworks.length].id}><ChevronRight/></Link></div></div></div><CommentSection art={art}/></main>;
}

function Admin(){
  const {artworks,categories,refresh}=useGallery();
  const [authorized,setAuthorized]=useState(false);
  const [checked,setChecked]=useState(false);
  const [pending,setPending]=useState<Comment[]>([]);
  const [filename,setFilename]=useState('');
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [category,setCategory]=useState(categories[0]||'');
  const [newCategory,setNewCategory]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const loadPending=async()=>{
    const result=await apiRequest<{comments:Comment[]}>('/api/admin/comments');
    setPending(result.comments);
  };
  useEffect(()=>{
    apiRequest<{authorized:boolean}>('/api/admin/session')
      .then(session=>{
        if(!session.authorized)throw new ApiError('Sign in with the authorized Cloudflare Access account to continue.',403);
        setAuthorized(true);return loadPending();
      })
      .catch(error=>setStatus(error instanceof Error?error.message:'Admin sign-in is required.'))
      .finally(()=>setChecked(true));
  },[]);
  const upload=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setBusy(true);setStatus('');
    if(!file){setStatus('Choose an image to upload.');setBusy(false);return}
    const form=new FormData();
    form.set('image',file);form.set('filename',filename);form.set('title',title);
    form.set('category',newCategory.trim()||category);form.set('description',description);
    try{
      await apiRequest('/api/admin/artworks',{method:'POST',body:form});
      void refresh();
      setFilename('');setTitle('');setDescription('');setNewCategory('');setFile(null);
      const input=document.getElementById('artwork-file') as HTMLInputElement|null;
      if(input)input.value='';
      setStatus('Artwork uploaded to the gallery.');
      try{await loadPending()}
      catch(error){setStatus(`Artwork uploaded, but the comment queue could not refresh: ${error instanceof Error?error.message:'Unknown error.'}`)}
    }catch(error){setStatus(error instanceof Error?error.message:'Could not upload the artwork.')}
    finally{setBusy(false)}
  };
  const moderate=async(id:string,next:'approved'|'rejected')=>{
    setStatus('');
    try{
      await apiRequest(`/api/admin/comments/${encodeURIComponent(id)}`,{method:'POST',body:JSON.stringify({status:next})});
      setPending(current=>current.filter(comment=>comment.id!==id));
    }catch(error){setStatus(error instanceof Error?error.message:'Could not update this comment.')}
  };
  if(!checked)return <main className="inner-page"><p>Checking admin access...</p></main>;
  if(!authorized)return <main className="inner-page"><h1>Admin access required.</h1><p className="page-intro">{status||'Sign in with the authorized Cloudflare Access account to continue.'}</p></main>;
  return <main className="inner-page admin-page"><p className="eyebrow">PRIVATE / ARTIST TOOLS</p><h1 className="page-title">Admin<span className="accent">.</span></h1>{status&&<p className="form-status" role="status">{status}</p>}<section className="admin-section"><h2>Upload a drawing</h2><form className="admin-form" onSubmit={upload}><label htmlFor="artwork-file">IMAGE (JPEG, PNG OR WEBP; MAX 15 MB)</label><input id="artwork-file" type="file" accept="image/jpeg,image/png,image/webp" required onChange={event=>{const selected=event.target.files?.[0]||null;setFile(selected);if(selected&&!filename)setFilename(selected.name.replace(/\.[^.]+$/,''))}}/><label htmlFor="file-name">FILE NAME</label><input id="file-name" value={filename} onChange={event=>setFilename(event.target.value)} required maxLength={80} placeholder="e.g. blue-bird"/><label htmlFor="artwork-title">ARTWORK TITLE</label><input id="artwork-title" value={title} onChange={event=>setTitle(event.target.value)} required maxLength={120} placeholder="The title shown in the gallery"/><label htmlFor="artwork-category">CATEGORY</label><select id="artwork-category" value={category} onChange={event=>setCategory(event.target.value)}>{categories.map(item=><option key={item} value={item}>{item}</option>)}</select><label htmlFor="new-category">OR CREATE A CATEGORY</label><input id="new-category" value={newCategory} onChange={event=>setNewCategory(event.target.value)} maxLength={60} placeholder="Leave blank to use the selected category"/><label htmlFor="artwork-description">DESCRIPTION (OPTIONAL)</label><textarea id="artwork-description" value={description} onChange={event=>setDescription(event.target.value)} maxLength={500} rows={3}/><button className="solid-button" type="submit" disabled={busy}>{busy?'UPLOADING...':'UPLOAD ARTWORK'} <Upload size={16}/></button></form></section><section className="admin-section"><h2>Comments awaiting approval <span className="accent">({pending.length})</span></h2>{pending.length===0&&<p className="small-note">No comments are waiting for approval.</p>}{pending.map(comment=><article className="moderation-card" key={comment.id}><p className="eyebrow">{comment.artworkTitle}</p><h3>{comment.name}</h3><p>{comment.message}</p><div><button type="button" className="approve-button" onClick={()=>void moderate(comment.id,'approved')}><Check size={16}/> APPROVE</button><button type="button" className="reject-button" onClick={()=>void moderate(comment.id,'rejected')}><Trash2 size={16}/> REJECT</button></div></article>)}</section><section className="admin-section"><h2>Gallery artworks <span className="accent">({artworks.length})</span></h2><ul className="admin-artwork-list">{artworks.map(art=><li key={art.id}>{art.title}<span>{art.category}</span></li>)}</ul></section></main>;
}

function App(){
  const {error}=useGallery();
  return <BrowserRouter><Header/>{error&&<div className="api-notice" role="status">Live gallery data is unavailable: {error}</div>}<Routes><Route path="/" element={<Home/>}/><Route path="/gallery" element={<Gallery/>}/><Route path="/about" element={<About/>}/><Route path="/feedback" element={<Feedback/>}/><Route path="/artwork/:id" element={<ArtworkDetail/>}/><Route path="/admin" element={<Admin/>}/><Route path="*" element={<main className="inner-page"><h1>Page not found.</h1><Link to="/">Back home</Link></main>}/></Routes><Footer/></BrowserRouter>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><GalleryProvider><App/></GalleryProvider></React.StrictMode>);
