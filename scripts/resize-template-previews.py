from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
out=Path('public/templates/previews');out.mkdir(parents=True,exist_ok=True)
colors={'cybercore':'#0b0910','punk-zine':'#c8c1ac','old-web':'#16114c','minimal-brutalism':'#f0efea','music-artist':'#131020','photographer':'#e9e5dd','gaming-profile':'#0c1619','blank-canvas':'#0d0d0f'}
contact=Image.new('RGB',(1280,540),'#17151b')
for i,(name,color) in enumerate(colors.items()):
 im=Image.open('/tmp/zin-template-captures/'+name+'.png').convert('RGB');im=ImageOps.contain(im,(640,480),Image.Resampling.LANCZOS);bg=Image.new('RGB',(640,480),color);bg.paste(im,((640-im.width)//2,(480-im.height)//2));bg.save(out/(name+'.png'),optimize=True)
 thumb=bg.resize((320,240));contact.paste(thumb,((i%4)*320,(i//4)*270));ImageDraw.Draw(contact).text(((i%4)*320+8,(i//4)*270+244),name,fill='white')
contact.save('/tmp/zin-template-contact.png')
