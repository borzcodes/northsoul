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
assets/         portrait, media/ (photos + videos), tiles/ (640x400 stills: colour + baked grayscale)
tools/          tiles.py — builds the stills; bump.py — refreshes the cache-buster on css/js links
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

**`NS.MEDIA`** — the wall. One entry per tile, in wall order (the list is shown 4× to fill the wall;
change `WALL_REPEAT` in `js/app.js` to repeat more or less):

```js
photo('06', 'BOLD.', 2025)          // assets/media/photo-06.jpg
video('01', 'BOLD.')                // assets/media/video-01.mp4 + assets/posters/video-01.jpg
video('05', 'Late set', null, 5)    // 4th arg = second the poster still was taken at (default 1)
```

- Tiles are grayscale. Hover a photo → colour; hover a video → colour + it plays (muted, looping).
  On touch screens a tap does the same. There are no detail pages or filters.
- `year` is optional.
- Phones get the same curved wall with 3 columns. Touching a card lights it, sliding a finger across cards while scrolling lights each one as it passes, and the last one touched stays lit.
- Desktop: the card under the cursor lights the instant the cursor enters it — and the highlight follows the wall as it scrolls under a resting cursor.

### Adding media

1. Drop photos / clips into `assets/media/` (any size) and add a `photo(...)` / `video(...)` line.
2. Build the wall stills (colour + faded grayscale, 640×400) — the wall only ever loads these, never the originals:

```bash
python tools/tiles.py
```

3. After editing `css/` or `js/`, run `python tools/bump.py` so browsers pick up the new files instead of cached ones.

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
- Hover / touch — full colour + title (videos play in place); the highlight follows the cursor as the wall scrolls
