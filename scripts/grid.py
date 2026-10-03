import sys
from PIL import Image

# Hoja de contactos en rejilla: python3 scripts/grid.py salida.png <columnas> img1 img2 ...
out = sys.argv[1]
cols = int(sys.argv[2])
ims = [Image.open(f).convert('RGB') for f in sys.argv[3:]]
w = max(i.width for i in ims)
h = max(i.height for i in ims)
scale = 0.5  # las capturas van a DPR 2; la hoja a la mitad para que pese poco
cw, ch = int(w * scale), int(h * scale)
rows = (len(ims) + cols - 1) // cols
o = Image.new('RGB', (cw * cols, ch * rows), 'white')
for k, im in enumerate(ims):
    o.paste(im.resize((cw, ch)), ((k % cols) * cw, (k // cols) * ch))
o.save(out, quality=85, optimize=True) if out.endswith('.jpg') else o.save(out, optimize=True)
