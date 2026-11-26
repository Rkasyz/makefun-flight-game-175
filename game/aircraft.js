// aircraft.js — the mail plane: its state, the flight model, and how it is drawn.
// The model is arcade-simple on purpose: throttle sets a target speed, the nose
// sets the direction, lift grows with speed, and below stall speed the wing quits.

import { groundHeight, runwayAt, WORLD } from './terrain.js';

const GRAVITY = 34;
const STALL_SPEED = 55;
const CRUISE_SPEED = 115;
const MAX_PITCH = 0.55;

/** A fresh plane sitting on the home runway, engine idling. */
export function createPlane() {
  return {
    x: 420,
    y: 644,
    vx: 0,
    vy: 0,
    angle: 0,
    throttle: 0,
    fuel: 100,
    damage: 0,
    gear: true,
    carryingMail: true,
    landed: false,
    crashed: false,
    crashReason: '',
    propAngle: 0,
    outOfFuel: false,
  };
}

export function planeSpeed(p) {
  return Math.hypot(p.vx, p.vy);
}

/** Altitude in feet above the sea: one world pixel reads as three feet. */
export function planeAltitudeFt(p) {
  return Math.max(0, Math.round((WORLD.seaLevel - p.y) * 3));
}

/** Airspeed in knots, for the instruments. */
export function planeSpeedKt(p) {
  return Math.round(planeSpeed(p) * 0.45);
}

/**
 * Advance the plane one frame. ctl: { pitch (-1 up .. +1 down), throttleDelta, gearToggle }.
 * Returns an event for main.js, or null: { type: 'landed' | 'rough' | 'crash' | 'fuel-empty', text }.
 */
export function stepPlane(p, ctl, dt, terrain) {
  if (p.crashed) return null;

  // Inputs apply on the ground too: the takeoff roll needs throttle and pitch.
  if (ctl.gearToggle) p.gear = !p.gear;
  p.throttle = Math.max(0, Math.min(1, p.throttle + ctl.throttleDelta * 0.7 * dt));
  if (p.fuel <= 0) p.throttle = 0;
  p.angle = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, p.angle + ctl.pitch * 1.9 * dt));

  if (p.landed) {
    // Rolling on the strip: throttle spools the plane back up to flying speed,
    // and a pulled-back stick at rotation speed lifts it off again.
    p.vx += p.throttle * 130 * dt;
    p.vx *= Math.max(0, 1 - 0.5 * dt);
    p.x += p.vx * dt;
    p.y = groundHeight(terrain, p.x) - 4;
    p.vy = 0;
    if (p.throttle > 0.3 && p.vx > 150 && p.angle < -0.05) {
      p.landed = false;
      p.y -= 3;
      return { type: 'takeoff', text: 'AIRBORNE' };
    }
    if (Math.abs(p.vx) < 4 && p.throttle < 0.05) p.vx = 0;
    return null;
  }

  if (p.fuel <= 0) {
    if (!p.outOfFuel) {
      p.outOfFuel = true;
      return { type: 'fuel-empty', text: 'OUT OF FUEL — gliding, find a strip' };
    }
  }

  const speed = planeSpeed(p);
  const target = 30 + p.throttle * 170;
  const follow = 1.6 * dt;
  p.vx += (Math.cos(p.angle) * target - p.vx) * follow;
  p.vy += (Math.sin(p.angle) * target - p.vy) * follow;

  // Lift cancels gravity at cruise speed and fades to nothing at the stall.
  const lift = Math.min(1, speed / CRUISE_SPEED) ** 2;
  p.vy += GRAVITY * (1 - lift) * dt;

  // Stalled: the nose drops on its own until speed comes back.
  if (speed < STALL_SPEED && p.angle < MAX_PITCH) p.angle += 0.55 * dt;

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.propAngle += dt * (5 + p.throttle * 32);

  p.fuel = Math.max(0, p.fuel - (0.22 + p.throttle * 1.15) * dt);

  // Ceiling and the edges of the world.
  if (p.y < 60) {
    p.y = 60;
    p.vy = Math.max(0, p.vy);
  }
  if (p.x < 40) {
    p.x = 40;
    p.vx = Math.abs(p.vx) * 0.2;
  }
  if (p.x > WORLD.width - 40) {
    p.x = WORLD.width - 40;
    p.vx = -Math.abs(p.vx) * 0.2;
  }

  // Water first: the sea is at sea level, the ground under it is deeper.
  if (p.y >= WORLD.seaLevel - 2 && groundHeight(terrain, p.x) > WORLD.seaLevel) {
    p.crashed = true;
    p.crashReason = 'ditched in the sea';
    p.vx = 0;
    p.vy = 0;
    return { type: 'crash', text: 'DITCHED IN THE SEA' };
  }

  // Ground contact.
  const gy = groundHeight(terrain, p.x);
  if (p.y >= gy - 4) {
    const runway = runwayAt(p.x);
    const impact = p.vy;
    p.y = gy - 4;
    if (runway) {
      if (impact < 130 && speed < 210 && Math.abs(p.angle) < 0.22) {
        if (!p.gear) {
          p.damage += 25;
          p.vy = -impact * 0.3;
          return { type: 'rough', text: 'BELLY LANDING — gear was up, 25 damage' };
        }
        p.landed = true;
        p.vy = 0;
        p.angle = 0;
        return { type: 'landed', text: `TOUCHDOWN on ${runway.name} runway` };
      }
      if (impact > 260) {
        p.crashed = true;
        p.crashReason = 'hit the runway too hard';
        return { type: 'crash', text: 'CRASHED ON THE RUNWAY' };
      }
      p.damage += Math.round((impact - 130) * 0.35);
      p.vy = -impact * 0.3;
      return { type: 'rough', text: 'HARD LANDING — check the airframe' };
    }
    // Rough ground, not a strip.
    if (impact < 130 && speed < 150) {
      p.damage += 15;
      p.vx *= 0.3;
      p.vy = 0;
      p.landed = true;
      return { type: 'rough', text: 'ROUGH FIELD LANDING — 15 damage' };
    }
    p.crashed = true;
    p.crashReason = 'flew into the hillside';
    return { type: 'crash', text: 'CRASHED INTO THE HILLSIDE' };
  }

  if (p.damage >= 100) {
    p.crashed = true;
    p.crashReason = 'airframe gave out';
    return { type: 'crash', text: 'AIRFRAME GAVE OUT' };
  }
  return null;
}

/** Draw the plane at its world position, banked by its pitch. */
export function drawPlane(ctx, p, cam, time) {
  const sx = (p.x - cam.x) * cam.zoom + cam.w / 2;
  const sy = (p.y - cam.y) * cam.zoom + cam.h / 2;
  if (sx < -120 || sx > cam.w + 120 || sy < -120 || sy > cam.h + 120) return;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(p.angle);
  ctx.scale(cam.zoom, cam.zoom);

  // Landing gear.
  if (p.gear) {
    ctx.strokeStyle = '#2c2c30';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-6, 8);
    ctx.lineTo(-10, 17);
    ctx.moveTo(12, 8);
    ctx.lineTo(16, 17);
    ctx.stroke();
    ctx.fillStyle = '#1d1d20';
    ctx.beginPath();
    ctx.arc(-10, 19, 4.5, 0, Math.PI * 2);
    ctx.arc(16, 19, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wing (the low wing of a bush plane, seen from the side).
  ctx.fillStyle = '#b3372a';
  ctx.beginPath();
  ctx.ellipse(-2, 6, 26, 4.5, -0.08, 0, Math.PI * 2);
  ctx.fill();
  // Fuselage: cream with a red cheatline.
  ctx.fillStyle = '#f2e8d5';
  ctx.beginPath();
  ctx.moveTo(-34, -2);
  ctx.quadraticCurveTo(-30, -11, -12, -11);
  ctx.lineTo(18, -9);
  ctx.quadraticCurveTo(32, -7, 34, -1);
  ctx.quadraticCurveTo(30, 6, 12, 8);
  ctx.lineTo(-22, 8);
  ctx.quadraticCurveTo(-32, 6, -34, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c94f3d';
  ctx.fillRect(-30, 0, 58, 3.5);
  // Cabin windows, lit warm.
  ctx.fillStyle = '#ffd97a';
  ctx.beginPath();
  ctx.moveTo(-8, -9);
  ctx.lineTo(2, -9);
  ctx.lineTo(4, -3);
  ctx.lineTo(-8, -3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9fd4e8';
  ctx.beginPath();
  ctx.moveTo(6, -9);
  ctx.lineTo(14, -8);
  ctx.lineTo(15, -3);
  ctx.lineTo(6, -3);
  ctx.closePath();
  ctx.fill();
  // Tail.
  ctx.fillStyle = '#b3372a';
  ctx.beginPath();
  ctx.moveTo(-30, -4);
  ctx.lineTo(-38, -20);
  ctx.lineTo(-30, -20);
  ctx.lineTo(-24, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c94f3d';
  ctx.beginPath();
  ctx.ellipse(-30, -2, 12, 3, 0.25, 0, Math.PI * 2);
  ctx.fill();
  // Mail sack under the belly while the run is on.
  if (p.carryingMail) {
    ctx.fillStyle = '#8a6a3b';
    ctx.fillRect(-14, 8, 16, 9);
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(-14, 8, 16, 2.5);
  }
  // Spinning propeller.
  ctx.save();
  ctx.translate(35, -1);
  ctx.rotate(p.propAngle);
  ctx.strokeStyle = 'rgba(40, 36, 30, 0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(0, 15);
  ctx.moveTo(-15, 0);
  ctx.lineTo(15, 0);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#2c2c30';
  ctx.beginPath();
  ctx.arc(35, -1, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Blinking tail light.
  if (Math.floor(time * 2) % 2 === 0) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-38, -18, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
