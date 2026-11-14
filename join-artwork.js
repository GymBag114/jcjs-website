// Cache the print passes; only the limb registration and ray geometry move.
window.makeJoinSheet = function (canvas,w,h,plateRight,emblemMotion) {
  function layer() {
    const plate=document.createElement('canvas');
    plate.width=canvas.width;plate.height=canvas.height;
    const ink=plate.getContext('2d');
    ink.scale(plate.width/w,plate.height/h);
    return {plate,ink};
  }
  const paper=layer(), dark=layer(), orbits=layer(), satellite=layer();
  let g=paper.ink;
  window.drawPrintStock(g,w,h,true);
  const y=h/2;
  const r=Math.min(h*.158,w*.152,(w-plateRight)*.48);
  const moon=Math.max(w*.838,plateRight+r+1);
  const cx=Math.min(w-r-1,moon);
  const source=w*.494;
  const hair=Math.max(.47,Math.min(.95,w/950));
  function line(x0,y0,x1,y1,color,width=hair) {
    g.strokeStyle=color;g.lineWidth=width;
    g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();
  }
  function circle(x,cy,radius,color,width=hair) {
    g.strokeStyle=color;g.lineWidth=width;g.beginPath();
    g.arc(x,cy,radius,0,2*Math.PI);g.stroke();
  }
  // A very large elliptical limb gives the boundary its shallow curvature.
  // Keep even the faint leading edge to the right of the resting rectangle.
  const rim=cx-r*.39, softness=Math.min(w*.15,(rim-plateRight)*.93);
  const sag=Math.min(w*.125,(rim-plateRight)*.48);
  const rx=w*1.85, ry=y/Math.sqrt(1-(1-sag/rx)**2);
  g=dark.ink;
  g.save();g.translate(rim-rx,y);g.scale(rx,ry);
  const field=g.createRadialGradient(0,0,0,0,0,1.22);
  const stops=[[0,'rgba(25,23,22,0)'],[1-softness/rx,'rgba(25,23,22,0)'],
    [1-softness/rx*.64,'rgba(29,28,27,.18)'],[1-softness/rx*.28,'rgba(18,18,18,.57)'],
    [1,'rgba(6,6,6,.94)'],[1+softness/rx*.21,'#050505']];
  for(const [pos,color] of stops) field.addColorStop(pos/1.22,color);
  g.fillStyle=field;g.fillRect(-1,-2,5,4);g.restore();

  // Sparse offset-printed specks around the left datum and in the black sky.
  let seed=1939;
  function rand() {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  for(let i=0;i<202;i++) {
    const right=i>176, x=right?cx+(rand()-.22)*r*1.8:w*(.257+(rand()+rand()-1)*.12);
    const py=rand()*h, size=hair*(.6+rand()*1.55);
    g=right?dark.ink:paper.ink;
    g.fillStyle=right?'rgba(245,241,231,.53)':'rgba(44,40,36,'+(.18+rand()*.4)+')';
    g.fillRect(x,py,size,size);
  }
  g=paper.ink;
  const rule='#514d4480', faint='#5c554c50';
  line(w*.294,0,w*.294,h,rule);
  line(w*.14,y,w*.295,y,faint);
  line(w*.14,y,w*.493,h*.946,faint);
  line(w*.49,h*.031,w*.49,h*.97,faint);
  for(const [level,gridY] of [[.206,.20],[.794,.735]]) {
    const py=level*h, stem=w*.573;
    line(stem,py,w,py,'#8e8a817c');
    line(stem,py,stem,y,faint);
    const gridSize=Math.min(w*.089,h*.085);
    const x=w*.50-gridSize*.5, gy=h*gridY;
    for(let col=0;col<=5;col++) line(x+col*gridSize/5,gy,x+col*gridSize/5,gy+gridSize*1.32,faint);
    for(let row=0;row<=8;row++) line(x,gy+row*gridSize*1.32/8,x+gridSize,gy+row*gridSize*1.32/8,faint);
    g.strokeStyle=rule;g.strokeRect(stem-gridSize*.16,py-gridSize*.13,gridSize*.32,gridSize*.26);
  }
  for(const py of [h*.06,h*.941]) {
    const cap=Math.min(w*.02,h*.025);
    g.strokeStyle=rule;g.strokeRect(w*.499-cap/2,py-h*.028,cap,h*.056);
    line(w*.499,py,w*.592,y,faint);
  }

  // Lines on the dark side are light ink, as in the photographic reference.
  g=orbits.ink;
  const wire=g.createLinearGradient(source,0,cx,0);
  wire.addColorStop(0,'#403b37b5');wire.addColorStop(.57,'#4a4641a8');
  wire.addColorStop(1,'#c4bfb5a8');
  for(const size of [1.18,1.42,1.68]) circle(cx,y,r*size,wire);
  g=satellite.ink;
  g.save();g.beginPath();g.arc(cx,y,r,0,2*Math.PI);g.clip();
  const shade=g.createLinearGradient(cx-r,0,cx+r,0);
  for (const [stop,color] of [[0,'#242424'],[.17,'#4e4e4e'],[.33,'#9e9d98'],[.393,'#d3d1ca'],
    [.395,'#faf8f0'],[1,'#fcfaf3']]) shade.addColorStop(stop,color);
  g.fillStyle=shade;g.fillRect(cx-r,y-r,2*r,2*r);
  g.translate(cx,y);g.scale(r,r);
  g.lineWidth=hair/r;g.strokeStyle='#34312db8';
  for (const [x,py,ww,hh] of [[-.21,-1,.43,.24],[-.21,-.78,.97,.38],[-.21,.39,.97,.36],[-.2,.76,.44,.23]]) g.strokeRect(x,py,ww,hh);
  for (const dy of [-.15,-.063,-.012,.05,.106,.164]) line(-.22,dy,1.08,dy+.012,'#38352fc0',hair/r);
  for(const xx of [-.23,.00,.25,.38]) line(xx,-.91,xx+.029,.67,'#6a655a99',hair/r);
  g.restore();
  circle(cx,y,r,'#44413c80');
  g=paper.ink;
  circle(source,y,r*.103,'#b3a89c70');circle(source,y,r*.148,'#b3a89c55');
  g.fillStyle='#211e1c';g.beginPath();g.arc(source,y,r*.097,0,Math.PI*2);g.fill();
  const slopes=[-1.16,-.83,-.58,-.36,-.2,-.08,0,.08,.2,.36,.58,.83,1.16];
  const clamp=n=>Math.max(0,Math.min(1,n));
  const ease=n=>{const t=clamp(n);return t*t*t*(10+t*(-15+6*t));};
  return {draw(ctx,clock,fold,phase=0,extension=0) {
    // The broad pass leads; the satellite and engraving catch up on the
    // same front/tail curve as the site emblem, rather than sliding rigidly.
    const registration=emblemMotion(clamp(clock/.90)*505);
    const satelliteMove=emblemMotion(clamp((clock-.06)/.94)*505);
    const offset=(w-rim+softness)*(1-registration.front);
    const orbitOffset=(w-rim+softness)*.48*(1-satelliteMove.tail);
    if (extension>0) {
      ctx.fillStyle='#050505';
      ctx.fillRect(w-1,0,extension+2,h);
    }
    ctx.drawImage(paper.plate,0,0,w,h);
    ctx.drawImage(dark.plate,offset,0,w,h);
    ctx.save();
    ctx.globalAlpha=ease((clock-.08)/.84);
    ctx.drawImage(orbits.plate,orbitOffset,0,w,h);
    if (extension>0) {
      // The rings were cached to one viewport. Engrave their remaining
      // arcs on the adjoining black stock as the camera crosses its edge.
      ctx.beginPath();
      ctx.rect(w,0,extension,h);
      ctx.clip();
      ctx.strokeStyle=wire;
      ctx.lineWidth=hair;
      for (const size of [1.18,1.42,1.68]) {
        ctx.beginPath();
        ctx.arc(cx,y,r*size,0,2*Math.PI);
        ctx.stroke();
      }
    }
    ctx.restore();
    // The rays stay straight. Their angular aperture closes around the
    // source, rather than bending or translating the whole background.
    const emission=emblemMotion(clamp((clock-.06)/.94)*505);
    const reach=emission.front;
    const aperture=emission.tail*(1-fold);
    const end=source+(w+extension-source)*reach;
    const ink=ctx.createLinearGradient(source,0,cx,0);
    ink.addColorStop(0,'#403b37b5');ink.addColorStop(.57,'#4a4641a8');
    ink.addColorStop(1,'#c4bfb5a8');
    ctx.strokeStyle=ink;ctx.lineWidth=hair;
    ctx.beginPath();
    for(const slope of slopes) {
      ctx.moveTo(source,y);ctx.lineTo(end,y+slope*(end-source)*aperture);
    }
    ctx.stroke();
    // Small ink signals travel outwards on alternating rays. They move in
    // depth along the existing lines; no oscillation disturbs the engraving.
    if(clock===1 && phase>0) {
      const length=w-source;
      for(let i=0;i<slopes.length;i+=2) {
        const t=(phase/3800+i*.137)%1;
        const envelope=Math.sin(Math.PI*t)**2*(1-fold);
        const start=source+length*t, tail=Math.max(source,start-length*.055);
        ctx.globalAlpha=envelope*.48;
        ctx.strokeStyle=ink;ctx.lineWidth=hair*1.8;
        ctx.beginPath();ctx.moveTo(tail,y+slopes[i]*(tail-source)*aperture);
        ctx.lineTo(start,y+slopes[i]*(start-source)*aperture);ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    ctx.drawImage(satellite.plate,(w-rim+softness)*.65*(1-satelliteMove.front),0,w,h);
  }};
};
