/* ============================================================
   NorthSoul — site content
   Edit this file to change the brand, links, the next event and
   the wall. Media lives in assets/media (+ assets/posters for video
   stills).
   ============================================================ */
window.NS = window.NS || {};

NS.CONFIG = {
  brand: 'NorthSoul',
  nameParts: ['North', 'Soul'],      // big serif split left / right
  tagline: 'DJ + producer',          // under the logo & centre of the intro
  aboutSubtitle: 'Moroccan DJ, playing worldwide',
  aboutImage: 'assets/portrait.jpg',   // hero + About portrait (square works best)

  // Get in touch (Book page + About + footer)
  bookingEmail: 'booking@northsoul.dj',
  whatsapp: '+212 6 00 00 00 00',      // international format; spaces are fine
  instagram: 'https://instagram.com/northsoul',

  // Next event — shown at the top of the Book page.
  // `date` is ISO (YYYY-MM-DD); leave it '' while unannounced. `link` is optional (tickets / event page).
  // The stack opens with the first `highlights` entries of NS.MEDIA; a button reveals the rest.
  highlights: 7,

  nextEvent: {
    title: 'Toy Room Club',
    city: 'Madrid',
    date: '2026-12-29',
    note: 'Boiler Room special guest',
    banner: 'assets/media/photo-01.jpg',
    link: '',
  },

};

/* ============================================================
   THE WALL — real photos + videos (assets/media).
   photo(nn, title, year?)  ·  video(nn, title, year?, posterAt = second the still was taken at,
   focus = % from the top the card should centre on — 50 is the middle, higher looks lower, at the booth)
   Tiles are grayscale; photos turn colour on hover/touch, videos turn
   colour and play. Stills come from assets/tiles (run tools/tiles.py
   after adding media). The list repeats (WALL_REPEAT in app.js).
   ============================================================ */
const photo = (n, title, year) =>
  ({ kind: 'photo', src: `assets/tiles/photo-${n}.jpg`, title, year });
const video = (n, title, year, posterAt = 1, focus = 50) =>
  ({ kind: 'video', src: `assets/tiles/video-${n}.jpg`, video: `assets/media/video-${n}.mp4`, title, year, posterAt, focus });

NS.MEDIA = [
  // — the first `highlights` entries open the stack: performance shots only —
  photo('06', 'BOLD.'),
  video('01', 'BOLD.'),
  video('06', 'Peak time', null, 1, 66),
  photo('07', 'BOLD.'),
  video('09', 'Hands up'),
  photo('04', 'Red haze'),
  video('15', 'Lasers', null, 1, 56),
  // — the rest, behind "See all" —
  photo('03', 'The red room'),
  video('02', 'Una Más', null, 2),
  video('03', 'BOLD.', null, 3),
  photo('02', 'After midnight'),
  video('16', 'Flags up', null, 1, 82),
  photo('08', 'BOLD., from above'),
  video('17', 'NorthSoul', null, 2, 78),
  photo('05', 'Booth check'),
  video('13', 'BOLD.'),
  video('04', 'The red room', null, 1, 58),
  video('22', 'The red room', null, 1, 55),
  video('07', 'Lights', null, 1, 68),
  video('08', 'Back to back', null, 1, 64),
  video('11', 'Strobe', null, 1, 62),
  video('12', 'Crowd', null, 1, 58),
  video('14', 'Backstage', null, 8, 78),
  video('18', 'Hands up', null, 1, 56),
  video('19', 'Una Más', null, 2),
  video('20', 'On the decks', null, 2, 78),
  video('21', 'Front row', null, 2),
  video('05', 'Late set', null, 5),
];

/* ============================================================
   TRUSTED BY — rooms he has played. Shown as a moving strip after
   the highlights. `logo` is an ink cut-out PNG in assets/logos; leave
   it out to show the name set in type instead.
   ============================================================ */
NS.VENUES = [
  { name: 'Toy Room Club', city: 'Madrid', logo: 'assets/logos/toy-room.png' },
  { name: 'B-Tree', city: 'Tamuda Bay', logo: 'assets/logos/b-tree.png' },
  { name: 'Istar', city: '', logo: 'assets/logos/istar.png' },
  { name: 'La Casa Blancaise', city: 'Casablanca' },
  { name: 'Sky Bar', city: 'Casablanca', logo: 'assets/logos/sky-bar.png' },
];
