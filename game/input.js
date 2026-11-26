// input.js — keyboard and mouse: throttle, pitch, the mail drop, gear, pause,
// restart and mute. Raw state lives here; main.js decides what it means.

export function createInput() {
  return {
    keys: new Set(),
    mouse: { x: 0, y: 0, down: false, downAt: 0 },
    dropQueued: false,
    gearQueued: false,
    restartQueued: false,
    pauseQueued: false,
    muteQueued: false,
    startQueued: false,
  };
}

const HANDLED = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
]);

/** Wire the listeners. onGesture runs on the first key or pointer press (audio). */
export function attachInput(input, canvas, onGesture) {
  let gestured = false;
  const gesture = () => {
    if (!gestured) {
      gestured = true;
      onGesture();
    }
  };
  window.addEventListener('keydown', (e) => {
    gesture();
    if (HANDLED.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    input.keys.add(e.code);
    if (e.code === 'Space') input.dropQueued = true;
    if (e.code === 'KeyG') input.gearQueued = true;
    if (e.code === 'KeyR') input.restartQueued = true;
    if (e.code === 'KeyP') input.pauseQueued = true;
    if (e.code === 'KeyM') input.muteQueued = true;
    if (e.code === 'Enter') input.startQueued = true;
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouse.down = false;
  });
  canvas.addEventListener('mousedown', (e) => {
    gesture();
    input.mouse.down = true;
    input.mouse.downAt = performance.now();
    input.mouse.x = e.clientX;
    input.mouse.y = e.clientY;
    input.startQueued = true;
  });
  window.addEventListener('mouseup', () => {
    // A quick press-and-release drops the mail; a long hold only steers.
    if (input.mouse.down && performance.now() - input.mouse.downAt < 300) {
      input.dropQueued = true;
    }
    input.mouse.down = false;
  });
  window.addEventListener('mousemove', (e) => {
    input.mouse.x = e.clientX;
    input.mouse.y = e.clientY;
  });
}

function held(input, ...codes) {
  return codes.some((c) => input.keys.has(c));
}

/**
 * Read this frame's controls and consume the one-shot queues.
 * pitch: -1 (nose up) .. +1 (nose down). throttleDelta: -1, 0 or +1.
 */
export function readControls(input) {
  const pitch =
    (held(input, 'KeyD', 'ArrowRight') ? 1 : 0) - (held(input, 'KeyA', 'ArrowLeft') ? 1 : 0);
  const throttleDelta =
    (held(input, 'KeyW', 'ArrowUp') ? 1 : 0) - (held(input, 'KeyS', 'ArrowDown') ? 1 : 0);
  const out = {
    pitch,
    throttleDelta,
    drop: input.dropQueued,
    gearToggle: input.gearQueued,
    restart: input.restartQueued,
    pause: input.pauseQueued,
    mute: input.muteQueued,
    start: input.startQueued,
    mouseDown: input.mouse.down,
    mouseX: input.mouse.x,
    mouseY: input.mouse.y,
  };
  input.dropQueued = false;
  input.gearQueued = false;
  input.restartQueued = false;
  input.pauseQueued = false;
  input.muteQueued = false;
  input.startQueued = false;
  return out;
}
