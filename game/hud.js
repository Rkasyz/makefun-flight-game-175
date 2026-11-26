// hud.js — the instruments: altitude, speed, heading, fuel, damage and throttle,
// the mission banner, the warning lights, and the big cockpit panel for the
// close-up shot. Everything is drawn on the canvas so it shows in screenshots.

import { planeAltitudeFt, planeSpeedKt, planeSpeed } from './aircraft.js';
import { currentMission, ringsLeft } from './missions.js';

const PANEL = 'rgba(10, 18, 30, 0.72)';
const INK = '#eaf2f8';
const AMBER = '#ffc93c';
const GREEN = '#7ddc7d';
const RED = '#ff5a4e';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PANEL;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234, 242, 248, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = 'rgba(234, 242, 248, 0.4)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = INK;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 6, y + h / 2 + 0.5);
}

/** A round gauge with a needle, a label and a digital readout underneath. */
export function drawDial(ctx, x, y, r, label, valueText, frac, color) {
  ctx.fillStyle = PANEL;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234, 242, 248, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r - 5, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * Math.max(0, Math.min(1, frac)));
  ctx.stroke();
  const ang = Math.PI * 0.75 + Math.PI * 1.5 * Math.max(0, Math.min(1, frac));
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(ang) * (r - 12), y + Math.sin(ang) * (r - 12));
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + r * 0.45);
  ctx.fillStyle = INK;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(valueText, x, y + r * 0.72);
}

function compassStrip(ctx, cx, y, w, headingDeg) {
  panel(ctx, cx - w / 2, y - 16, w, 32);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, y - 16, w, 32);
  ctx.clip();
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = -60; d <= 60; d += 15) {
    const h = ((Math.round(headingDeg) + d) % 360 + 360) % 360;
    const x = cx + (d / 60) * (w / 2 - 8);
    const major = h % 30 === 0;
    ctx.fillStyle = major ? INK : 'rgba(234, 242, 248, 0.6)';
    if (major) ctx.fillText(String(h).padStart(3, '0'), x, y - 9);
    ctx.fillRect(x - 0.5, y + (major ? -1 : 3), 1, major ? 9 : 5);
  }
  ctx.restore();
  // The amber marker sits below the ticks and points up at the current heading.
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx, y + 5);
  ctx.lineTo(cx - 6, y + 14);
  ctx.lineTo(cx + 6, y + 14);
  ctx.closePath();
  ctx.fill();
}

function headingOf(plane) {
  return plane.vx >= 0 ? 90 : 270;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** The full HUD: flight instruments, mission banner, gauges and messages. */
export function drawHud(ctx, w, h, game) {
  const p = game.plane;
  const alt = planeAltitudeFt(p);
  const spd = planeSpeedKt(p);
  const hdg = headingOf(p);
  const vsi = Math.round(-p.vy * 180);

  // Top-left: the flight instruments.
  panel(ctx, 12, 12, 250, 92);
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = AMBER;
  ctx.fillText('ALT', 24, 34);
  ctx.fillText('SPD', 24, 58);
  ctx.fillText('HDG', 24, 82);
  ctx.fillStyle = INK;
  ctx.font = 'bold 17px monospace';
  ctx.fillText(`${alt} ft`, 78, 36);
  ctx.fillText(`${spd} kt`, 78, 60);
  ctx.fillText(`${String(hdg).padStart(3, '0')}°`, 78, 84);
  ctx.font = '12px monospace';
  ctx.fillStyle = vsi >= 0 ? GREEN : RED;
  ctx.fillText(`${vsi >= 0 ? '+' : ''}${vsi} fpm`, 168, 36);

  // Compass strip across the top centre.
  compassStrip(ctx, w / 2, 28, Math.min(420, w * 0.36), hdg);

  // Top-right: score and time.
  panel(ctx, w - 212, 12, 200, 92);
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', w - 200, 34);
  ctx.fillText('TIME', w - 200, 58);
  ctx.fillText('FUEL', w - 200, 82);
  ctx.fillStyle = INK;
  ctx.font = 'bold 17px monospace';
  ctx.fillText(String(game.score), w - 130, 36);
  ctx.fillText(formatTime(game.time), w - 130, 60);
  ctx.fillText(`${Math.round(p.fuel)}%`, w - 130, 84);

  // Mission banner under the compass.
  const mission = currentMission(game.missionState);
  const progress =
    mission.id === 'rings'
      ? `rings ${6 - ringsLeft(game.missionState)} / 6`
      : mission.id === 'landing'
        ? 'gear down, slow and level'
        : game.plane.carryingMail
          ? 'mail on board — drop it in the zone'
          : 'parcel away';
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#0a1220';
  ctx.fillText(`${mission.name} — ${mission.objective}`, w / 2 + 1, 129);
  ctx.fillStyle = '#fff3c4';
  ctx.fillText(`${mission.name} — ${mission.objective}`, w / 2, 128);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = AMBER;
  ctx.fillText(progress, w / 2, 148);

  // Bottom-left gauges.
  panel(ctx, 12, h - 84, 300, 72);
  bar(ctx, 24, h - 72, 276, 16, p.fuel / 100, p.fuel < 20 ? RED : GREEN, `FUEL ${Math.round(p.fuel)}%`);
  bar(ctx, 24, h - 50, 276, 16, 1 - p.damage / 100, p.damage > 60 ? RED : AMBER, `DAMAGE ${Math.round(p.damage)}%`);
  bar(ctx, 24, h - 28, 276, 16, p.throttle, '#7fb6cf', `THROTTLE ${Math.round(p.throttle * 100)}%  GEAR ${p.gear ? 'DN' : 'UP'}`);

  // Bottom-right: controls reminder.
  ctx.textAlign = 'right';
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(234, 242, 248, 0.85)';
  ctx.fillText('W/S throttle · A/D pitch · SPACE drop mail · G gear · P pause · R restart', w - 14, h - 16);

  // Warnings, flashing when they matter.
  const warnings = [];
  if (!p.landed && !p.crashed && planeSpeed(p) < 60 && p.y < 620) warnings.push('STALL');
  if (p.fuel < 20 && p.fuel > 0) warnings.push('LOW FUEL');
  if (!p.landed && !p.crashed && alt < 100 && p.vy > 90) warnings.push('TERRAIN');
  if (warnings.length > 0 && Math.floor(game.time * 3) % 2 === 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = RED;
    ctx.fillText(warnings.join('  ·  '), w / 2, 190);
  }

  // Message feed, newest on top, fading out.
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px sans-serif';
  let my = 220;
  for (const m of game.messages) {
    const alpha = Math.max(0, Math.min(1, m.left / 1.2));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = m.kind === 'good' ? '#b8f0b8' : m.kind === 'warn' ? '#ffc93c' : '#eaf2f8';
    ctx.fillText(m.text, w / 2, my);
    my += 24;
  }
  ctx.globalAlpha = 1;
}

/** The cockpit close-up: a big instrument panel under a zoomed chase view. */
export function drawCockpit(ctx, w, h, game) {
  const p = game.plane;
  const panelH = 240;
  const y0 = h - panelH;
  const grad = ctx.createLinearGradient(0, y0, 0, h);
  grad.addColorStop(0, '#232c38');
  grad.addColorStop(1, '#10161f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y0, w, panelH);
  ctx.strokeStyle = 'rgba(234, 242, 248, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y0 + 1);
  ctx.lineTo(w, y0 + 1);
  ctx.stroke();
  // Rivets along the panel's top edge.
  ctx.fillStyle = 'rgba(234, 242, 248, 0.35)';
  for (let x = 16; x < w; x += 42) {
    ctx.beginPath();
    ctx.arc(x, y0 + 12, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const cy = y0 + panelH / 2 + 8;
  const alt = planeAltitudeFt(p);
  const spd = planeSpeedKt(p);
  drawDial(ctx, w * 0.2, cy, 74, 'ALTITUDE', `${alt} FT`, Math.min(1, alt / 2000), '#7ddc7d');
  drawDial(ctx, w * 0.42, cy, 74, 'AIRSPEED', `${spd} KT`, Math.min(1, spd / 200), '#7fb6cf');
  drawDial(ctx, w * 0.64, cy, 74, 'HEADING', `${String(headingOf(p)).padStart(3, '0')}°`, headingOf(p) / 360, AMBER);
  // Fuel and throttle on the right of the panel.
  const fx = w * 0.82;
  ctx.fillStyle = INK;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FUEL', fx, cy - 52);
  bar(ctx, fx, cy - 44, 150, 18, p.fuel / 100, p.fuel < 20 ? RED : GREEN, '');
  ctx.fillText('THROTTLE', fx, cy - 8);
  bar(ctx, fx, cy, 150, 18, p.throttle, '#7fb6cf', '');
  ctx.fillText(`GEAR ${p.gear ? 'DOWN' : 'UP'}`, fx, cy + 44);
  ctx.fillText(`SCORE ${game.score}`, fx, cy + 66);
}
