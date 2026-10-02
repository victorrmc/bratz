import sys
from PIL import Image
out=sys.argv[1]; files=sys.argv[2:]
ims=[Image.open(f).convert('RGB') for f in files]
h=max(i.height for i in ims)
ims=[i.resize((int(i.width*h/i.height),h)) for i in ims]
o=Image.new('RGB',(sum(i.width for i in ims),h))
x=0
for i in ims: o.paste(i,(x,0)); x+=i.width
o.save(out)
