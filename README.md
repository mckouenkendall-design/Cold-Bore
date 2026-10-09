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
- Every rifle has its own sound, from its calibre, barrel, stock and action, and
  every muzzle brake, compensator, flash hider and suppressor changes it. The
  place shapes the echo: city, harbour, valley, mountain ridge
- Everything is earned by playing. No ads, no purchases, no accounts
- One self-contained page. All art is drawn in code and all sound is made in
  code. There are no image or audio files

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
| `src/10b_sfxgen.js` | the sound generator: every rifle and muzzle option, hits, explosions, thunder, reloads, worked out sample by sample |
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
node test/ragdoll.js calibre    # contact sheets of falling bodies
node test/sfx.js                # hits, misses, explosions, thunder, reloads, interface, kill camera beats
node test/sfx_guns.js           # every rifle with every muzzle option and load, compared pair by pair
node test/sfx_film.js           # the kill camera's sound, taken from real films
BEATS=1 node test/cine2.js c1m1 fenwick t torso   # also prints when each sound beat fires
```

## Sound

Every sound is made in code; there are no audio files. Anything that does not change
while it plays (a rifle's report and action, reloads, hits, impacts, explosions, thunder,
the alarm, the interface) is worked out sample by sample by `src/10b_sfxgen.js` into a
buffer and then played. The rifle a mission is played with is worked out as the mission
starts (two takes of its shot, played in turn), the rest a piece at a time between frames.
The kill camera, ambience and music are built live because they follow the game.

A shot is made of layers: the striker falling; the bullet's crack and the whip of it going
away (only faster than sound); the muzzle blast with the rifle's own two resonances; the
gas hissing out; the boom; a deep thump driven so a phone still plays it; the barrel's
ring and the stock's knock; the action (a semi-automatic's carrier slams inside the
shot, a bolt is worked after it); the echoes of the place and the echo back from the
target area. A suppressor keeps the bullet's crack but leaks its own thump, tock and
ring; a subsonic load loses the crack.

No recordings are used. A search in October 2026 for gunshot, explosion and thunder
recordings with an explicit CC0 or public-domain licence that the build machine can
reach (npm, GitHub) found nothing usable; anything added later must be CC0 or public
domain, with its source and licence written next to it.

Sound cannot be judged by a script, so the tests measure it instead: loudness the way the
ear weighs it, peak, low end, brightness, decay, and a pitch-and-time comparison of every
pair of rifle set-ups (none may be nearly the same, none may be more than 10 dB quieter
than the loudest rifle, nothing may clip, heavier calibres must measure heavier). They save
WAV files in `shots/sfx/` (`shots/sfx/guns/` for every rifle set-up) to listen to. Nobody
has listened to them yet.
