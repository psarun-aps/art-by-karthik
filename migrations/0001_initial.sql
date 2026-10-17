PRAGMA foreign_keys = ON;

CREATE TABLE categories (
  name TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE artworks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES categories(name),
  year TEXT NOT NULL,
  image TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  artwork_id TEXT NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX comments_artwork_status ON comments(artwork_id, status, created_at);

CREATE TABLE reactions (
  artwork_id TEXT NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'heart')),
  visitor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (artwork_id, reaction, visitor_id)
);

INSERT INTO categories (name) VALUES ('Characters'), ('Places');

INSERT INTO artworks (id, title, category, year, image, description) VALUES
('01', 'Character Study', 'Characters', '2026', '/artworks/Characters/character-study.jpg', 'A collection of character sketches.'),
('02', 'Disney Castle', 'Places', '2026', '/artworks/Places/disney-castle.jpg', 'A colorful drawing of a storybook castle.'),
('03', 'Royal Duo', 'Characters', '2026', '/artworks/Characters/royal-duo.jpg', 'Two characters drawn side by side.'),
('04', 'World Friends', 'Characters', '2026', '/artworks/Characters/world-friends.jpg', 'A gathering of characters in traditional dress.'),
('05', 'Disneyland', 'Places', '2026', '/artworks/Places/disneyland.jpg', 'A detailed theme-park landmark drawing.'),
('06', 'Royal Family', 'Characters', '2026', '/artworks/Characters/royal-family.jpg', 'A group portrait of royal characters.'),
('07', 'Little Princess', 'Characters', '2026', '/artworks/Characters/little-princess.jpg', 'A finely detailed princess character.'),
('08', 'Tiny Portrait', 'Characters', '2026', '/artworks/Characters/tiny-portrait.jpg', 'A small-scale character portrait.'),
('09', 'Blue Princess', 'Characters', '2026', '/artworks/Characters/blue-princess.jpg', 'A colorful princess character in blue.'),
('10', 'Schoolgirl', 'Characters', '2026', '/artworks/Characters/schoolgirl.jpg', 'A character sketch of a schoolgirl.'),
('11', 'Blue-Haired Girl', 'Characters', '2026', '/artworks/Characters/blue-haired-girl.jpg', 'A bright portrait with blue hair.'),
('12', 'Girl Sketch', 'Characters', '2026', '/artworks/Characters/girl-sketch.jpg', 'A simple full-length character drawing.'),
('13', 'Storybook Friends', 'Characters', '2026', '/artworks/Characters/storybook-friends.jpg', 'A collection of familiar storybook characters.'),
('14', 'Magic Duo', 'Characters', '2026', '/artworks/Characters/magic-duo.jpg', 'Two characters sharing a magical moment.'),
('15', 'Moana', 'Characters', '2026', '/artworks/Characters/moana.jpg', 'A colorful character portrait of Moana.'),
('16', 'Huntrix', 'Characters', '2026', '/artworks/Characters/huntrix.jpg', 'A portrait of two members of Huntrix.'),
('17', 'Blonde Princess', 'Characters', '2026', '/artworks/Characters/blonde-princess.jpg', 'A bright princess character drawing.'),
('18', 'Alpine Town', 'Places', '2026', '/artworks/Places/alpine-town.jpg', 'A colorful town beneath a mountain range.'),
('19', 'Royal Portrait', 'Characters', '2026', '/artworks/Characters/royal-portrait.jpg', 'A detailed portrait with decorative lettering.'),
('20', 'Moscow', 'Places', '2026', '/artworks/Places/moscow.jpg', 'A colorful city scene featuring Moscow landmarks.'),
('21', 'Mario Friends', 'Characters', '2026', '/artworks/Characters/mario-friends.jpg', 'A playful drawing of Mario and friends.'),
('22', 'Amsterdam', 'Places', '2026', '/artworks/Places/amsterdam.jpg', 'A red-ink sketch of Amsterdam architecture.'),
('23', 'Big Ben', 'Places', '2026', '/artworks/Places/big-ben.jpg', 'A detailed line drawing of Big Ben.'),
('24', 'London', 'Places', '2026', '/artworks/Places/london.jpg', 'A London skyline filled with familiar landmarks.'),
('25', 'Old Town', 'Places', '2026', '/artworks/Places/old-town.jpg', 'A European town street beside the water.'),
('26', 'Cityscape', 'Places', '2026', '/artworks/Places/cityscape.jpg', 'A close-packed city skyline in pen.'),
('27', 'Riverside City', 'Places', '2026', '/artworks/Places/riverside-city.jpg', 'A city and bridge reflected along the river.'),
('28', 'London Skyline', 'Places', '2026', '/artworks/Places/london-skyline.jpg', 'A panoramic drawing of London landmarks.'),
('29', 'Canal City', 'Places', '2026', '/artworks/Places/canal-city.jpg', 'A colorful city view across a canal.'),
('30', 'Princess Sketch', 'Characters', '2026', '/artworks/Characters/princess-sketch.jpg', 'A full-length princess character sketch.'),
('31', 'Ambrostan', 'Places', '2026', '/artworks/Places/ambrostan.jpg', 'A city skyline labeled Ambrostan.'),
('32', 'Europe Square', 'Places', '2026', '/artworks/Places/europe-square.jpg', 'A square framed by European landmarks.'),
('33', 'City Panorama', 'Places', '2026', '/artworks/Places/city-panorama.jpg', 'A broad panorama of detailed city buildings.'),
('34', 'City Street', 'Places', '2026', '/artworks/Places/city-street.jpg', 'A street scene lined with tall buildings.'),
('35', 'Royal Girl', 'Characters', '2026', '/artworks/Characters/royal-girl.jpg', 'A character portrait in royal dress.'),
('36', 'Dance Duo', 'Characters', '2026', '/artworks/Characters/dance-duo.jpg', 'Two characters captured in a dance pose.'),
('37', 'Globe Friends', 'Characters', '2026', '/artworks/Characters/globe-friends.jpg', 'Characters gathered around a globe.'),
('38', 'Storybook Castle', 'Places', '2026', '/artworks/Places/storybook-castle.jpg', 'A detailed drawing of a fairytale castle.'),
('39', 'Girl With Bow', 'Characters', '2026', '/artworks/Characters/girl-with-bow.jpg', 'A fine-line portrait of a girl with a bow.'),
('40', 'Riverside Landmark', 'Places', '2026', '/artworks/Places/riverside-landmark.jpg', 'A colorful landmark scene along the water.');
