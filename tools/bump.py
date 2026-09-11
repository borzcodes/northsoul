"""Bump the ?v= cache-buster on css/js links in index.html (run after editing css or js)."""
import re, time, os
p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'index.html')
s = open(p, encoding='utf-8').read()
v = str(int(time.time()))
s = re.sub(r'(\.(?:css|js))\?v=\d+', r'\1?v=' + v, s)
open(p, 'w', encoding='utf-8').write(s)
print('cache-buster set to', v)
