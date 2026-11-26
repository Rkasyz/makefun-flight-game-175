// main.js — Sky Courier: boots the game, runs the loop, and owns the state
// machine (title, flying, paused, crashed, route complete) plus the four
// screenshot scenes (?shot=1..4), each a real playable state on load.

import { WORLD, makeTerrain, drawTerrain } from './terrain.js';
import { createPlane, stepPlane, drawPlane, planeSpeed } from './aircraft.js';
import {
  createMissionState,
  currentMission,
  updateMissions,
  drawMissions,
  ringsLeft,
} from './missions.js';
import { drawHud, drawCockpit } from './hud.js';
import {
  createAudio,
  ensureAudio,
  setEngine,
  chime,
  fanfare,
  thud,
  clickSound,
  toggleMute,
} from './audio.js';
import { createInput, attachInput, readControls } from './input.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const terrain = makeTerrain();
const audio = createAudio();
const input = createInput();
attachInput(input, canvas, () => ensureAudio(audio));

const game = {
  mode: 'title',
  plane: createPlane(),
  missionState: createMissionState(),
  score: 0,
  time: 0,
  clock: 0,
  messages: [],
  camera: { x: 420, y: 560, zoom: 1, w: 1280, h: 800 },
  shot: 0,
  shotZoom: 1,
  overText: '',
  overReason: '',
};

function pushMessage(text, kind) {
  game.messages.unshift({ text, kind: kind ?? 'info', left: 5 });
  if (game.messages.length > 4) game.messages.length = 4;
}

/** Read ?shot=1..4 and put the game straight into that playable scene. */
function applyShot() {
  const n = Number(new URLSearchParams(window.location.search).get('shot'));
  if (n < 1 || n > 4) return;
  game.shot = n;
  const p = game.plane;
  game.mode = 'flying';
  if (n === 1) {
    // Takeoff: on the home runway, engine spooled, strip ahead.
    p.x = 420;
    p.y = 644;
    p.throttle = 0.55;
    p.gear = true;
    game.shotZoom = 1.4;
    game.camera.x = 560;
    game.camera.y = 560;
  } else if (n === 2) {
    // Cruise: mid-air over the sea with the rings ahead.
    p.x = 3300;
    p.y = 420;
    p.vx = 140;
    p.vy = -6;
    p.angle = -0.08;
    p.throttle = 0.75;
    p.fuel = 82;
    game.missionState.rings[0].collected = true;
    game.missionState.rings[1].collected = true;
    game.score = 100;
    game.shotZoom = 1;
    game.camera.x = 3450;
    game.camera.y = 420;
  } else if (n === 3) {
    // Final approach: low over the sea, gear down, far runway ahead.
    p.x = 5900;
    p.y = 560;
    p.vx = 150;
    p.vy = 26;
    p.angle = 0.12;
    p.throttle = 0.5;
    p.fuel = 64;
    p.gear = true;
    game.missionState.rings.forEach((r) => {
      r.collected = true;
    });
    game.missionState.index = 1;
    game.score = 175;
    game.shotZoom = 1.25;
    game.camera.x = 6050;
    game.camera.y = 560;
  } else {
    // Cockpit close-up: zoomed chase view with the big instrument panel.
    p.x = 3600;
    p.y = 400;
    p.vx = 150;
    p.vy = -4;
    p.angle = -0.05;
    p.throttle = 0.7;
    p.fuel = 76;
    game.missionState.rings[0].collected = true;
    game.missionState.rings[1].collected = true;
    game.missionState.rings[2].collected = true;
    game.score = 150;
    game.shotZoom = 1.7;
    game.camera.x = 3720;
    game.camera.y = 400;
    game.camera.zoom = 1.7;
  }
}

function resetGame() {
  game.plane = createPlane();
  game.missionState = createMissionState();
  game.score = 0;
  game.time = 0;
  game.messages = [];
  game.mode = 'flying';
  game.camera.x = 560;
  game.camera.y = 560;
  game.camera.zoom = 1;
  game.shotZoom = 1;
  pushMessage('RING RUN — fly through all 6 rings', 'info');
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.camera.w = w;
  game.camera.h = h;
}
window.addEventListener('resize', resize);
resize();

function updateCamera(dt) {
  const cam = game.camera;
  const p = game.plane;
  const targetZoom = game.shotZoom;
  cam.zoom += (targetZoom - cam.zoom) * Math.min(1, 2 * dt);
  const tx = p.x + p.vx * 0.35;
  const ty = p.y - 30;
  const k = 1 - Math.exp(-4 * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  const halfW = cam.w / 2 / cam.zoom;
  const halfH = cam.h / 2 / cam.zoom;
  cam.x = Math.max(halfW - 200, Math.min(WORLD.width - halfW + 200, cam.x));
  cam.y = Math.max(140, Math.min(680 - halfH + 200, cam.y));
}

function render() {
  const cam = game.camera;
  const w = cam.w;
  const h = cam.h;
  drawTerrain(ctx, cam, terrain, game.clock);
  drawMissions(ctx, cam, game.missionState, game.plane, game.clock, terrain);
  drawPlane(ctx, game.plane, cam, game.clock);
  if (game.shot === 4) {
    drawCockpit(ctx, w, h, game);
  } else {
    drawHud(ctx, w, h, game);
  }
  if (game.mode === 'title') drawTitle(w, h);
  if (game.mode === 'paused') drawCenter(w, h, 'PAUSED', 'Press P to keep flying');
  if (game.mode === 'over') {
    drawCenter(w, h, game.overText, `${game.overReason} — score ${game.score} — press R to fly again`);
  }
  if (game.mode === 'complete') {
    drawCenter(
      w,
      h,
      'ROUTE COMPLETE',
      `All three jobs done — score ${game.score} in ${Math.floor(game.time / 60)}:${String(Math.floor(game.time % 60)).padStart(2, '0')} — press R to fly again`,
    );
  }
}

function drawCenter(w, h, title, sub) {
  ctx.fillStyle = 'rgba(8, 14, 24, 0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff3c4';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(title, w / 2, h / 2 - 10);
  ctx.fillStyle = '#eaf2f8';
  ctx.font = '18px sans-serif';
  ctx.fillText(sub, w / 2, h / 2 + 28);
}

function drawTitle(w, h) {
  ctx.fillStyle = 'rgba(8, 14, 24, 0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff3c4';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SKY COURIER', w / 2, h * 0.3);
  ctx.fillStyle = '#ffc93c';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('— ISLAND MAIL RUN —', w / 2, h * 0.3 + 40);
  ctx.fillStyle = '#eaf2f8';
  ctx.font = '18px sans-serif';
  ctx.fillText('Fly the mail plane across the islands: thread the rings, land on the far runway,', w / 2, h * 0.3 + 88);
  ctx.fillText('then drop the mail over the striped zone. Watch your fuel — and the hills.', w / 2, h * 0.3 + 114);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#7ddc7d';
  ctx.fillText('W / S throttle      A / D pitch      SPACE or click drops the mail      G gear      P pause      R restart', w / 2, h * 0.3 + 158);
  ctx.fillStyle = '#ffc93c';
  ctx.font = 'bold 20px sans-serif';
  const blink = Math.floor(game.clock * 1.5) % 2 === 0;
  if (blink) ctx.fillText('Press ENTER or click to fly', w / 2, h * 0.3 + 204);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (game.mode !== 'paused') game.clock += dt;
  const ctl = readControls(input);

  if (ctl.mute) {
    const muted = toggleMute(audio);
    pushMessage(muted ? 'SOUND OFF' : 'SOUND ON', 'info');
  }
  if (ctl.restart && game.mode !== 'title') {
    resetGame();
    clickSound(audio);
  }

  if (game.mode === 'title') {
    if (ctl.start) {
      game.mode = 'flying';
      ensureAudio(audio);
      clickSound(audio);
      pushMessage('RING RUN — fly through all 6 rings', 'info');
      ctl.drop = false;
    }
  } else if (ctl.pause && (game.mode === 'flying' || game.mode === 'paused')) {
    game.mode = game.mode === 'flying' ? 'paused' : 'flying';
  }

  if (game.mode === 'flying' && game.shot === 0) {
    game.time += dt;
    // Mouse hold steers the nose toward the pointer; keys steer otherwise.
    if (ctl.mouseDown) {
      const cam = game.camera;
      const planeSy = (game.plane.y - cam.y) * cam.zoom + cam.h / 2;
      ctl.pitch = Math.max(-1, Math.min(1, (planeSy - ctl.mouseY) / 140));
    }
    const planeEvent = stepPlane(game.plane, ctl, dt, terrain);
    const mission = updateMissions(game.missionState, game.plane, ctl, dt, planeEvent, terrain);
    game.score += mission.score;
    for (const m of mission.messages) pushMessage(m.text, m.kind);
    if (mission.sound === 'chime') chime(audio);
    if (mission.sound === 'fanfare') fanfare(audio);
    if (planeEvent) {
      pushMessage(planeEvent.text, planeEvent.type === 'crash' ? 'warn' : 'good');
      if (planeEvent.type === 'crash') {
        thud(audio);
        game.mode = 'over';
        game.overText = planeEvent.text;
        game.overReason = game.plane.crashReason;
      } else if (planeEvent.type === 'rough') {
        thud(audio);
      } else if (planeEvent.type === 'takeoff') {
        clickSound(audio);
      }
    }
    if (game.missionState.done) {
      game.mode = 'complete';
      fanfare(audio);
    }
    setEngine(audio, game.plane.throttle, planeSpeed(game.plane));
    for (const m of game.messages) m.left -= dt;
    game.messages = game.messages.filter((m) => m.left > 0);
    updateCamera(dt);
  }

  if (game.mode === 'flying' && game.shot !== 0) {
    // Screenshot scenes hold their pose: the world stays alive (prop, clouds)
    // but the plane does not fly away before the shot is taken. The zoom
    // eases in, and the camera is clamped inside the world so no frame shows
    // the empty strip beyond the first or last island.
    const cam = game.camera;
    cam.zoom += (game.shotZoom - cam.zoom) * Math.min(1, 2 * dt);
    const halfW = cam.w / 2 / cam.zoom;
    const halfH = cam.h / 2 / cam.zoom;
    cam.x = Math.max(halfW, Math.min(WORLD.width - halfW, cam.x));
    cam.y = Math.max(140, Math.min(680 - halfH + 200, cam.y));
  }

  render();
  requestAnimationFrame(frame);
}

applyShot();
if (game.mode === 'title') {
  // The title screen sits over the live runway scene.
  game.camera.x = 560;
  game.camera.y = 560;
}
// Draw one frame right away so a screenshot on load already shows the game.
render();
requestAnimationFrame(frame);
