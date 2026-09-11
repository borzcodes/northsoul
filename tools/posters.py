"""Make a poster still (assets/posters/video-NN.jpg) for every video in assets/media.
Picks the brightest of a few early frames so dark fade-ins are skipped.
Requires: pip install opencv-python-headless
"""
import cv2, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, 'assets', 'media')
OUT = os.path.join(ROOT, 'assets', 'posters')
os.makedirs(OUT, exist_ok=True)

for path in sorted(glob.glob(os.path.join(MEDIA, '*.mp4'))):
    name = os.path.splitext(os.path.basename(path))[0]
    dst = os.path.join(OUT, name + '.jpg')
    if os.path.exists(dst):
        continue
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    best = None
    for t in (1.0, 2.0, 3.0, 5.0, 8.0):
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(n - 1, int(fps * t)))
        ok, frame = cap.read()
        if ok and (best is None or frame.mean() > best[0]):
            best = (frame.mean(), frame)
    if best is None:
        print('skip', name); continue
    frame = best[1]
    h, w = frame.shape[:2]
    s = 900 / max(w, h)
    cv2.imwrite(dst, cv2.resize(frame, (int(w * s), int(h * s))), [cv2.IMWRITE_JPEG_QUALITY, 82])
    print('poster', name)
