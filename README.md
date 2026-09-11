# NorthSoul — DJ site

A static, dependency-free site (plain HTML/CSS/JS). White edition of the reference portfolio:
scroll-driven landing hero, full-bleed curved 3D wall of photos + videos, About, next event + booking, 404.

**One continuous scroll:** "NorthSoul" alone → scrolling parts the two words and reveals the portrait
(the About hero forms, header fades in) → scrolling once more sends the tiles flying in to form the wall
→ the wall (the media in `assets/media`, repeated ×4) → scrolling past its end opens the Book page
(next event, then "Book the night" with Email / WhatsApp buttons, then the footer).
It all reverses: scroll up at the top of Book to return to the wall, and at the top of the wall to bring the hero back.

## Run locally

Any static server works. From this folder:

```bash
python -m http.server 5173
```

Then open <http://localhost:5173>. (The landing hero plays once per browser session; clear session storage or open a new tab to see it again.)

## Structure

```
index.html      shell + all views (hero/archive, about, book, 404) + footer
404.html        redirect used by static hosts for unknown paths
css/style.css   theme, layout, responsive rules
js/data.js      ← ALL CONTENT LIVES HERE (brand, links, next event, wall media)
assets/         portrait, media/ (photos + videos), posters/ (video stills)
tools/          posters.py — makes a poster still for every video
js/app.js       wall engine, landing hero, scroll flow, router
```

## Editing content — `js/data.js`

**`NS.CONFIG`**

| key | what it does |
| --- | --- |
| `nameParts` | the two big serif words (`['North','Soul']`) |
| `tagline` | "DJ + producer" — header + landing hero |
| `aboutSubtitle`, `aboutImage` | About hero (also the landing hero) |
| `bookingEmail`, `whatsapp`, `instagram` | the Email / WhatsApp buttons, About contact list, header + footer icon |
| `nextEvent` | title, city, ISO `date` (`''` while unannounced), note, banner image, optional `link` |
| `filters` | wall filter buttons: `All`, `Photos`, `Videos` are built in, other names match `tags` |

**`NS.MEDIA`** — the wall. One entry per tile, in wall order (the list is shown 4× to fill the wall;
change `WALL_REPEAT` in `js/app.js` to repeat more or less):

```js
photo('06', 'BOLD.', 2025, ['BOLD.'])          // assets/media/photo-06.jpg
video('01', 'BOLD.', null, ['BOLD.'])          // assets/media/video-01.mp4 + assets/posters/video-01.jpg
```

- Tiles are grayscale. Hover a photo → colour; hover a video → colour + it plays (muted, looping).
  On touch screens a tap does the same. There are no detail pages.
- `year` is optional; `tags` feed the filter row.

### Adding media

1. Drop photos into `assets/media/` (any size; tiles crop to 16:10) and add a `photo(...)` line.
2. Drop clips into `assets/media/` and add a `video(...)` line. Each video needs a poster still in `assets/posters/`
   with the same number — generate them all with:

```bash
python tools/posters.py
```

## Booking

No form: the Book page offers **Email** (`mailto:` with a subject) and **WhatsApp** (`wa.me` link with a prefilled
message). Set `bookingEmail` and `whatsapp` in `NS.CONFIG`.

## Deploying

Static hosting: Netlify, Vercel, GitHub Pages, Cloudflare Pages — upload the folder as-is.
Routes are hash-based (`/#/about`, `/#/event/red-room`) so no server config is needed.
`404.html` assumes the site is served from the domain root; if it lives in a sub-folder, change `'/#/404'` inside it to that folder.

## Controls (archive)

- Scroll / trackpad — move the wall; keep going past the top or bottom to change section
- Drag — shift the wall (with inertia and tilt); drag past an edge and release to change section
- Arrow keys / Page Up-Down — step by one tile
- Hover — full colour + title · year
- Click — open the event
