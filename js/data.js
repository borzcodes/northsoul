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

  // Archive filters. 'All', 'Photos' and 'Videos' are built in;
  // anything else matches the `tags` on the media items below.
  filters: ['All', 'Photos', 'Videos', 'BOLD.'],
};

/* ============================================================
   THE WALL — real photos + videos (assets/media).
   photo(nn, title, year?, tags?)  ·  video(nn, title, year?, tags?, posterAt = 1s)
   Tiles are grayscale; photos turn colour on hover, videos turn colour
   and play. The list is repeated (see WALL_REPEAT in app.js) to fill
   the wall, so order it the way you want it to read.
   ============================================================ */
const photo = (n, title, year, tags = []) =>
  ({ kind: 'photo', src: `assets/media/photo-${n}.jpg`, title, year, tags });
const video = (n, title, year, tags = [], posterAt = 1) =>
  ({ kind: 'video', src: `assets/posters/video-${n}.jpg`, video: `assets/media/video-${n}.mp4`, title, year, tags, posterAt });

NS.MEDIA = [
  photo('06', 'BOLD.', null, ['BOLD.']),
  video('01', 'BOLD.', null, ['BOLD.']),
  photo('01', 'Toy Room Club, Madrid', 2023),
  video('06', 'Peak time'),
  photo('03', 'The red room'),
  video('02', 'Una Más'),
  photo('07', 'BOLD.', null, ['BOLD.']),
  video('09', 'Hands up'),
  photo('04', 'Red haze'),
  video('15', 'Lasers'),
  { kind: 'photo', src: 'assets/portrait.jpg', title: 'NorthSoul', year: null, tags: [] },
  video('03', 'BOLD.', null, ['BOLD.']),
  photo('02', 'After midnight'),
  video('16', 'Flags up'),
  photo('08', 'BOLD., from above', null, ['BOLD.']),
  video('17', 'NorthSoul'),
  photo('05', 'Booth check'),
  video('13', 'BOLD.', null, ['BOLD.']),
  video('04', 'The red room'),
  video('22', 'The red room'),
  video('07', 'Lights'),
  video('08', 'Back to back'),
  video('10', 'Red ceiling'),
  video('11', 'Strobe'),
  video('12', 'Crowd'),
  video('14', 'Backstage'),
  video('18', 'Hands up'),
  video('19', 'Una Más'),
  video('20', 'On the decks'),
  video('21', 'Front row'),
  video('05', 'Late set', null, [], 5),   // poster taken at 5s (the clip fades in from black)
];
