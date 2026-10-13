# Cold Bore

A stick-figure sniper game for the browser. Stealth and puzzle, not an action
shooter: read the brief, find the right person through the scope, wait for the
right moment, take one shot.

- 44 missions in 6 chapters, with an original story and five choices that
  change what happens later. Three of them can only be done by shooting through
  thin cover with armour-piercing rounds
- 16 rifles that really shoot differently, 11 scopes, 70 parts (most made for one
  rifle or one family), 94 skins. Locked skins can be looked at, not used
- A kill camera on the shot that finishes a contract: the bullet is followed from
  the muzzle to the target, then an X-ray of what it hits. Whether it comes out
  the other side depends on the calibre
- Ragdoll bodies: every fall is worked out from where the round hit and how hard
- A walkthrough for every mission, and guided runs: a coach shows when to wait,
  where to aim and when to fire (no caches from a guided run)
- A gun room that shows every rifle you own, with the one you have the most kills
  with in a lit glass case
- Made for a phone held sideways; the scope picture fills the screen
- Real bullet flight: travel time, drop and wind, with scope markings that are
  true to scale
- MARK: lock a target's distance so the hold and the aim marker stay right while
  you raise the scope for drop (everyone on Full help; rangefinder scopes for the rest)
- The Range never raises an alarm
- An app icon (an amber scope reticle) for "Add to Home Screen"
- Every rifle has its own sound, from its calibre, barrel, stock and action, and
  every muzzle brake, compensator, flash hider and suppressor changes it. The
  place shapes the echo: city, harbour, valley, mountain ridge
- Everything is earned by playing. No ads, no purchases, no accounts
- One self-contained page. All art is drawn in code. Sound is built on real
  recordings (packed into the page) and shaped in code for every rifle and part

## Play

Open `index.html`, or play it at https://mckouenkendall-design.github.io/Cold-Bore/ once GitHub Pages is switched on for this repo. On a phone, use
the browser's "Add to Home Screen" to run it full screen. Progress is saved in
the browser on that device.

Hold the phone sideways. Phone: drag anywhere to aim, zoom slider on the left (or pinch), HOLD BREATH,
FIRE, RELOAD. Computer: mouse to aim, wheel to zoom, left click to fire, Shift
to hold breath, R to reload, Q and E for the zero dial, Esc for the notebook.

## Tester mode (temporary)

Settings has a "Tester mode" switch that opens every rifle, part, scope, skin and contract
in a separate tester save. The real save is set aside untouched and comes back when the
switch goes off. It is there for trying things early and is meant to be removed before
the game is finished: delete `src/09b_tester.js`, the "Tester mode" group in `UI.settings`
(`src/42_ui_results.js`), the `Save.data.tester` check in `Progress.missionOpen`
(`src/39_progress.js`) and the `body.tester` rules at the end of `src/style.css`.

## Build

`index.html` is generated. Edit the files in `src/` and run:

```
node build.js
```

That joins every `src/*.js` (in filename order) and `src/style.css` into
`index.html`. Nothing else is needed to build.

## Source layout

| File | What it is |
|---|---|
| `src/00_util.js` | small helpers |
| `src/01_ballistics.js` | bullet flight: drag, gravity, wind |
| `src/02_arsenal.js` | rifles, scopes, parts and how they combine |
| `src/03_figures.js` | stick figures: poses, drawing, hit shapes |
| `src/04_scenekit.js`, `src/07*_scene*.js` | the building blocks and the nine locations |
| `src/05_sim.js` | the mission simulation: people, noise, witnesses, alarms |
| `src/06_view.js` | the scope picture and the reticles |
| `src/09_save.js`, `src/39_progress.js` | saving, rewards, caches |
| `src/10_sfx.js` | the sound engine: wiring, playing, the kill camera's sound, ambience and music |
| `src/10a_samples.js` | the recordings, packed by `tools/pack_sfx.py` (generated: do not edit) |
| `src/10b_sfxgen.js` | the sound generator in code: the building blocks, the coil gun, and stand-ins for when a recording is not ready |
| `src/10c_sfxrec.js` | sounds made from the recordings: every rifle and muzzle option, bolts, reloads, hits, explosions, thunder |
| `src/11_gunart.js` | rifle artwork and skins |
| `src/12_partart.js` | pictures of every part and the view through every scope |
| `src/13_ragdoll.js` | ragdoll physics for falling bodies (picture only, never gameplay) |
| `src/20_game.js` | the game loop, the in-mission display, the controls |
| `src/21_killcam.js` | the kill camera |
| `src/22_oracle.js` | runs a copy of the mission ahead to know where a shot will land |
| `src/23_coach.js` | the coach for guided runs, driven by each mission's own solution |
| `src/3*_missions_*.js`, `src/38_story.js` | the campaign |
| `src/4*_ui*.js` | menus, including the gun room (`43_ui_gallery.js`) |
| `src/80_test.js` | the test bot (never runs during normal play) |

`docs/MISSIONS.md` explains how missions and scenes are written.
`docs/STORY.md` is the story outline.
`docs/ART.md` is the art guide: what may and may not change when drawing.

## Tests

The tests drive a real headless browser with Playwright.

```
node test/matrix.js all 1,2,3   # the bot finishes every mission with every allowed rifle
node test/smoke.js aria 200     # every mission through the real loop with drawing on
node test/touch.js              # first mission played end to end with touch input
node test/desktop.js            # mouse and keyboard
node test/sheet.js 3            # picture sheet of a chapter, saved in shots/
node test/fingerprint.js        # proves art changes did not change any mission
node test/ui_wide.js            # every menu screen on a sideways phone
node test/cine2.js c1m1 fenwick t torso   # films the kill camera
ORACLE=1 node test/matrix.js all 1        # also checks every shot prediction
node test/guided.js all 1       # a bot that only follows the coach 3-stars every mission
node test/guidecheck.js         # checks the written walkthroughs
node test/notebook.js           # notebook scrolls by touch, messages close on a tap
node test/tester.js             # tester mode unlocks everything and gives the real save back
node test/gunroom.js            # the gun room at several sizes
node test/mark.js               # MARK keeps the read-outs right while aiming high; no alarms in the Range
node test/jumps.js              # nobody's position jumps between frames in any mission
node test/detail.js             # before/after pictures of scene detail
node test/icon.js               # renders the app icon PNGs into src/icons.json
node test/ragdoll.js calibre    # contact sheets of falling bodies
node test/sfx.js                # hits, misses, explosions, thunder, reloads, interface, kill camera beats
node test/sfx_guns.js           # every rifle with every muzzle option and load, compared pair by pair
node test/sfx_film.js           # the kill camera's sound, taken from real films
BEATS=1 node test/cine2.js c1m1 fenwick t torso   # also prints when each sound beat fires
```

## Sound

Sound is built on real recordings the owner picked from Pixabay (Pixabay Content License:
free to use inside a game, sold or not, no credit needed; the raw files may not be handed
out on their own). The cut recordings live in `sfx_src/` (kept out of git for that reason);
`python3 tools/pack_sfx.py` squeezes them into MP3s held as text in `src/10a_samples.js`,
so the page stays one file (about 1.5 MB of it is sound). The list, with where each came
from, is at the top of `tools/pack_sfx.py`.

| Recording | Used for |
|---|---|
| M24 shot | the base sniper shot: every .308-class rifle, and (higher, tighter) the lighter ones |
| AR-15 single shot | the Lark (5.56) and other people's carbines |
| Barrett .50 | the Anvil, blended under the magnums; its slow-motion version in the kill camera |
| suppressed rifle (two takes) | every suppressor and built-in can |
| M24 bolt | every bolt-action: five clicks laid out over the rifle's own cycle time |
| AR-15 magazine out, in, charging handle | reloads, laid out so the last sound lands as the reload finishes |
| bullet impact | hits on people; duller and dry for misses into dirt and snow |
| metal ricochet | metal; cut and pitched for stone, wood and body armour |
| glass, explosion, close thunder, a mid and three far rolls, rain (looped) | as named |

Every rifle and part still sounds different: the recording is the core, and each rifle has
its own pitch, two resonances and tilt, its stock's knock, barrel ring and thump; each muzzle
device its own change (ports, side blast, prongs, a hammerhead's second blast); each can its
own pitch, top and ring; subsonic loads lose the crack. The place colours the tail and adds its
echoes. Until a recording is decoded, or in a browser that cannot decode MP3, the sound made in
code (`src/10b_sfxgen.js`) stands in. The alarm no longer sounds a siren: a short low hit in the
music marks it.

Sound cannot be judged by a script, so the tests measure it instead: loudness the way the
ear weighs it, peak, low end, brightness, decay, and a pitch-and-time comparison of every
pair of rifle set-ups (none may be nearly the same, none may be more than 10 dB quieter
than the loudest rifle, nothing may clip, heavier calibres must measure heavier). They save
WAV files in `shots/sfx/` (`shots/sfx/guns/` for every rifle set-up) to listen to.
