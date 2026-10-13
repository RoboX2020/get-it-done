#!/bin/sh
# Copies fonts and builds the home-screen icons from the extension folder. Run once before deploy.
set -e
cd "$(dirname "$0")"
mkdir -p public/fonts public/icons
cp ../extension/fonts/outfit-400.woff2 ../extension/fonts/outfit-500.woff2 ../extension/fonts/outfit-600.woff2 ../extension/fonts/fraunces-600.woff2 public/fonts/
python3 - <<'PY'
from PIL import Image
im = Image.open("../extension/icons/icon128.png").convert("RGBA")
for name, s in (("icon192", 192), ("icon512", 512), ("apple-touch-icon", 180)):
    im.resize((s, s), Image.LANCZOS).save(f"public/icons/{name}.png")
PY
