// Three square printing plates. The gutter, diptych and modular grid carry
// the words at gallery scale, with the same paper and pigments as the tower.
const paper = '#eae2d2';
const ink = '#252321';
const red = '#a33125';

export function drawSloganPrint(g, label, tower) {
  g.fillStyle = paper;
  g.fillRect(0, 0, 512, 512);
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  function block(x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  }
  function letter(text, x, y, size, color) {
    g.fillStyle = color;
    g.font = '600 ' + size + 'px "Songti SC", "Noto Serif CJK SC", SimSun, serif';
    g.fillText(text, x, y);
  }
  function plate(sx, sy, sw, sh, x, y, w, h) {
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.drawImage(tower, sx, sy, sw, sh, x, y, w, h);
    g.restore();
  }

  if (label === '团结') {
    // One architectural section, cut on its spine and registered in two inks.
    block(20, 20, 231, 370, '#c5b9a5');
    block(261, 20, 231, 370, '#cb6046');
    plate(112, 212, 255, 444, 20, 20, 231, 370);
    plate(367, 212, 255, 444, 261, 20, 231, 370);
    block(20, 402, 472, 2, ink);
    letter('团', 198, 457, 96, ink);
    letter('结', 314, 457, 96, red);
    block(20, 453, 105, 4, ink);
    block(387, 453, 105, 4, red);
  } else if (label === '平等') {
    // Two impressions of identical weight face one another across bare paper.
    for (const [i, x] of [26, 265].entries()) {
      block(x, 34, 221, 244, '#d0c6b7');
      g.save();
      g.translate(x + (i ? 221 : 0), 34);
      g.scale(i ? -1 : 1, 1);
      plate(175, 575, 340, 375, 0, 0, 221, 244);
      g.restore();
      block(x, 302, 221, 7, red);
      block(x, 318, 221, 7, red);
      letter(label[i], x + 110.5, 411, 116, ink);
    }
  } else {
    // The same bay repeats on a three-column building grid.
    const bay = 150;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const x = 23 + col * 158,
          y = 23 + row * 158;
        if (col === row) {
          block(x, y, bay, bay, row === 1 ? red : ink);
          if (row !== 1) letter(row === 0 ? '秩' : '序', x + 75, y + 76, 121, paper);
        } else {
          block(x, y, bay, bay, '#c7bcab');
          plate(175 + col * 105, 420 + row * 135, 176, 176, x, y, bay, bay);
        }
      }
    }
  }
}
