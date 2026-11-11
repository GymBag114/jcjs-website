// Positions are in viewport widths along a single horizontal exhibition.
window.createGallery = function (scene, reducedMotion, emblemMotion, onChange) {
  const canvas = scene.querySelector('.gallery');
  const ctx = canvas.getContext('2d');
  const poster = scene.querySelector('.poster');
  const towerPlane = scene.querySelector('.tower');
  const overprint = scene.querySelector('.print-overprint');
  const sky = scene.querySelector('.sky img');
  const ground = scene.querySelector('.ground img');
  const tower = scene.querySelector('.tower img');
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { const t = clamp(n); return t*t*(3-2*t); };
  // The first gallery composition sits at camera zero; the poster is one
  // approach to its left. Wheel, touch and keys all move on this same track.
  const approach = 1.34, end = 2.55;
  const overview = approach / (approach + end);
  let velocity = 0;
  const nodes = [
    [.12,.66,.14], [.21,.26,.11], [.29,.46,.08], [.34,.72,.17],
    [.43,.35,.14], [.49,.19,.10], [.57,.63,.17], [.65,.79,.10],
    [.70,.27,.18], [.79,.51,.16], [.89,.72,.10], [.93,.30,.12],
    [1.11,.44,.21], [1.25,.68,.12], [1.38,.25,.15], [1.51,.53,.18],
    [1.65,.74,.10], [1.77,.30,.20], [1.91,.57,.13], [2.05,.77,.15],
    [2.17,.26,.11], [2.28,.50,.18], [2.40,.69,.10], [2.50,.24,.13],
    [2.66,.65,.14], [2.91,.77,.06], [3.00,.22,.06], [3.10,.53,.07],
    [3.19,.33,.05], [3.32,.55,.31], [3.49,.72,.065],
    [3.18,.74,.029], [3.08,.67,.041], [2.91,.57,.032], [3.05,.38,.034]
  ];
  // Larger prints sit nearer the viewer. Render them over the smaller ones.
  const depths = nodes.map(([, , size]) => .78 + Math.min(size, .23) * 2.55);
  const paintOrder = nodes.map((_, index) => index).sort((a, b) => depths[a] - depths[b]);
  const tiles = [];
  let width, height, paperWidth, portrait, pos = 0, target = 0, raf = 0, last = 0;

  function prepareTiles() {
    if (tiles.length || ![sky,ground,tower].every(img=>img.complete && img.naturalWidth)) return;
    for (let i=0;i<12;i++) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = 512;
      const g = tile.getContext('2d');
      const light = i%3 === 0;
      g.fillStyle = light ? '#e5dfd2' : i%3 === 1 ? '#9b3029' : '#302d28';
      g.fillRect(0,0,512,512);
      const img = [tower, sky, ground, tower][i%4];
      const crop = Math.min(img.naturalWidth,img.naturalHeight)*(.48+(i%4)*.12);
      g.globalAlpha = light ? .78 : .72;
      g.globalCompositeOperation = light ? 'multiply' : 'luminosity';
      g.drawImage(img,(img.naturalWidth-crop)*((i*.37)%1),(img.naturalHeight-crop)*((i*.23+.4)%1),
        crop,crop,0,0,512,512);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha=1;
      if (i%3===1) {
        g.fillStyle='#211c1988'; g.beginPath(); g.moveTo(0,0); g.lineTo(210,0); g.lineTo(0,400); g.fill();
      }
      g.fillStyle = light ? '#372a2036' : '#eee6cc38';
      for (let y=1;y<512;y+=7) for(let x=(y%2)*3;x<512;x+=7) g.fillRect(x,y,1.6,1.6);
      tiles.push(tile);
    }
  }

  function size() {
    width=scene.clientWidth; height=scene.clientHeight;
    portrait=width/height<=.8;
    paperWidth=width/Math.max(width/2560,height/1440);
    const d=Math.min(devicePixelRatio||1,1.5,2100/Math.max(width,height));
    canvas.width=Math.round(width*d); canvas.height=Math.round(height*d);
    ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
    if(pos || target) render();
  }

  function movePoster(distance) {
    const t = Math.min(distance / approach, 2.15);
    const shift = (name, widths) => poster.style.setProperty(name, (-widths * paperWidth) + 'px');
    shift('--far-ring-x', t * .74);
    shift('--near-ring-x', t * (portrait ? 1.91 : 1.31));
    shift('--blade-x', t * 1.09);
    shift('--orbit-x', t * 1.31);
    shift('--satellite-x', t * 1.52);
    towerPlane.style.translate = (-t * (paperWidth * 1.36 + 200)) + 'px 0';
    towerPlane.style.setProperty('--tower-lift', 1 + .045 * Math.min(t, 1));

    // The right endcap overprints the lettering. Its bevel opens and closes
    // with the two strokes of the emblem, before the ink strip clears left.
    const {front, tail} = emblemMotion(clamp(t / .235) * 505);
    const lip = 98.4 * (1 - front);
    const bevel = (front - tail) * Math.min(13, 17 * height / width);
    overprint.style.clipPath = `polygon(${lip}% 0,100% 0,100% 100%,${lip + bevel}% 100%)`;
    shift('--strip-x', smooth((t - .15) / .65) * 1.015);
    poster.style.setProperty('--caption-opacity', 1 - smooth(t / .55));
  }

  function render() {
    const distance = pos * (approach + end);
    const camera = distance - approach;
    const unit = Math.min(width, height * (portrait ? .94 : 1.65));
    const endpoint = smooth((camera - end + .47) / .47);
    canvas.hidden = !pos;
    scene.classList.toggle('in-gallery', !!pos);
    movePoster(distance);
    if (!pos) return;
    ctx.clearRect(0,0,width,height);
    prepareTiles();
    // At camera zero and at the endpoint the frames land on their composed
    // coordinates. Between them, closer frames cross the lens faster.
    const parallax = camera <= 0 ? camera : end / Math.PI * Math.sin(Math.PI * camera / end);
    const frames=nodes.map(([nx,ny,size],i)=>{
      const depth = depths[i];
      let x = (nx - camera - (depth - 1) * parallax) * width;
      let y = ny * height;
      if(portrait && i>=24) {
        if(i===29){ x-=width*.10*endpoint; y+=height*.09*endpoint; }
        if(i===24) y-=height*.12*endpoint;
        if(i===26) x+=width*.34*endpoint;
      }
      const shrink=smooth((x/width+.075)/.24);
      const appear=smooth((1.18-x/width)/.19);
      // Incoming prints open away from the horizon as they reach the lens.
      y = height * .5 + (y - height * .5) * (1 - (1 - appear) * depth * .17);
      const scale=(.05+.95*shrink)*(.72+.28*appear);
      const side=size*unit*(portrait ? 1.43 : 1)*scale;
      if(i===25) return {x,y,w:side*3.1,h:side*.51,alpha:shrink*appear};
      return {x,y,w:side*(i===29?1.12:1),h:side,alpha:shrink*appear};
    });
    // Links meet the moving centers and share the frames' depth falloff.
    ctx.strokeStyle='#63564c'; ctx.lineWidth=.7;
    for(let i=0;i<frames.length;i++) {
      const a=frames[i];
      if(a.x<-.55*width || a.x>width*1.1) continue;
      for(const offset of [1,3]) {
        const b=frames[i+offset]; if(!b) continue;
        ctx.globalAlpha=.46*Math.min(a.alpha,b.alpha);
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      }
    }
    for (const i of paintOrder) {
      const f=frames[i];
      if(!f.alpha || f.x+f.w/2<0 || f.x-f.w/2>width) continue;
      const x=f.x-f.w/2, y=f.y-f.h/2;
      ctx.globalAlpha=f.alpha;
      const tile=tiles[(i===29 ? 3 : i===24 ? 6 : i)%12];
      if(tile) {
        const cropHeight=Math.min(tile.height,tile.width*f.h/f.w);
        ctx.drawImage(tile,0,(tile.height-cropHeight)/2,tile.width,cropHeight,x,y,f.w,f.h);
      }
      ctx.strokeStyle='#31282070'; ctx.lineWidth=.8; ctx.strokeRect(x,y,f.w,f.h);
    }
    if(endpoint) {
      ctx.globalAlpha=endpoint;
      const x=width*(.075+(1-endpoint)*.36), y=height*(portrait?.25:.35);
      const em=Math.min(width*(portrait?.134:.082),height*.17);
      ctx.fillStyle='#25201c';
      ctx.font='italic '+em*.50+'px Didot, Georgia, serif';
      ctx.fillText('The Unfinished',x,y);
      ctx.font=em+'px Didot, Georgia, serif'; ctx.fillText('Tower',x,y+em*.85);
      ctx.fillStyle='#8e3025'; ctx.font='500 '+Math.max(13,em*.17)+'px "Songti SC", serif';
      ctx.fillText('未 竟 之 塔',x,y+em*1.28);
    }
    ctx.globalAlpha=1;
  }

  function tick(now) {
    const dt=last?Math.min(64,now-last):16; last=now;
    const seconds = dt / 1000;
    const rate = 9, decay = Math.exp(-rate * seconds);
    const gap = pos - target, slope = velocity + rate * gap;
    pos = target + (gap + slope * seconds) * decay;
    velocity = (velocity - rate * slope * seconds) * decay;
    if (Math.abs(target - pos) < .00003 && Math.abs(velocity) < .00035) {
      pos = target;
      velocity = 0;
    }
    render();
    if(pos!==target || velocity) raf=requestAnimationFrame(tick);
    else {raf=0; last=0;}
  }
  function finish() {
    cancelAnimationFrame(raf);
    raf=0; last=0; pos=target; velocity=0;
    render();
  }
  function seek(value) {
    const previous=target;
    target=clamp(value);
    if(target===previous) return;
    if(!width) size();
    onChange(target);
    if(reducedMotion.matches) finish();
    else if(!raf) raf=requestAnimationFrame(tick);
  }
  function scroll(delta) {
    if(!delta) return;
    const distance = 150 * Math.asinh(delta / 150);
    seek(target + distance / (Math.max(480, height) * 3.45));
  }
  function step(forward) {
    seek(forward && !target ? overview : target + (forward ? .18 : -.18));
  }
  return {size,seek,step,finish,prepareTiles,scroll,
    get active(){return pos>0||target>0;},get target(){return target;}};
};
