"""Build the wall stills at 640x400 (16:10, centre crop) for every photo-NN.jpg
and video-NN.mp4 in assets/media (plus the portrait):
  assets/tiles/<name>.jpg     colour (shown on hover / touch)
  assets/tiles/<name>.g.jpg   grayscale, faded into the cream ground (resting look)
Baking the resting look into the file means the browser never runs a filter
while rasterising a card — that is what keeps scrolling hitch-free.

Requires: pip install opencv-python-headless
Run after adding media:  python tools/tiles.py
"""
import cv2, glob, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, 'assets', 'media')
OUT = os.path.join(ROOT, 'assets', 'tiles')
W, H = 640, 400
os.makedirs(OUT, exist_ok=True)


def crop_16_10(frame):
    h, w = frame.shape[:2]
    target = W / H
    if w / h > target:      # too wide → trim sides
        nw = int(h * target); x0 = (w - nw) // 2
        frame = frame[:, x0:x0 + nw]
    else:                   # too tall → trim top/bottom
        nh = int(w / target); y0 = (h - nh) // 2
        frame = frame[y0:y0 + nh, :]
    return cv2.resize(frame, (W, H), interpolation=cv2.INTER_AREA)


CREAM = (228, 232, 233)   # BGR of the page ground (slightly darkened, as the tile backdrop is)


def save(name, frame):
    tile = crop_16_10(frame)
    cv2.imwrite(os.path.join(OUT, name + '.jpg'), tile, [cv2.IMWRITE_JPEG_QUALITY, 82])
    gray = cv2.cvtColor(tile, cv2.COLOR_BGR2GRAY)
    gray = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR).astype('float32')
    cream = np.array(CREAM, dtype='float32').reshape(1, 1, 3)
    faded = gray * 0.55 + cream * 0.45
    cv2.imwrite(os.path.join(OUT, name + '.g.jpg'), faded.clip(0, 255).astype('uint8'), [cv2.IMWRITE_JPEG_QUALITY, 80])
    print('tile', name)


# photos (+ the portrait)
for path in sorted(glob.glob(os.path.join(MEDIA, 'photo-*.jpg'))) + [os.path.join(ROOT, 'assets', 'portrait.jpg')]:
    name = os.path.splitext(os.path.basename(path))[0]
    if os.path.exists(os.path.join(OUT, name + '.jpg')):
        continue
    im = cv2.imread(path)
    if im is not None:
        save(name, im)

# videos: brightest of a few early frames (skips fade-ins from black);
# prints the second it used so you can pass it as `posterAt` in data.js
for path in sorted(glob.glob(os.path.join(MEDIA, 'video-*.mp4'))):
    name = os.path.splitext(os.path.basename(path))[0]
    if os.path.exists(os.path.join(OUT, name + '.jpg')):
        continue
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    best = None
    for t in (1.0, 2.0, 3.0, 5.0, 8.0):
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(n - 1, int(fps * t)))
        ok, frame = cap.read()
        if ok and (best is None or frame.mean() > best[0]):
            best = (frame.mean(), t, frame)
        if best and best[0] > 40:   # bright enough: keep the earliest good one
            break
    if best is None:
        print('skip', name); continue
    save(name, best[2])
    if best[1] != 1.0:
        print(f'   -> {name}: still taken at {best[1]}s - set posterAt={best[1]} in data.js')
