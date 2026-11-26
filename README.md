# SKY COURIER — Island Mail Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/Rkasyz/makefun-flight-game-175/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/Rkasyz/makefun-flight-game-175/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

An entry for [Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057) on make.fun.

A 2D canvas bush-plane game. You are the mail pilot of a little island chain:
thread six gold rings over the sea, land on the far runway, then drop the mail
over the striped zone — before the fuel runs out.

## What it is

- **Three missions, in order:** Ring Run (6 rings, +50 each, +5 fuel each),
  Island Landing (gentle, gear down, +150), Mail Drop (parcel into the
  striped zone, +100). Finish all three to complete the route.
- **Real flight feel:** throttle and pitch discipline matter — too slow and the
  plane stalls and the nose drops; too fast and the landing hurts. Fuel burns
  with throttle, hard landings add damage, and the sea is not a runway.
- **Instruments that are flown:** altitude, speed, heading, vertical speed,
  fuel, damage and throttle gauges, a compass strip, warnings for STALL,
  LOW FUEL and TERRAIN, and a big cockpit panel in the close-up view.
- **One consistent look:** a seeded island chain — sea, hills, pines, a town,
  a lighthouse, two grass strips — drawn the same way every run.
- **Sound, synthesized:** an engine hum that follows the throttle, chimes for
  rings, a fanfare for finished missions, a thud for hard landings. No audio
  files. Press M to mute.

## Controls

| Key | Action |
| --- | --- |
| W / ↑, S / ↓ | Throttle up / down |
| A / ←, D / → | Pitch up / down |
| Mouse hold | Steer the nose toward the pointer |
| SPACE or quick click | Drop the mail |
| G | Raise / lower the gear |
| P | Pause |
| R | Restart |
| M | Mute |

## How to run

No build step, no network. Serve the `game/` folder with any static file
server and open `index.html` in a desktop browser — for example, from inside
`game/`, start a local static server on port 8080 and open the page it serves.

Screenshot scenes (real playable states, no input needed):

- `?shot=1` — takeoff on the home runway
- `?shot=2` — cruise over the sea with the rings ahead
- `?shot=3` — landing approach on the far runway
- `?shot=4` — cockpit / instruments close-up

## Handing it in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
into the output directory and writes `dossier.json` there with the vendored
make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `game/index.html` — page shell and canvas
- `game/main.js` — loop, state machine, camera, screenshot scenes
- `game/terrain.js` — seeded island world and its drawing
- `game/aircraft.js` — plane physics and drawing
- `game/missions.js` — rings, landing, mail drop, scoring
- `game/hud.js` — instruments, gauges, warnings, cockpit panel
- `game/audio.js` — synthesized sounds (Web Audio)
- `game/input.js` — keyboard and mouse
- `vendor/makefun-game.ts` — make.fun dossier library (vendored, unchanged)
