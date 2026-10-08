# Cold Bore art guide

Everyone drawing for this game reads this first. It says what the owner asked for, how
the picture is built, what you may and may not change, and how to check your work.

## What the owner said

After playing the first version on his phone:

> I want to add much, much more detail, obviously not photorealistic. Still, it's still a
> game. It's still on theme, but with much more detail to the characters in the game and
> the map of the game. For example, when somebody's under a lamp, it lights them up. It's
> very hot and cold, black and white. They're either fully lit up or they're not. Even
> when they're halfway in the light, I don't want to add ray tracing, but it should be
> smooth. It's just animations that don't seem very smooth. There's this guy holding a
> green duffel bag, and it's basically just a green oval that he is holding with the end
> of his hand. It just doesn't look good. It's not clean, and it's not detailed. I want
> it to be detailed.

He plays on a phone held sideways (about 844 x 390 CSS pixels, drawn at 2x or 3x), where
the scope picture now fills the whole screen. He zooms in a lot. So detail has to hold up
when one person is 150 to 300 pixels tall and one window is 200 pixels wide, and the
picture must still read cleanly at low zoom when a person is 20 pixels tall.

The style stays: flat vector shapes, stick-figure people, strong silhouettes, a limited
palette per scene. "More detail" means more things to look at and better-made things,
not gradients on everything. Think of a well-made paper diorama lit by real lamps.

## How the picture is built

- A scene is a stack of flat planes at real distances (`S.plane(z)`), drawn far to near.
  Each plane has `items` (things to draw), `solids` (rectangles that stop bullets),
  `openings` (windows and gaps). See the header of `src/04_scenekit.js`.
- An item is `{ x0, x1, layer, draw(ctx, env) }`. `layer` 0 is drawn behind the people on
  that plane, 1 is drawn just after the people who are indoors (window frames), 2 is
  drawn in front of everybody. Units are metres, y is up.
- `env` tells a draw function about the current view:
  - `env.s` pixels per metre on this plane right now. `env.px` is `1 / env.s`, the size of
    one screen pixel in metres. Use these to choose a level of detail.
  - `env.x0, env.x1, env.y0, env.y1` the part of the plane that is on screen. Skip what is
    outside.
  - `env.t` seconds, for animation. `env.wind` metres per second, signed.
  - `env.nv` true when a night-vision scope is fitted.
  - `env.text(ctx, str, x, y, size, col, align, glow)` draws lettering.
- Colour: always pass scenery colours through `S.tone(hex, P)` so they take the time of
  day and the distance haze. `S.tone(hex, P, true)` is for things that give off their own
  light (lit windows, signs, screens).
- Light: `S.isLit(zone, x)` is the game rule (can a guard see a body here). It is on or
  off and you must not change it. `S.lightAt(zone, x)` is the same light as a smooth
  number for drawing: 1 near a lamp, about 0.2 at the edge where `isLit` flips, 0 a
  little further out. It returns `{ l, dx, h, col }` where `dx` says which side the lamp
  is on. Anything that shows light (pools on the ground, the glow on a wall, how bright a
  person is) should agree with that falloff, so what the player sees matches what the
  guards can see.
- People are drawn by `drawFigure(ctx, A, env)` in `src/03_figures.js`.

## Rules that must not be broken

1. **Never change what a mission is.** Art is art. Do not move, add, remove or resize any
   `P.solid`, `P.open`, `S.obj`, lamp, prop, plane distance, zone name, ground height, or
   any value a returned handle exposes. Do not change which rooms are lit. Do not change
   how big a person or a car is or where their hit shapes are.
   - Scenes are built with seeded random numbers. If you draw one extra number from an
     existing stream (`R`, `S.rng`, `decoR` and so on) every number after it changes, and
     with it which windows are lit. For new decoration make your own stream:
     `const D = makeRng(someNewSeed)`.
   - `NODE_PATH=/opt/npm-tools/node_modules node test/fingerprint.js` reduces the
     gameplay of every mission to a number and compares it with the recorded one. It must
     print "all 85 fingerprints match" when you are done. If it does not, you changed
     gameplay: find it and undo it.
2. **Nothing that looks like cover unless it is cover.** If you add something a person
   could plausibly hide behind (a van, a wall, a stack of crates) in front of where
   people stand, players will expect it to stop bullets and block sight, and it will not.
   Put new detail on surfaces (walls, ground, roofs, sky), behind the people, or make it
   obviously thin (a pole, a cable, a railing).
3. **Things players are told to look for must stay unmistakable.** Missions say "red hat
   band", "yellow raincoat", "white hard hat and a clipboard", "the lamp", "the hook".
   Those must be at least as easy to pick out as before, in daylight and at night.
4. **Speed.** Every draw function runs every frame on a phone.
   - Skip anything off screen (`env.x0/x1`).
   - Choose detail by size: if a detail would be smaller than about 1.5 screen pixels
     (`size < env.px * 1.5`), do not draw it. Typical tiers: `env.s < 3` far or zoomed
     out (shapes only), `3..10` medium, `> 10` close (full detail).
   - Do not use `ctx.filter` (not available on older iPhones) or `shadowBlur` (very slow
     on phones). For a glow, use a radial gradient with `globalCompositeOperation =
     'lighter'`. Create gradients only for things that are on screen and big enough to
     matter, and prefer one gradient over many.
   - Batch: one `beginPath`, many shapes, one `fill`, when the colour is the same.
   - Precompute anything random or expensive once when the scene is built, not per frame.
   - Measure: `WIDE=1 NODE_PATH=/opt/npm-tools/node_modules node test/smoke.js aria 120`
     prints milliseconds per frame for every mission (headless, 844 x 390). Before the
     art upgrade the numbers were 3.5 to 8.5. A scene may cost up to about twice what it
     did, and nothing should go over about 14.
5. **Write for the reader.** Plain English comments. Never use an em dash anywhere, in
   code, comments or text. No brand names.

## What "more detail" should include

Surfaces: brick courses with an occasional off-colour brick, mortar, concrete panel seams,
stains under sills and pipes, peeling paint, rust streaks, wood grain, corrugation,
rivets, weld seams, road wear, patched tarmac.

Architecture: cornices, lintels and sills, downpipes and gutters, vents, cables, alarm
boxes, satellite dishes, door frames and steps, letter boxes, shop displays you can
make out, signs, posters, a little graffiti, awnings with scalloped edges and shade
beneath, balcony planters, washing lines, different curtains, furniture and plants
inside lit windows, a television flickering in one, reflections on glass.

Ground: kerbs, paving joints, drain covers, puddles (which mirror lamp light at night or
in rain), painted markings, litter, leaves, tyre marks.

Light and shade: soft pools under lamps that fade exactly the way `S.lightAt` does, lit
windows spilling a little light onto the wall around them, neon that tints nearby
surfaces, contact shadows under cars and crates, a band of shade under eaves and
awnings, a gentle top-to-bottom shade on every big face.

Depth and sky: haze by distance (already in `S.tone`), layered clouds, a moon worth
looking at, stars that twinkle, far lights that blink, smoke and steam.

Life: flags, swaying cables, flickering neon, moving water, blinking beacons, a curtain
that moves, birds on a wire. Small, cheap, and never something a player could mistake
for a person or a target.

## How to check your work

- `node build.js` builds `index.html` from `src/`.
- Look at it. `NODE_PATH=/opt/npm-tools/node_modules TOUCH=1 node test/tour.js <mission>
  <gun> "<time>@<target>@<zoom>,..." 0 844 390` fast-forwards a mission and screenshots
  the scope pointed at an actor id, `o:<objectId>`, or `x;y` in metres, at a given zoom,
  into `shots/`. Take low, middle and high zoom, day and night scenes, lit and unlit
  spots. Open the pictures with the Read tool and be critical. Compare with a screenshot
  taken before your change.
- `NODE_PATH=/opt/npm-tools/node_modules node test/fingerprint.js` must match.
- `NODE_PATH=/opt/npm-tools/node_modules node test/matrix.js <mission ids> 1` must show
  zero fails for the missions that use what you changed (use `all` if unsure).
- `WIDE=1 ... node test/smoke.js aria 120` for speed and for errors.
