"""Original procedural ZIN artwork and synthesis. No third-party input media."""
from PIL import Image,ImageDraw,ImageFilter
import math,random,wave,struct,subprocess
from pathlib import Path
out=Path('public/templates/v1');out.mkdir(parents=True,exist_ok=True)
random.seed(7)
for name,colors in [('chrome',((17,8,27),(255,57,133))),('light',((228,216,188),(70,87,110))),('architecture',((164,181,191),(35,48,61))),('release',((18,19,44),(106,77,240)))]:
 im=Image.new('RGB',(640,480));px=im.load()
 for y in range(480):
  for x in range(640):
   t=(x+y)/1120;v=int(10*math.sin(x/70+y/80));px[x,y]=tuple(max(0,min(255,int(a*(1-t)+b*t)+v)) for a,b in zip(*colors))
 d=ImageDraw.Draw(im)
 if name=='chrome':
  for r in range(190,0,-1):
   t=r/190;v=int(120+110*math.sin(t*11));d.ellipse((320-r,240-r,320+r,240+r),fill=(v,min(255,v+10),min(255,v+20)))
  d.arc((105,80,535,400),10,330,fill='#ff397d',width=8)
 elif name=='architecture':
  for i in range(7):d.polygon([(60+i*65,60),(95+i*65,60),(245+i*50,440),(195+i*50,440)],fill=(40+i*16,50+i*16,60+i*16))
 elif name=='light':
  for r in range(150,0,-1):
   t=r/150;v=int(75+155*math.sqrt(max(0,1-t*t)));d.ellipse((280-r,230-r,280+r,230+r),fill=(v,int(v*.84),int(v*.64)))
  d.rectangle((370,280,550,410),fill='#293643')
 else:
  for i in range(10):d.ellipse((50+i*18,15+i*15,590-i*18,465-i*15),outline=(200-i*8,130+i*9,255),width=4)
 im.save(out/(name+'.webp'),quality=86)
paper=Image.new('RGB',(640,480),'#ded5bf');d=ImageDraw.Draw(paper)
for i in range(9000):
 x=random.randrange(640);y=random.randrange(480);v=random.randrange(120,240);d.point((x,y),fill=(v,v,int(v*.9)))
for y in range(20,480,28):d.line((20,y,620,y),fill='#b3a88d')
paper.save(out/'paper.webp',quality=85)
frames=[]
for i in range(16):
 im=Image.new('RGB',(220,160),'#171525');d=ImageDraw.Draw(im);r=28+int(9*math.sin(i*math.pi/8));cx=110;cy=80
 points=[(cx+math.cos(j*math.pi/8+i*.05)*(r if j%2 else r*1.8),cy+math.sin(j*math.pi/8+i*.05)*(r if j%2 else r*1.8)) for j in range(16)]
 d.polygon(points,fill='#bbff31');frames.append(im)
frames[0].save(out/'star.gif',save_all=True,append_images=frames[1:],duration=120,loop=0)
with wave.open(str(out/'demo.wav'),'wb') as f:
 f.setparams((1,2,22050,0,'NONE','not compressed'))
 data=bytearray()
 for i in range(22050*6):
  t=i/22050;freq=[220,261.63,329.63,293.66][int(t*2)%4];env=min(1,t*3,(6-t)*3)*(.65+.35*math.sin(t*math.pi*2))
  s=(math.sin(2*math.pi*freq*t)+.3*math.sin(4*math.pi*freq*t))*.15*env
  data.extend(struct.pack('<h',int(s*32767)))
 f.writeframes(data)
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','lavfi','-i','color=c=0x161226:s=480x270:r=24:d=4','-vf',"drawgrid=w=40:h=40:t=1:c=0xff3970@0.5,drawbox=x='100':y='60':w=280:h=150:c=0xbbff31@0.3:t=fill,hue=h=15*t:s=1",'-c:v','libvpx-vp9','-b:v','120k','-an',str(out/'visual.webm')],check=True)
