# Cold Bore

A stick-figure sniper game for the browser. Stealth and puzzle, not an action
shooter: read the brief, find the right person through the scope, wait for the
right moment, take one shot.

- 41 missions in 6 chapters, with an original story and five choices that
  change what happens later
- 16 rifles that really shoot differently, 11 scopes, 30 parts, 40 skins
- Real bullet flight: travel time, drop and wind, with scope markings that are
  true to scale
- Everything is earned by playing. No ads, no purchases, no accounts
- One self-contained page. All art is drawn in code and all sound is generated
  in code. There are no image or audio files

## Play

Open `index.html`, or the GitHub Pages address for this repo. On a phone, use
the browser's "Add to Home Screen" to run it full screen. Progress is saved in
the browser on that device.

Phone: drag anywhere to aim, zoom slider on the left (or pinch), HOLD BREATH,
FIRE, RELOAD. Computer: mouse to aim, wheel to zoom, left click to fire, Shift
to hold breath, R to reload, Q and E for the zero dial, Esc for the notebook.

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
| `src/10_sfx.js` | all sound, generated live |
| `src/11_gunart.js` | rifle artwork and skins |
| `src/20_game.js` | the game loop, the in-mission display, the controls |
| `src/3*_missions_*.js`, `src/38_story.js` | the campaign |
| `src/4*_ui*.js` | menus |
| `src/80_test.js` | the test bot (never runs during normal play) |

`docs/MISSIONS.md` explains how missions and scenes are written.
`docs/STORY.md` is the story outline.

## Tests

The tests drive a real headless browser with Playwright.

```
node test/matrix.js all 1,2,3   # the bot finishes every mission with every allowed rifle
node test/smoke.js aria 200     # every mission through the real loop with drawing on
node test/touch.js              # first mission played end to end with touch input
node test/desktop.js            # mouse and keyboard
node test/sheet.js 3            # picture sheet of a chapter, saved in shots/
```

Sound cannot be checked by a script. It was written carefully and has not been
verified by ear in these tests.
