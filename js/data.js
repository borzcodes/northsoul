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
   photo(nn, title, year?)  ·  video(nn, title, year?, posterAt = second the still was taken at)
   Tiles are grayscale; photos turn colour on hover/touch, videos turn
   colour and play. Stills come from assets/tiles (run tools/tiles.py
   after adding media). The list repeats (WALL_REPEAT in app.js).
   ============================================================ */
const photo = (n, title, year) =>
  ({ kind: 'photo', src: `assets/tiles/photo-${n}.jpg`, title, year });
const video = (n, title, year, posterAt = 1) =>
  ({ kind: 'video', src: `assets/tiles/video-${n}.jpg`, video: `assets/media/video-${n}.mp4`, title, year, posterAt });

NS.MEDIA = [
  photo('06', 'BOLD.'),
  video('01', 'BOLD.'),
  photo('01', 'Toy Room Club, Madrid', 2023),
  video('06', 'Peak time'),
  photo('03', 'The red room'),
  video('02', 'Una Más', null, 2),
  photo('07', 'BOLD.'),
  video('09', 'Hands up'),
  photo('04', 'Red haze'),
  video('15', 'Lasers'),
  { kind: 'photo', src: 'assets/tiles/portrait.jpg', title: 'NorthSoul', year: null },
  video('03', 'BOLD.', null, 3),
  photo('02', 'After midnight'),
  video('16', 'Flags up'),
  photo('08', 'BOLD., from above'),
  video('17', 'NorthSoul', null, 2),
  photo('05', 'Booth check'),
  video('13', 'BOLD.'),
  video('04', 'The red room'),
  video('22', 'The red room'),
  video('07', 'Lights'),
  video('08', 'Back to back'),
  video('10', 'Red ceiling'),
  video('11', 'Strobe'),
  video('12', 'Crowd'),
  video('14', 'Backstage', null, 8),
  video('18', 'Hands up'),
  video('19', 'Una Más', null, 2),
  video('20', 'On the decks', null, 2),
  video('21', 'Front row', null, 2),
  video('05', 'Late set', null, 5),
];
