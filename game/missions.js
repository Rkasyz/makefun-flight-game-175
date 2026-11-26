// missions.js — the mail run's three jobs: thread the rings, land on the far
// runway, and drop the mail over the marked zone. One job at a time, in order.

import { groundHeight, WORLD } from './terrain.js';

export const MISSIONS = [
  { id: 'rings', name: 'RING RUN', objective: 'Fly through all 6 rings over the sea' },
  { id: 'landing', name: 'ISLAND LANDING', objective: 'Land on the FAR runway, gently' },
  { id: 'drop', name: 'MAIL DROP', objective: 'Drop the mail over the striped zone' },
];

export const RING_POSITIONS = [
  { x: 1500, y: 430 },
  { x: 2300, y: 360 },
  { x: 3100, y: 470 },
  { x: 3900, y: 330 },
  { x: 4700, y: 440 },
  { x: 5500, y: 360 },
];

export const RING_RADIUS = 46;
export const DROP_ZONE = { x0: 5980, x1: 6180 };

export function createMissionState() {
  return {
    index: 0,
    rings: RING_POSITIONS.map((r) => ({ ...r, r: RING_RADIUS, collected: false })),
    parcel: null,
    parcelRest: 0,
    done: false,
  };
}

export function currentMission(state) {
  return MISSIONS[Math.min(state.index, MISSIONS.length - 1)];
}

export function ringsLeft(state) {
  return state.rings.filter((r) => !r.collected).length;
}

function nextRing(state) {
  return state.rings.find((r) => !r.collected) ?? null;
}

/**
 * Advance the missions one frame. planeEvent is what stepPlane returned this
 * frame (or null). Returns { score, messages: [] } for the HUD and the log.
 */
export function updateMissions(state, plane, ctl, dt, planeEvent, terrain) {
  const out = { score: 0, messages: [], sound: null };
  if (state.done) return out;
  const mission = currentMission(state);

  if (mission.id === 'rings') {
    for (const ring of state.rings) {
      if (ring.collected) continue;
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      if (dx * dx + dy * dy < (ring.r + 12) * (ring.r + 12)) {
        ring.collected = true;
        plane.fuel = Math.min(100, plane.fuel + 5);
        out.score += 50;
        out.sound = 'chime';
        out.messages.push({ text: `RING ${6 - ringsLeft(state)} / 6  +50  (+5 fuel)`, kind: 'good' });
        if (ringsLeft(state) === 0) {
          state.index = 1;
          out.score += 25;
          out.messages.push({ text: 'RING RUN CLEAR — next: land on the FAR runway', kind: 'good' });
        }
        break;
      }
    }
  }

  if (mission.id === 'landing' && planeEvent && planeEvent.type === 'landed') {
    const smooth = Math.max(0, 60 - Math.abs(plane.vy)) | 0;
    out.score += 150 + smooth;
    out.sound = 'fanfare';
    plane.fuel = 100;
    state.index = 2;
    out.messages.push({ text: `LANDED — ${150 + smooth} points, tanks refilled`, kind: 'good' });
    out.messages.push({ text: 'Next: MAIL DROP over the striped zone', kind: 'good' });
  }

  if (mission.id === 'drop') {
    if (ctl.drop && plane.carryingMail && !state.parcel) {
      state.parcel = { x: plane.x, y: plane.y + 12, vx: plane.vx * 0.8, vy: plane.vy, t: 0 };
      plane.carryingMail = false;
      out.messages.push({ text: 'MAIL AWAY', kind: 'info' });
    }
    if (state.parcel) {
      const pc = state.parcel;
      pc.vy += 62 * dt;
      pc.x += pc.vx * dt;
      pc.y += pc.vy * dt;
      pc.t += dt;
      const gy = groundHeight(terrain, pc.x);
      if (pc.y >= gy - 4 || pc.y >= WORLD.seaLevel - 2) {
        if (pc.x >= DROP_ZONE.x0 && pc.x <= DROP_ZONE.x1 && pc.y < WORLD.seaLevel) {
          out.score += 100;
          out.sound = 'fanfare';
          state.done = true;
          out.messages.push({ text: 'MAIL DELIVERED +100 — ROUTE COMPLETE', kind: 'good' });
        } else {
          out.messages.push({ text: 'Parcel missed the zone — another sack is loaded', kind: 'warn' });
          plane.carryingMail = true;
        }
        state.parcel = null;
        state.parcelRest = 0;
      }
    }
  }

  return out;
}

/** The world point the pilot should fly toward next, for the edge arrow. */
export function nextObjective(state) {
  if (state.done) return null;
  const mission = currentMission(state);
  if (mission.id === 'rings') {
    const ring = nextRing(state);
    return ring ? { x: ring.x, y: ring.y, label: 'NEXT RING' } : null;
  }
  if (mission.id === 'landing') return { x: 6600, y: 652, label: 'FAR RUNWAY' };
  return { x: (DROP_ZONE.x0 + DROP_ZONE.x1) / 2, y: 560, label: 'DROP ZONE' };
}

function drawRing(ctx, ring, cam, time) {
  const sx = (ring.x - cam.x) * cam.zoom + cam.w / 2;
  const sy = (ring.y - cam.y) * cam.zoom + cam.h / 2;
  if (sx < -120 || sx > cam.w + 120 || sy < -120 || sy > cam.h + 120) return;
  const r = ring.r * cam.zoom;
  const pulse = 1 + Math.sin(time * 3) * 0.05;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = ring.collected ? 'rgba(120, 200, 120, 0.9)' : '#ffc93c';
  ctx.lineWidth = Math.max(3, 7 * cam.zoom);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 201, 60, 0.35)';
  ctx.lineWidth = Math.max(6, 14 * cam.zoom);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  if (ring.collected) {
    ctx.strokeStyle = '#78c878';
    ctx.lineWidth = Math.max(3, 6 * cam.zoom);
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, 0);
    ctx.lineTo(-r * 0.1, r * 0.4);
    ctx.lineTo(r * 0.5, -r * 0.4);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#3a2a00';
    ctx.font = `bold ${Math.max(11, 15 * cam.zoom)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦', 0, 1);
  }
  ctx.restore();
}

/** Rings, the drop zone, the falling parcel, and the off-screen objective arrow. */
export function drawMissions(ctx, cam, state, plane, time, terrain) {
  for (const ring of state.rings) drawRing(ctx, ring, cam, time);
  // The mail drop zone: a striped patch on the far island.
  const zx0 = (DROP_ZONE.x0 - cam.x) * cam.zoom + cam.w / 2;
  const zx1 = (DROP_ZONE.x1 - cam.x) * cam.zoom + cam.w / 2;
  if (zx1 > -40 && zx0 < cam.w + 40) {
    const gy = groundHeight(terrain, (DROP_ZONE.x0 + DROP_ZONE.x1) / 2);
    const sy = (gy - cam.y) * cam.zoom + cam.h / 2;
    ctx.fillStyle = '#e8b64c';
    ctx.fillRect(zx0, sy - 4 * cam.zoom, zx1 - zx0, 8 * cam.zoom);
    ctx.fillStyle = '#3a2a00';
    for (let x = DROP_ZONE.x0 + 12; x < DROP_ZONE.x1 - 8; x += 28) {
      const sx = (x - cam.x) * cam.zoom + cam.w / 2;
      ctx.fillRect(sx, sy - 4 * cam.zoom, 12 * cam.zoom, 8 * cam.zoom);
    }
    ctx.fillStyle = '#fff3c4';
    ctx.font = `bold ${Math.max(11, 14 * cam.zoom)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('MAIL DROP', (zx0 + zx1) / 2, sy - 16 * cam.zoom);
  }
  // The falling parcel.
  if (state.parcel) {
    const pc = state.parcel;
    const sx = (pc.x - cam.x) * cam.zoom + cam.w / 2;
    const sy = (pc.y - cam.y) * cam.zoom + cam.h / 2;
    ctx.fillStyle = '#8a6a3b';
    ctx.fillRect(sx - 8 * cam.zoom, sy - 7 * cam.zoom, 16 * cam.zoom, 14 * cam.zoom);
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(sx - 8 * cam.zoom, sy - 7 * cam.zoom, 16 * cam.zoom, 3 * cam.zoom);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(sx, sy - 12 * cam.zoom, 10 * cam.zoom, Math.PI, 0);
    ctx.fill();
  }
  // Edge arrow toward the next objective when it is off screen.
  const target = nextObjective(state);
  if (target && plane) {
    const tx = (target.x - cam.x) * cam.zoom + cam.w / 2;
    const ty = (target.y - cam.y) * cam.zoom + cam.h / 2;
    const margin = 60;
    if (tx < margin || tx > cam.w - margin || ty < margin || ty > cam.h - margin) {
      const ax = Math.max(margin, Math.min(cam.w - margin, tx));
      const ay = Math.max(margin, Math.min(cam.h - margin, ty));
      const ang = Math.atan2(ty - ay, tx - ax);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(255, 201, 60, 0.95)';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff3c4';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(target.label, ax, ay + 26);
    }
  }
}
