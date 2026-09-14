# NorthSoul — DJ site

A static, dependency-free site (plain HTML/CSS/JS). White edition of the reference portfolio:
scroll-driven landing hero, a dark About chapter on two clips, a vertical 3D "stack" of photos + clips with a player, next event + booking, 404.

**One continuous scroll:** "NorthSoul" alone → scrolling parts the two words and reveals the portrait
(header fades in) → scrolling once more fades in the **About** chapter: an index of four rows on the right —
Story · Sound · Stages · Contact, set in Archivo — with a cream bar that slides to the row you hover, scroll or tap; the panel on the left answers each one
(who he is, what he plays, where he has played, how to get in touch) and the two clips behind
(`assets/media/video-17.mp4`, `video-05.mp4`) switch with a dip to black → past the last word the cards fly in to form the stack
→ the stack: one card faces you, the previous ones lie flattened above, the next waits below and rolls up as
you scroll (videos play muted in place; click / tap the facing card to open it in the player) → past the last card, the Book page:
a **Trusted by** strip of venue logos, then
(a pinned three-step story — Next event · Book the night · Get in touch — with a wheel of photos that turns per step, then the footer).
It all reverses: scroll up at the top of Book to return to the last card, past the first card to bring the About chapter back
(on its last word), and past its first word to bring the hero back. The logo always returns to the title; **About** in the header
jumps to the chapter from anywhere.

## Run locally

Any static server works. From this folder:

```bash
python -m http.server 5173
```

Then open <http://localhost:5173>. The landing hero plays on every load. After editing `css/style.css` or `js/app.js`
run `python tools/bump.py` so browsers pick up the new files (it refreshes the `?v=` on the links in `index.html`).

## Structure

```
index.html      shell: hero, About chapter (its copy lives here), archive chrome, player, Book + 404 views, footer
404.html        redirect used by static hosts for unknown paths
css/style.css   theme, layout, responsive rules
js/data.js      ← ALL CONTENT LIVES HERE (brand, links, next event, wall media)
assets/         portrait, media/ (photos + videos), tiles/ (640x400 stills: colour + baked grayscale)
tools/          tiles.py — builds the stills; bump.py — refreshes the cache-buster on css/js links
js/app.js       stack engine + player, landing hero, scroll flow, router
```

## Editing content — `js/data.js`

**`NS.CONFIG`**

| key | what it does |
| --- | --- |
| `nameParts` | the two big serif words (`['North','Soul']`) |
| `tagline` | "DJ + producer" — header + landing hero |
| `aboutSubtitle`, `aboutImage` | the line and the portrait in the landing hero |
| `bookingEmail`, `whatsapp`, `instagram` | the Email / WhatsApp / Instagram rows (About chapter + Book), header + footer icon |
| `highlights` | how many of the first `NS.MEDIA` entries the stack opens with; "More" (top-right) brings in the rest |
| `nextEvent` | title, city, ISO `date` (`''` while unannounced), note, banner image, optional `link` |

**`NS.VENUES`** — the "Trusted by" strip: `{ name, city, logo }`. `logo` is an ink cut-out PNG (transparent, black) in
`assets/logos/`; leave it out and the name is set in type instead. The strip loops slowly and pauses on hover.

**`NS.MEDIA`** — the stack, in order (top to bottom). The first `highlights` entries are what visitors see first — keep those to performance shots (posters and portraits belong elsewhere):

```js
photo('06', 'BOLD.', 2025)          // assets/media/photo-06.jpg  → tiles/photo-06.jpg
video('01', 'BOLD.')                // assets/media/video-01.mp4  → tiles/video-01.jpg (poster)
video('05', 'Late set', null, 5)    // 4th arg = second the still was taken at (tools/tiles.py prints it)
video('16', 'Flags up', null, 1, 82)   // 5th arg = focus: % from the top the card centres on (50 = middle; the DJ is low in booth shots)
```

- One card faces you at a time; scroll, drag, arrow keys or click another card to move. Videos play muted
  in place when they reach the front. Clicking / tapping the facing card opens the **player**: blurred backdrop,
  Back, title, type · duration, play / pause (space bar), a progress line, and the Instagram link.
- `year` is optional. Bottom-left shows the current title + type, bottom-right the counter, top-right two thumbnails.
- Phones: same stack with wider cards; drag to move, tap the facing card to open.

### Adding media

1. Drop photos / clips into `assets/media/` (any size) and add a `photo(...)` / `video(...)` line.
2. Build the card stills (640×400, cropped around each clip's `focus`) — the stack only ever loads these, never the originals:

```bash
python tools/tiles.py
```

3. After editing `css/` or `js/`, run `python tools/bump.py` so browsers pick up the new files instead of cached ones.

## Booking

No form: the Book page offers **Email** (`mailto:` with a subject) and **WhatsApp** (`wa.me` link with a prefilled
message). Set `bookingEmail` and `whatsapp` in `NS.CONFIG`.

## Deploying

Static hosting: Netlify, Vercel, GitHub Pages, Cloudflare Pages — upload the folder as-is.
Routes are hash-based (`/#/`, `/#/book/night`; `/#/about` jumps to the chapter) so no server config is needed.
`404.html` assumes the site is served from the domain root; if it lives in a sub-folder, change `'/#/404'` inside it to that folder.

## Controls (archive)

- About chapter — hover a word (desktop) or tap it; scroll / arrow keys step one word at a time; keep pushing at the
  first or last word to leave. The text of the four answers is plain HTML in `index.html` (`.about__panel`).
- Scroll / trackpad / drag — move through the cards (snaps to the nearest); keep going past the first or last card to change section
- Arrow keys / Page Up-Down — one card at a time
- Click / tap the facing card — open it in the player (Esc or Back to close, space to play / pause)
