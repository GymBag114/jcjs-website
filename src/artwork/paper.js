// Shared, deterministic paper stock for all canvas compositions.
const paper = '#eee9df';
let grain;
function grainTile() {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 256;
  const ctx = tile.getContext('2d');
  const data = ctx.createImageData(256, 256);
  let seed = 177;
  for (let i = 0; i < data.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = seed / 4294967296;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = value > 0.54 ? 251 : 29;
    data.data[i + 3] = Math.round(4 + 33 * Math.abs(value - 0.5));
  }
  ctx.putImageData(data, 0, 0);
  return tile;
}

export function printGrain(ctx, x, y, w, h) {
  grain ||= grainTile();
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.fillRect(x, y, w, h);
}

// Both sheets are printed on the same stock. The band also has a photo pass.
export function drawPrintStock(ctx, w, h, light = false) {
  ctx.fillStyle = light ? paper : '#111214';
  ctx.fillRect(0, 0, w, h);
  printGrain(ctx, 0, 0, w, h);
}

export function getPaperGrain() {
  return (grain ||= grainTile());
}
