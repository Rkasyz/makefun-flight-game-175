// terrain.js — the island chain the mail run flies over: world shape, sky, sea,
// hills, trees, the little town, and the two runways. Everything is drawn from a
// fixed seed, so the same world shows on every load.

export const WORLD = {
  width: 7200,
  height: 900,
  seaLevel: 700,
};

/** The two landing strips, flat by definition, in world coordinates. */
export const RUNWAYS = [
  { name: 'HOME', x0: 250, x1: 950, y: 648 },
  { name: 'FAR', x0: 6250, x1: 6950, y: 652 },
];

/** A small deterministic random source (mulberry32) so the world never changes. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (t) => t * t * (3 - 2 * t);

/** Build the terrain: control heights, trees, clouds and the town, all seeded. */
export function makeTerrain() {
  const rand = seededRandom(20261126);
  const step = 200;
  const count = Math.floor(WORLD.width / step) + 2;
  const heights = [];
  for (let i = 0; i < count; i++) {
    // Rolling hills between 560 and 660, higher toward the far island.
    const x = i * step;
    const rise = (x / WORLD.width) * 40;
    heights.push(620 - rise + (rand() - 0.5) * 90);
  }
  // Sea gaps: the ground sinks below the waterline between the islands.
  const sinkGap = (x0, x1) => {
    for (let i = 0; i < count; i++) {
      const x = i * step;
      if (x < x0 - 200 || x > x1 + 200) continue;
      const edge = smooth(clamp(Math.min(x - (x0 - 200), x1 + 200 - x) / 200, 0, 1));
      heights[i] = heights[i] * (1 - edge) + 790 * edge;
    }
  };
  sinkGap(1500, 2500);
  sinkGap(4900, 5500);

  const trees = [];
  for (let i = 0; i < 110; i++) {
    const x = 80 + rand() * (WORLD.width - 160);
    trees.push({ x, s: 0.7 + rand() * 0.9, lean: (rand() - 0.5) * 0.2 });
  }
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    clouds.push({ x: rand() * WORLD.width, y: 60 + rand() * 200, s: 0.7 + rand() * 1.1, v: 4 + rand() * 7 });
  }
  const houses = [];
  for (let i = 0; i < 11; i++) {
    houses.push({ x: 5560 + i * 52 + rand() * 18, w: 34 + rand() * 14, h: 26 + rand() * 16, lit: rand() > 0.4 });
  }
  return { step, heights, trees, clouds, houses };
}

/** The ground height at world x, with the runways kept flat. */
export function groundHeight(terrain, x) {
  const cx = clamp(x, 0, WORLD.width);
  const i = Math.floor(cx / terrain.step);
  const f = smooth(clamp((cx - i * terrain.step) / terrain.step, 0, 1));
  const a = terrain.heights[i] ?? 620;
  const b = terrain.heights[Math.min(i + 1, terrain.heights.length - 1)] ?? 620;
  let y = a + (b - a) * f;
  for (const r of RUNWAYS) {
    const edge = 70;
    if (cx > r.x0 - edge && cx < r.x1 + edge) {
      const blend = smooth(clamp(Math.min(cx - (r.x0 - edge), r.x1 + edge - cx) / edge, 0, 1));
      y = y * (1 - blend) + r.y * blend;
    }
  }
  return y;
}

/** Which runway, if any, covers world x. */
export function runwayAt(x) {
  for (const r of RUNWAYS) if (x >= r.x0 && x <= r.x1) return r;
  return null;
}

function drawSky(ctx, cam, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, cam.h);
  sky.addColorStop(0, '#2c5f8a');
  sky.addColorStop(0.45, '#7fb6cf');
  sky.addColorStop(0.72, '#ffd9a0');
  sky.addColorStop(1, '#f7b267');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, cam.w, cam.h);
  // Low morning sun with a soft halo, drifting almost imperceptibly as time passes.
  const sx = cam.w * 0.78 + Math.sin(time * 0.02) * 8;
  const sy = cam.h * 0.2 + Math.cos(time * 0.013) * 4;
  const halo = ctx.createRadialGradient(sx, sy, 4, sx, sy, 150);
  halo.addColorStop(0, 'rgba(255, 236, 180, 0.95)');
  halo.addColorStop(0.25, 'rgba(255, 214, 130, 0.55)');
  halo.addColorStop(1, 'rgba(255, 214, 130, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sx - 160, sy - 160, 320, 320);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sx, sy, 26, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(ctx, cam, terrain, time) {
  ctx.fillStyle = 'rgba(255, 252, 245, 0.85)';
  for (const c of terrain.clouds) {
    const wx = ((c.x + time * c.v) % (WORLD.width + 800)) - 400;
    const sx = (wx - cam.x * 0.35) * cam.zoom + cam.w / 2;
    const sy = (c.y - cam.y * 0.2) * cam.zoom + cam.h / 2;
    const r = 26 * c.s * cam.zoom;
    if (sx < -160 || sx > cam.w + 160) continue;
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * 1.9, r * 0.62, 0, 0, Math.PI * 2);
    ctx.ellipse(sx - r * 0.9, sy + r * 0.18, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(sx + r * 0.9, sy + r * 0.16, r * 1.0, r * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSea(ctx, cam) {
  const top = (WORLD.seaLevel - cam.y) * cam.zoom + cam.h / 2;
  if (top > cam.h) return;
  const sea = ctx.createLinearGradient(0, Math.max(0, top), 0, cam.h);
  sea.addColorStop(0, '#2a8fb0');
  sea.addColorStop(1, '#155e7d');
  ctx.fillStyle = sea;
  ctx.fillRect(0, Math.max(0, top), cam.w, cam.h - Math.max(0, top));
  // Sun glitter on the water.
  ctx.strokeStyle = 'rgba(255, 230, 170, 0.5)';
  ctx.lineWidth = 2;
  const gy = top + 26;
  for (let i = 0; i < 9; i++) {
    const x = cam.w * 0.62 + Math.sin(i * 2.7) * 150;
    ctx.beginPath();
    ctx.moveTo(x - 26 - i * 3, gy + i * 16);
    ctx.lineTo(x + 26 + i * 3, gy + i * 16);
    ctx.stroke();
  }
}

function drawHills(ctx, cam, terrain) {
  const x0 = Math.max(0, cam.x - cam.w / 2 / cam.zoom - 100);
  const x1 = Math.min(WORLD.width, cam.x + cam.w / 2 / cam.zoom + 100);
  // Far ridge, hazy blue-green, drawn first.
  ctx.beginPath();
  ctx.moveTo((x0 - cam.x) * cam.zoom + cam.w / 2, cam.h + 10);
  for (let x = x0; x <= x1; x += 24) {
    const y = groundHeight(terrain, x) - 46 - Math.sin(x * 0.002) * 18;
    ctx.lineTo((x - cam.x) * cam.zoom + cam.w / 2, (y - cam.y) * cam.zoom + cam.h / 2);
  }
  ctx.lineTo((x1 - cam.x) * cam.zoom + cam.w / 2, cam.h + 10);
  ctx.closePath();
  ctx.fillStyle = '#5d8a72';
  ctx.fill();
  // Near ground.
  ctx.beginPath();
  ctx.moveTo((x0 - cam.x) * cam.zoom + cam.w / 2, cam.h + 10);
  for (let x = x0; x <= x1; x += 16) {
    const y = groundHeight(terrain, x);
    ctx.lineTo((x - cam.x) * cam.zoom + cam.w / 2, (y - cam.y) * cam.zoom + cam.h / 2);
  }
  ctx.lineTo((x1 - cam.x) * cam.zoom + cam.w / 2, cam.h + 10);
  ctx.closePath();
  const ground = ctx.createLinearGradient(0, (560 - cam.y) * cam.zoom + cam.h / 2, 0, cam.h);
  ground.addColorStop(0, '#5c8a4a');
  ground.addColorStop(1, '#3c6234');
  ctx.fillStyle = ground;
  ctx.fill();
  // Sand where the ground meets the sea.
  ctx.fillStyle = '#d9c08a';
  for (let x = x0; x <= x1; x += 16) {
    const gy = groundHeight(terrain, x);
    if (gy > WORLD.seaLevel - 26 && gy < WORLD.seaLevel + 8) {
      const sx = (x - cam.x) * cam.zoom + cam.w / 2;
      const sy = (gy - cam.y) * cam.zoom + cam.h / 2;
      ctx.fillRect(sx, sy - 3 * cam.zoom, 17 * cam.zoom, 6 * cam.zoom);
    }
  }
}

function drawTrees(ctx, cam, terrain) {
  for (const t of terrain.trees) {
    const gy = groundHeight(terrain, t.x);
    if (gy > WORLD.seaLevel - 10) continue;
    const sx = (t.x - cam.x) * cam.zoom + cam.w / 2;
    if (sx < -40 || sx > cam.w + 40) continue;
    const sy = (gy - cam.y) * cam.zoom + cam.h / 2;
    const s = 26 * t.s * cam.zoom;
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = Math.max(2, 3 * cam.zoom);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + t.lean * s, sy - s * 0.5);
    ctx.stroke();
    ctx.fillStyle = '#2f6b35';
    ctx.beginPath();
    ctx.moveTo(sx + t.lean * s, sy - s * 1.5);
    ctx.lineTo(sx - s * 0.55, sy - s * 0.45);
    ctx.lineTo(sx + s * 0.55, sy - s * 0.45);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTown(ctx, cam, terrain) {
  for (const h of terrain.houses) {
    const gy = groundHeight(terrain, h.x);
    if (gy > WORLD.seaLevel - 10) continue;
    const sx = (h.x - cam.x) * cam.zoom + cam.w / 2;
    if (sx < -80 || sx > cam.w + 80) continue;
    const sy = (gy - cam.y) * cam.zoom + cam.h / 2;
    const w = h.w * cam.zoom;
    const hh = h.h * cam.zoom;
    ctx.fillStyle = '#e8dcc3';
    ctx.fillRect(sx, sy - hh, w, hh);
    ctx.fillStyle = '#b5563c';
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy - hh);
    ctx.lineTo(sx + w / 2, sy - hh - 12 * cam.zoom);
    ctx.lineTo(sx + w + 3, sy - hh);
    ctx.closePath();
    ctx.fill();
    if (h.lit) {
      ctx.fillStyle = '#ffd97a';
      ctx.fillRect(sx + w * 0.2, sy - hh * 0.6, w * 0.22, hh * 0.3);
      ctx.fillRect(sx + w * 0.6, sy - hh * 0.6, w * 0.22, hh * 0.3);
    }
  }
  // The lighthouse at the far island's point, with its lamp lit.
  const lx = 7060;
  const ly = groundHeight(terrain, lx);
  const sx = (lx - cam.x) * cam.zoom + cam.w / 2;
  if (sx > -100 && sx < cam.w + 100) {
    const sy = (ly - cam.y) * cam.zoom + cam.h / 2;
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(sx - 7 * cam.zoom, sy - 64 * cam.zoom, 14 * cam.zoom, 64 * cam.zoom);
    ctx.fillStyle = '#c94f3d';
    ctx.fillRect(sx - 7 * cam.zoom, sy - 48 * cam.zoom, 14 * cam.zoom, 10 * cam.zoom);
    ctx.fillRect(sx - 7 * cam.zoom, sy - 24 * cam.zoom, 14 * cam.zoom, 10 * cam.zoom);
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(sx, sy - 70 * cam.zoom, 6 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRunways(ctx, cam) {
  for (const r of RUNWAYS) {
    const x0 = (r.x0 - cam.x) * cam.zoom + cam.w / 2;
    const x1 = (r.x1 - cam.x) * cam.zoom + cam.w / 2;
    if (x1 < -40 || x0 > cam.w + 40) continue;
    const y = (r.y - cam.y) * cam.zoom + cam.h / 2;
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(x0, y, x1 - x0, 10 * cam.zoom);
    ctx.fillStyle = '#f5f2e8';
    for (let x = r.x0 + 30; x < r.x1 - 30; x += 90) {
      const sx = (x - cam.x) * cam.zoom + cam.w / 2;
      ctx.fillRect(sx, y + 3.5 * cam.zoom, 44 * cam.zoom, 3 * cam.zoom);
    }
    ctx.fillStyle = '#f5f2e8';
    ctx.font = `bold ${Math.max(10, 15 * cam.zoom)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('07', x0 + 34 * cam.zoom, y + 26 * cam.zoom);
    ctx.fillText('25', x1 - 34 * cam.zoom, y + 26 * cam.zoom);
    // Windsock beside the threshold.
    const wx = (r.x0 + 40 - cam.x) * cam.zoom + cam.w / 2;
    ctx.strokeStyle = '#d8d2c0';
    ctx.lineWidth = 2 * cam.zoom;
    ctx.beginPath();
    ctx.moveTo(wx, y);
    ctx.lineTo(wx, y - 34 * cam.zoom);
    ctx.stroke();
    ctx.fillStyle = '#ff7a2f';
    ctx.beginPath();
    ctx.moveTo(wx, y - 34 * cam.zoom);
    ctx.lineTo(wx + 26 * cam.zoom, y - 28 * cam.zoom);
    ctx.lineTo(wx, y - 22 * cam.zoom);
    ctx.closePath();
    ctx.fill();
  }
}

/** Draw the whole world for the camera. cam: {x, y, zoom, w, h}. */
export function drawTerrain(ctx, cam, terrain, time) {
  drawSky(ctx, cam, time);
  drawClouds(ctx, cam, terrain, time);
  drawSea(ctx, cam);
  drawHills(ctx, cam, terrain);
  drawTown(ctx, cam, terrain);
  drawTrees(ctx, cam, terrain);
  drawRunways(ctx, cam);
}
