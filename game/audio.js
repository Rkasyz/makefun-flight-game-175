// audio.js — every sound is synthesized with the Web Audio API: an engine hum
// that follows the throttle, and short effects for rings, landings and crashes.
// No audio files, no network, and silence until the pilot first touches a key.

export function createAudio() {
  return { ac: null, master: null, engine: null, engineGain: null, muted: false };
}

/** Create (or resume) the audio context. Call only from a user gesture. */
export function ensureAudio(a) {
  if (a.ac) {
    if (a.ac.state === 'suspended') a.ac.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    a.ac = new AC();
    a.master = a.ac.createGain();
    a.master.gain.value = 0.5;
    a.master.connect(a.ac.destination);
    // The engine: a low sawtooth plus a sine an octave up, through one gain.
    const osc1 = a.ac.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 55;
    const osc2 = a.ac.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 110;
    const low = a.ac.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 420;
    a.engineGain = a.ac.createGain();
    a.engineGain.gain.value = 0;
    osc1.connect(low);
    osc2.connect(low);
    low.connect(a.engineGain);
    a.engineGain.connect(a.master);
    osc1.start();
    osc2.start();
    a.engine = [osc1, osc2];
  } catch {
    a.ac = null;
  }
}

/** The engine follows throttle and speed; silent while muted or unstarted. */
export function setEngine(a, throttle, speed) {
  if (!a.ac || !a.engine || a.muted) {
    if (a.engineGain) a.engineGain.gain.value = 0;
    return;
  }
  const freq = 46 + throttle * 58 + speed * 0.12;
  const t = a.ac.currentTime;
  a.engine[0].frequency.setTargetAtTime(freq, t, 0.08);
  a.engine[1].frequency.setTargetAtTime(freq * 2, t, 0.08);
  a.engineGain.gain.setTargetAtTime(0.015 + throttle * 0.05, t, 0.1);
}

function tone(a, freq, startAt, dur, type, vol) {
  if (!a.ac || !a.master || a.muted) return;
  try {
    const osc = a.ac.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = a.ac.createGain();
    const t0 = a.ac.currentTime + startAt;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(a.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    // Audio is decoration; never let it break the game.
  }
}

/** Two bright notes when the plane threads a ring. */
export function chime(a) {
  tone(a, 659, 0, 0.18, 'sine', 0.22);
  tone(a, 988, 0.09, 0.3, 'sine', 0.2);
}

/** A short rising arpeggio for a finished mission or route. */
export function fanfare(a) {
  [523, 659, 784, 1047].forEach((f, i) => tone(a, f, i * 0.11, 0.32, 'triangle', 0.2));
}

/** A low thud for a hard landing or a crash. */
export function thud(a) {
  if (!a.ac || !a.master || a.muted) return;
  try {
    const osc = a.ac.createOscillator();
    osc.type = 'sine';
    const t0 = a.ac.currentTime;
    osc.frequency.setValueAtTime(130, t0);
    osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.3);
    const g = a.ac.createGain();
    g.gain.setValueAtTime(0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
    osc.connect(g);
    g.connect(a.master);
    osc.start(t0);
    osc.stop(t0 + 0.4);
  } catch {
    // Audio is decoration; never let it break the game.
  }
}

/** Flip the mute switch; returns the new muted state for the HUD. */
export function toggleMute(a) {
  a.muted = !a.muted;
  if (a.muted && a.engineGain) a.engineGain.gain.value = 0;
  return a.muted;
}

/** A soft click for menus and the mail drop. */
export function clickSound(a) {
  tone(a, 880, 0, 0.07, 'square', 0.08);
}
