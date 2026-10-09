# Cold Bore: how missions are built

This is the working guide for writing scenes and missions. Read it with
`src/31_missions_ch1.js` (seven finished missions) and `src/07_scenes.js`
(a finished location) open next to it. Those two files are the reference.

## 1. The big picture

- `node build.js` joins every `src/*.js` file (in filename order) into one
  self-contained `index.html`. All files share one scope, so helpers defined in
  an earlier file are plain globals in later ones. No imports.
- A **scene** is a stack of flat planes at real distances (metres) from the
  shooter. A **mission** is data: who is in the scene, what they do, what the
  rules are, and a script the test bot uses to prove it can be finished.
- `src/05_sim.js` runs the mission with no drawing or sound. `src/06_view.js`
  draws it. Missions never draw directly; scenes do.

Units: metres, seconds, metres per second. `x` is left/right, `y` is up
(ground is normally `y = 0`), `z` is distance away from the shooter's default
position. Scope angles are in mils (1 mil = 10 cm at 100 m).

## 2. Scenes

```js
const S = makeScene({ time: 'night', weather: 'rain', seed: 5, refZ: 300,
  exits: [-50, 50], bounds: { x0: -40, x1: 40, y0: -1.5, y1: 27 }, ambience: 'city' });
```
- `time`: `day | dawn | dusk | night | overcast | snow` (sets the palette, and
  whether lamps matter).
- `weather`: `clear | rain | storm | snow | fog`. Set `S.seeMul = 0.5` to make
  people see less far in fog. `fog: 2` in the options thickens distance haze.
- `refZ`: distance of the main target plane. Used for sound delay, scope
  limits and the start aim.
- `bounds`: the area (in metres, on the `refZ` plane) the scope may point at.
- `exits`: x positions panicking people run to.
- `ambience`: `city | harbour | wild | snow` (background sound). It also sets the
  echo of every shot: city slaps, harbour, a valley (`wild`), a mountain ridge
  (`snow`). Set `S.indoor = true` if the player fires from inside a room: shots
  then boom and ring like one. `groundMat` sets how the empty cases land.

Planes: `const P = S.plane(z, 'name')`. Far planes are drawn first.
- `P.add({ x0, x1, layer, draw(ctx, env) { ... } })` adds something to draw.
  `layer` 0 = behind people in rooms, 1 = in front of rooms but behind people in
  the open, 2 = in front of everyone on this plane.
- `P.solid(x, y, w, h, mat)` adds a rectangle that stops bullets. Materials:
  `wall` (stops; a rifle with punch 3 goes through one), `hard` (always stops),
  `thin` and `wood` (punch 1.4 goes through), `glasswall`, `leaf`, `grid`
  (bullets pass).
- `P.open({ x, y, w, h, room, glass, through })` adds a window or gap. People
  whose `room` matches are visible and hittable only through it. `glass:
  false` = open window. `through: true` = bullets carry on if nobody is hit
  (use it for roof lines and open-sided towers).
- Call `K.ground(S, P, {...})` (or `K.water`, or use `K.hills`) on the planes
  that have ground, otherwise there is nothing for a low shot to hit and
  nothing drawn below the horizon.

Inside `draw(ctx, env)` the canvas is already in metres with y up. `env` has
`t` (time), `wind`, `s` (pixels per metre), `px` (metres per pixel, use it for
minimum line widths), `x0`/`x1` (visible range, use it to skip off-screen
work), and `env.text(ctx, string, x, y, sizeInMetres, colour, align, glow)`
for lettering. Colours must go through `S.tone(hex, P)` so they darken at
night and fade with distance. Drawing helpers: `R4(ctx,x,y,w,h,fill)`,
`poly(ctx,[x,y,...],fill)`, `line(ctx,x1,y1,x2,y2,col,width,env)`,
`circ(ctx,x,y,r,fill)`, `mix`, `lighten`, `darken`, `rgba`.

### Kit pieces (all in `src/04_scenekit.js` and `src/07_scenes.js`)

| Call | What it makes |
|---|---|
| `K.ground(S,P,{y,col,edge,noEdge,stripes,mat})` | ground strip; `mat` `dirt/hard/snow/water` picks the impact effect |
| `K.water(S,P,{y,col})` | water with moving highlights |
| `K.skyline(S,z,{seed,hMin,hMax,x0,x1,cols})` | distant city, returns its plane |
| `K.mountains(S,z,{seed,h,col,snow,snowLine,base})` | jagged range |
| `K.hills(S,z,{seed,h,base,col,trees,rough})` | rolling ground, returns plane with `heightAt(x)` |
| `K.pine(S,P,x,h,{y,snow})`, `K.tree(S,P,x,h,{y,canopy})` | trees (trunks stop bullets) |
| `K.building(S,P,{x,w,floors,fh,id,style,wall,shop,door,spans,wins,tank,hut,antenna,parapet})` | wall with a grid of windows; returns `B` |
| `K.balcony(S,P,B,floor,col0,col1)` | returns `{x0,x1,y,zone}` |
| `K.fireEscape`, `K.watertank`, `K.chimney`, `K.flag`, `K.wire`, `K.neon` | dressing (flag and chimney smoke show the wind) |
| `K.billboard(S,P,x,y,w,h,'TEXT|LINE2',{base})` | blocks the view and thin rounds |
| `K.fence(S,P,x0,x1,h,{kind:'mesh'|'wood'|'wall'})` | mesh is see-through and shoot-through |
| `K.box(S,P,x,y,w,h,col,{ribs,band,text,solid,mat})`, `K.container` | crates, sheds, containers |
| `K.crane`, `K.tower`, `K.viaduct`, `K.bench`, `K.table`, `K.stall`, `K.fountain`, `K.steps` | props |
| `K.parked(S,P,kind,x,dir,col)` | a car that never moves |
| `K.lamp(S,P,x,h,zone,{id,reach})` | shootable light |
| `K.hang(S,P,x,yHook,kind,{id,floor,top})` | load on a hook: `crate piano sign ac pallet planter girder net boat` |
| `K.thing(S,P,kind,x,y,{id,...})` | shootable object, see section 5 |

Buildings: `B.floorY(f)`, `B.winX(col)`, `B.win(f,col)` (the opening),
`B.roofY`, `B.roofRoom`. Each window is its own room unless you merge them:
`spans: { 3: [[1, 3, 'count', true]] }` makes floor 3, columns 1 to 3, one lit
room called `<buildingId>:count`. Per-window overrides: `wins: { '3,2': {
open: true, blind: 0, lit: false, none: true, door: true, sill: 0.1, h: 2.3 }
}`.

A location file should export one function on `SCN` that builds the scene and
returns handles (`H`) including `S`, the planes, the buildings and placement
helpers such as `H.street(x)`. See `SCN.street`.

New kit pieces you need go in your own scene file (`K.myThing = function ...`).

## 3. A mission

```js
mission({
  id: 'c2m1', ch: 2, title: 'Tide Tables',
  range: 260,                       // rifles with less reach are not allowed
  needs: { glass: true },           // optional: quiet, silent, glass, rof, mag, pen
  follows: 'c1m7',                  // optional: play straight after this mission (see below)
  objective: 'One line, under 90 characters.',
  brief: 'Marlow speaking. 60 to 110 words.',
  intel: ['Two to five short facts the player needs.'],
  wind: { v: 3.5, gust: 1.5 },      // m/s. + blows left to right
  par: 1,                           // shots allowed for the "precise" star
  rules: { kill: ['t'] },
  vantages: [{ name, desc, eye: [x, y, z], windMul, tag }],
  look: [x, y],                     // where the scope points at the start
  setup(K, flags) { return SCN.docks({...}); },   // returns handles H (must include S)
  cast(H, flags) { return [ ...actors ]; },
  vehicles(H, flags) { return [ ...vehicles ]; },
  triggers(H, flags) { return [ ...triggers ]; },
  challenge: { id, text, test: (sim, res) => boolean },
  outcomes: [{ id, when: (sim, res) => boolean, set: { flagName: true }, text }],
  after: 'One or two lines from Marlow shown on the results screen.',
  solve: [ ...bot script ]  or  solve(H, st, flags, sim) { return [...]; },
  testFlags: [{}, { sparedReyes: true }],   // only if the mission reads flags
  reward: { cr: 1200, xp: 280 },
});
```
`brief`, `objective`, `intel`, `after` and `par` may be functions of `flags`.

Missions are played in the order they are registered. A mission written later
can take its place in the story with `follows: '<id>'` and still sit at the end
of its chapter's file, with the next free id (c3m8 follows c3m2). A contract a
player has already finished always stays open, so an old save never finds a
finished contract locked behind a new one.

`needs: { pen: 1.4 }` asks for punch enough to go through thin cover (see
section 8). Most rifles only get there with armour-piercing rounds, and the
loadout screen tells the player so. The test bot fits them by itself.

### Rules (`rules`)
`kill` (ids that must die), `destroy` (object ids that must be destroyed),
`protect` (ids that must live), `until` (an event name that must have happened),
`done(sim, H)` (custom extra condition), `time` (seconds, with `timeText`),
`strict` (any alarm before the job is done fails, with `strictText`),
`accidentOnly`, `noKills`, `noGuards`, `spare: [ids]`, `civFail` (default
true), `escapeOk`, `reserve` (spare rounds), `aftermath` (seconds the mission
keeps running after the objective, default 2.8), `blastAccident`, `boomQuiet`.

The mission is won when every objective holds and then `aftermath` seconds pass
without a fail. Stars: 1 = done; +1 "clean" = no alarm and no panicked
bystander at any point; +1 "precise" = shots fired <= `par`.

### People
```js
Object.assign(H.street(12), {         // a placement: { plane, x, y, zone, room, behind }
  id: 't', role: 'target',            // target | civ | guard | hostile | vip | hostage
  face: -1, anim: 'smoke',
  look: { hat: 'fedora', hatCol, hatBand, coat, long, bag: 'case', glasses: 'shades', ... },
  routine: [['walk', 14], ['wait', 9, 'smoke'], ['loop']],
  flee: [['run', -50], ['gone']],     // optional: what they do when alarmed
  escapeText: 'Shown if this target gets away.', failText: 'Shown if the player wrongly shoots this person.',
})
```
Roles: `civ` and `vip` must never be hit (mission fails). `hostage` likewise.
`guard` may be shot unless `noGuards`. `target` and `hostile` flee on alarm; a
`kill` target that leaves alive fails the mission.

Looks (all optional): `h` (height scale), `build` (`big|thin`), `hat`
(`fedora cap beanie hardhat tophat beret hood peaked sun helmet`) with `hatCol`
and `hatBand`, `hair` (`short long bun mohawk white`) with `hairCol`, `beard`,
`glasses` (`true|'shades'`), `mask`, `phones`, `coat` (+`long`), `vest`
(+`vestStripe`), `dress`, `tie`, `scarf`, `bag` (`case duffel shopping backpack
umbrella cane clip cup box paper flowers guitar balloon`) with `bagCol`, `gun:
'rifle'`. Use these to write identification puzzles: the brief describes the
target; decoys share some but not all features. `rndLook(rng, ban)` makes a
random bystander; `COL` has named colours.

Animations: `stand walk run panic phone smoke drink talk sit type sitphone
sitdrink lean guard aim aimrifle look wave point kneel cower work sweep arms
hands drive sleep`.

Routine steps:
`['walk', x, speedMul?]`, `['run', x]`, `['wait', seconds, anim?, face?]`,
`['anim', name]`, `['face', dir]`, `['hide']`, `['show']`, `['to', placement]`
(jump to another place, for example room to balcony), `['emit', 'event']`,
`['waitFor', 'event']`, `['say', 'text', seconds]`, `['loop', index?]`,
`['gone']` (leave the scene), `['look', {...}]` (change appearance, for example
hand over a bag), `['threat', victimId, seconds]` (draws a pistol; after the
countdown the victim is shot, which fails a protect mission), `['veh', vehId,
seat]` (get in; put any `emit` BEFORE this step), `['call', fn(sim, actor)]`,
`['speed', v]`, `['role', r]`. Helpers: `pace(x0, x1, wait0, wait1, anim)`,
`stroll(toX)`, `passersBy(H, {every, ban})` (a trigger that keeps spawning
walkers).

Set `yFn: (x) => height` on a person or vehicle that walks on a slope.

### Vehicles
```js
{ id: 'car', kind: 'sedan', plane: H.PR, x: -78, y: 0, dir: 1, col: '#101216',
  seats: ['drv', 't'],                // actor ids; seat 0 is the driver
  routine: [['wait', 4], ['drive', -5, 9], ['emit', 'parked'], ['wait', 8], ['drive', 95, 10], ['gone']] }
```
Kinds: `sedan suv limo van truck pickup boat train` (see `CARS`; add your own
with a `draw` function for things like gondolas or helicopters). Steps:
`drive x speed`, `wait`, `waitFor`, `emit`, `gone`, `brake`, `out actorId dx
zone plane y`, `call`, `loop`. Passengers are seen and hit through the windows
(glass applies). A flat tyre stops the car (`stopped:<id>` event). Shooting
the driver stops it too.

### Triggers
`{ at: seconds, do(sim, H) {} }`, `{ at, every, do }` (repeats), `{ on:
'event', delay, do }`, `{ when: (sim, H) => boolean, do }`. Helpers:
`say(at, 'Marlow', 'text')`, `hint(at, 'text')`, `onEv('event', fn, delay)`.

Things scripts can call: `sim.msg(who, text)`, `sim.emit(name)`,
`sim.did(name)`, `sim.after(seconds, fn)`, `sim.cover(seconds, name)`,
`sim.covered()`, `sim.setRoutine(id, routine)`, `sim.addActor(def)`,
`sim.addVehicle(def)`, `sim.raiseAlarm(by, delay)`, `sim.fail(code, text)`,
`sim.place(actor, placement)`, `sim.noise(x, y, plane, kind, radius)`,
`sim.byId[id]`, `sim.kills`, `sim.stats`, `sim.alarmT`, `sim.t`, `sim.S`.

Events emitted for you: `dead:<id>`, `gone:<id>`, `alarm`, `obj:<objectId>`,
`crash:<hookId>_p` (a load landed), `stopped:<vehId>`, `flat:<vehId>`,
`crash:<vehId>` (driver shot), `wrecked:<vehId>`, `executed:<victimId>`,
`glass:<room>`.

## 4. How people notice things (the stealth rules)

- **Sight.** A person sees a body or a killing if it is in their `zone` (or a
  zone listed for them in the mission's `sight: { theirZone: [otherZones] }`),
  within range (24 m, guards 32 m, times `S.seeMul`), roughly on their level,
  and they are facing it (or it is within 2.6 m). In the dark the range is 4 m.
  Outdoors at night a spot is lit only within `reach` (9 m) of a working lamp
  in that zone. A room is lit or dark as a whole. Daytime is always lit.
- **Reactions.** Bystanders panic and run (alarm about a second later). Guards
  reach for a radio and raise the alarm after about 1.7 s unless shot first.
  Targets flee and call it in.
- **Accidents** (falling loads) draw a crowd but never an alarm.
- **Loud shots.** An unsuppressed shot is heard by everyone when the sound
  arrives (distance / 343 seconds) if the scene is inside the rifle's noise
  radius (about 500 m for a .308, 1300 m for the .50). Beyond that it only
  makes people uneasy. If the objective is already complete when the sound
  arrives it no longer matters. A supersonic bullet arrives BEFORE its sound.
- **Noise cover.** `sim.cover(seconds, name)` hides loud shots fired while it
  is active and lights a pill on screen. Names with built-in sound: `thunder
  train fireworks jackhammer drill 'ship horn' 'church bells' jet helicopter
  'car alarm' band music steam`. Thunder also flashes the sky.
- **Suppressed, supersonic.** No bang, but people within about 30 m of where
  the bullet lands hear the crack and look around for a few seconds. Three
  scares in a row and a guard raises the alarm.
- **Misses.** A round landing within 3 m of someone startles them (panic or
  alarm). Within 8 m they look around.
- **Glass.** A closed window breaks on the first hit. Weak rounds (.22) stop
  there. Ordinary rounds go through but are knocked up to 6 cm off line.
  Armour-piercing and big calibres fly straight. Breaking glass alerts the room.

## 5. Shootable objects (`K.thing` kinds)

| Kind | When shot |
|---|---|
| `lamp` (via `K.lamp`), `bulb` (`room:`) | goes dark; that area or room is no longer lit |
| `hook`, `rope` (via `K.hang`) | the load falls and kills whoever is under it, as an accident |
| `barrel`, `tank` | explodes (radius `blast`), kills nearby, raises the alarm unless `rules.boomQuiet` |
| `fuse` | `cuts: [roomIds, lampIds or lamp zones]` go dark; `killsCams: true` |
| `bell`, `horn` | rings; people within `lure` (24 m) walk over to look; `cover: seconds` optional |
| `bottle`, `can`, `pot` | breaks; lures people within `lure` (11 m) |
| `cctv` | `zone`, `range`: a body in view raises the alarm unless the camera is shot first |
| `valve` | steam for `dur` seconds that blocks sight across it |
| `radio`, `dish` | guards can no longer radio; they must run to `mission.alarmX` |
| `lock` | emits `obj:<id>` for your script to react to |
| `flare` | everyone nearby stares at it for 7 s |
| `glint` | a flashing scope lens (`rate`, `phase`); breakable |
| `duck` | the hidden collectible. **Every mission hides exactly one.** |

Any object can take `onHit(sim, ob)`, `breakable: true`, `drawFn(ctx, env, S,
ob)`, `w`/`h` (a rectangular hit area instead of the default circle `r`), and
`pass: true` (the bullet carries on).

## 6. The bot script (`solve`)

The bot proves the mission can be completed. It aims perfectly (drop, wind and
lead are solved for it) but it obeys the same simulation as the player.

`['wait', s]`, `['until', (sim, H) => boolean, timeout?]`, `['cover']` (waits
for noise cover unless the rifle is quiet), `['shoot', actorId, 'head' |
'torso']`, `['shoot', id, part, { nowait: true }]` (do not wait for the round
to land), `['shootObj', objectId]`, `['shootPt', (sim, H) => ({ x, y, z, vx })
or null]`, `['hold']`, `['dial', metres]`, `['fn', (sim, H) => {}]`.

`solve(H, st, flags, sim)` receives the rifle's final numbers in `st`: use
`st.quiet` (suppressed), `st.silent`, `st.action` (`bolt semi single charge`),
`st.cycle`, `st.pen`, `st.mag`. Loud rifles usually need to wait for cover or
for a moment when it no longer matters. A `charge` rifle fires 0.85 s after
the trigger. `single` reloads for about 2 s after every shot.

Run it:
```
node build.js
NODE_PATH=/opt/npm-tools/node_modules CLEAN=1 node test/matrix.js c2m1,c2m2 1,2,3
```
It plays each listed mission with every allowed rifle from every position, for
shot seeds 1, 2 and 3. Zero FAIL lines is required. `CLEAN=1` also lists runs
that won with fewer than three stars; the main path should earn three unless
the design makes that impossible for loud rifles (then set `loudOk: true` on
the mission and say why in a comment).

Look at it:
```
NODE_PATH=/opt/npm-tools/node_modules node test/tour.js c2m1 fenwick "3@0;8@3,20@t@9,20@o:hook@6" 0
```
Each item is `time@target@zoom`, where target is an actor id, `o:<objectId>`
or `x;y` in metres. Images land in `shots/<mission>_<n>.png`. Open them and
check that the scene reads well, the target can be told apart, and nothing
important is hidden. Use a rifle with enough zoom for long ranges (for example
`halden` with `ranger` glass goes to 12x).

## 7. Writing rules

- Plain English. No jargon without a plain explanation. **Never use em
  dashes.** Use commas, full stops or colons.
- Marlow (the handler) is dry, exact and unsentimental. Pip (the armourer) is
  warm and wry. Detective Varga is blunt and honest. The player is "Kestrel".
- Stylised and not gory: nobody bleeds. People fall over; hats fly off.
- Every mission needs a reason to think: identify the right person, wait for
  the right moment, or change the scene first. No mission is "shoot the only
  figure standing in a field".
- Teach each new idea once with a `hint(...)`, then stop explaining it.
- Keep every mission finishable in under two minutes if played well.

## 8. Shooting through thin cover

A round crossing a plane is tested against that plane's things in this order:
shootable objects, people in the open, vehicles, fallen loads, windows and
gaps, and only then walls and other solids. So a wall on the SAME plane as a
person never protects them. Cover that is meant to stand between the rifle and
somebody must hang on a plane of its own, a little nearer the shooter.

- `K.coverPlane(S, PB, z, eye)` makes such a plane at distance `z`, in front of
  plane `PB`. Draw on it and add solids in `PB`'s own coordinates (`C.add`,
  `C.solid`); they are scaled about the shooter's eye so that, from that
  position, they line up exactly with what is behind. The people stay
  ordinary people in the open on `PB`, so a round that gets through the cover
  finds them wherever they are.
- Material: `thin` or `wood` (punch 1.4 goes through, which most rifles reach
  only with armour-piercing rounds); `wall` needs punch 3. Leave honest gaps
  (the slot under the eaves, the gap under a shutter) without a solid.
- A car's own body already needs punch 1.4. Its windows do not: glass breaks
  for any rifle. `K.armourGlass` puts an 'armour' object over each window of a
  moving car (objects are tested before cars), so the glass stops everything
  and the doors are the only way in. Call `A.follow(sim)` from `start` and
  `tick`.
- Ready-made pieces: `K.boardedSeat` (the valley's hunting tower with planks
  nailed over the front; breath and binoculars show through), `K.lockUp` (a
  tin lock-up in the rail yard with its shutter half up; legs show under it).
- A round with punch 1.2 or more carries on through a body. Put something
  solid behind the target (`K.lockUp` has a brick back wall) or make sure
  nobody stands in line.
