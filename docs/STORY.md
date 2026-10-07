# Cold Bore: story and campaign plan

## The world

**Port Calder** is a rainy harbour city. Beyond it are the **Ashlock
mountains**, and beyond those the old army proving ground at **Harrow Ridge**.

**You are Kestrel**, a discharged army marksman. Three years ago at Harrow
Ridge your spotter, **Rook**, called a target. Through the scope you saw a man
with his hands up. The order was repeated. You put the round wide on purpose.
An ambush followed, Rook was reported killed, and you were discharged for
"failure to engage".

Now you work for **the Ledger**, a small outfit that says it "balances the
books": it removes criminals the law cannot reach. Your handler is **Marlow**,
a voice in your ear: dry, exact, unsentimental. The Ledger's armourer is
**Pip** (Philippa Okoro): warm, wry, talks too much, sells you rifles.

**The Calloways** are the city's crime family: old **August Calloway**, his
street boss **Dutch Pell**, and his daughter **Maeve**, who runs the docks.

**Detective Ines Varga** is the one honest detective in Port Calder. She is
chasing the "Brickworks Ghost", which is you. She is never a target.

**The truth** (revealed across chapters 3 to 5): the Ledger's real client is
**Caspian Aurel**, head of the Aurel Group. Aurel is using the Ledger to wipe
out the Calloways and take the port, and then to remove witnesses to its
illegal weapons programme (the **Stormglass** coil rifle). The man with his
hands up at Harrow Ridge was an Aurel whistleblower. Rook was on Aurel's
payroll then, is alive, and is Aurel's own marksman now.

## Story switches (flags)

| Flag | Set in | Meaning |
|---|---|---|
| `sparedReyes` | c2m5 | true if dock worker Tomas Reyes lives to talk to Varga |
| `savedBrandt` | c4m5 | true if journalist Nadia Brandt lives |
| `sparedMarlow` | c5m5 | true if Marlow is left alive to be arrested |
| `sparedRook` | c6m5 | true if you do not shoot Rook when he stands up, hands raised |
| `arrestedAurel` | c6m6 | true if Aurel is grounded and arrested instead of killed |

A mission that reads a flag must work for both values (use `testFlags`).

## Difficulty curve

| Chapter | Place | Range | Wind | New ideas |
|---|---|---|---|---|
| 1 Cold Start | Brickworks streets | 140 to 170 m | calm | identify, witnesses, lamps, noise cover, accidents, cars, rooms, positions |
| 2 Harbour Lights | the docks | 180 to 320 m | 2 to 5 m/s | wind hold, protect someone, boats, sabotage with no deaths, first choice |
| 3 High Country | Ashlock mountains | 350 to 700 m | 0 to 6 m/s | bullet drop and reading the reticle, long flight time, convoys |
| 4 Glass Towers | downtown at night | 250 to 500 m | 1 to 4 m/s | glass, fuse boxes and cameras, crowded identification, second choice |
| 5 Dead Letters | rail yard, estate, bridge | 400 to 800 m | 2 to 6 m/s | everything combined, allies, third choice |
| 6 Harrow Ridge | snow, the proving ground | 800 to 1400 m | 3 to 8 m/s | extreme range, counter-sniper, the last two choices |

Rewards (credits / experience) per mission: ch2 1100 to 2000 / 260 to 400;
ch3 1800 to 3000 / 420 to 600; ch4 2600 to 4000 / 600 to 800; ch5 3600 to 5200
/ 800 to 1000; ch6 5000 to 8000 / 1000 to 1400. Finales pay the most.

Rifle reach, for choosing `range`: Ratter 170, Whisper 260, Hush 300, Kessler
500, Lark 520, Fenwick 600, Orlov 700, Corvid 750, Halden 850, Marrow 950, Ibex
1000, Vantage 1150, Northwind 1400, Anvil 1600, Aria 1900, Stormglass 2200.
The player always owns the Fenwick, and is given the Stormglass after c4m6.

## Chapter 2: HARBOUR LIGHTS (ids c2m1 to c2m7)

Maeve Calloway's smuggling business on the Port Calder docks. Location:
`SCN.docks` (water and a moored ship behind; a quay with stacked containers
people can stand on; a crane with a hanging load; a warehouse with an office;
lamps; fuel barrels; a fuse box; a buoy bell). Dusk, night, rain and fog.

1. **c2m1 Tide Tables** (260 m, dusk, wind 4). The harbour clerk who sells
   Maeve the customs schedule, among dock workers. Identification by hard hat
   colour and clipboard. First mission where wind matters: teach "hold into the
   wind" using the HOLD read-out.
2. **c2m2 Dead Weight** (240 m, night). Two smugglers checking crates under the
   crane. One hook can take both if the player waits for both to be under it;
   or two shots using the ship's horn as cover. A patrolling guard.
3. **c2m3 Fog Signal** (220 m, dawn fog). Protect: two Calloway men walk dock
   worker **Tomas Reyes** to the end of the pier to shoot him. Drop both before
   the countdown ends without hitting Reyes. Introduces Reyes.
4. **c2m4 Night Ferry** (300 m, night, wind 3). A smuggler's launch crosses the
   harbour and ties up for a few seconds. Moving target, lead, a guard on the
   jetty, a lamp.
5. **c2m5 The Witness** (250 m, rain, night). **Choice.** Marlow says Reyes saw
   your muzzle flash and is about to describe you to Detective Varga at the
   dock gate. A Calloway gunman is also coming to silence him. Shoot Reyes
   (`sparedReyes` false), or shoot the gunman so Reyes reaches Varga
   (`sparedReyes` true), or do nothing and the gunman does it (false, different
   text). Varga must never be hit.
6. **c2m6 Powder Room** (280 m, night, wind 4). Sabotage with nobody killed
   (`noKills`): blow the fuel store on Maeve's supply barge while the crew is
   clear. A bell or bottle to draw a guard away.
7. **c2m7 Maeve** (320 m, storm, wind 5 gusting). Finale. Maeve Calloway on the
   deck of her yacht among guests and bodyguards: white hair, red coat. Thunder
   for cover, deck lamps, bystanders. A crate stencilled AUREL is being loaded:
   Marlow avoids the question. `after`: Maeve is gone and August has fled to
   the mountains.

## Chapter 3: HIGH COUNTRY (ids c3m1 to c3m7)

August Calloway's lodge in the Ashlocks. Location: `SCN.valley` (far peaks,
pine hills, a big timber lodge with a deck, windows and chimney smoke; a
helipad; a mountain road; a cable-car line; a hunting tower; a flag). Day,
dawn, snow. This chapter teaches drop and wind: write the hints carefully.

1. **c3m1 Thin Air** (400 m, calm, day). One stationary man on the lodge deck
   (August's quartermaster). The only lesson: the bullet falls. Explain the
   HOLD number and the marks on the glass (each mark is one mil; "hold 2.9
   high" means put the third mark below the crosshair on him). No witnesses.
2. **c3m2 Crosswind** (450 m, wind 5 steady). A lookout in the hunting tower
   and a cook nearby who must not be hit. Teach wind hold; the flag and the
   chimney smoke show direction and strength.
3. **c3m3 The Gondola** (500 m, wind 2). The target rides a cable car with a
   bodyguard. It moves slowly and stops at a pylon for a few seconds. Drop,
   lead and glass together.
4. **c3m4 Convoy** (550 m, wind 3, time limit). Three vehicles on the mountain
   road; the target is in the one with a described feature. Stop the convoy
   (tyre, or drop a hanging log load across the road) and take him when he
   gets out, or hit him through the window.
5. **c3m5 Whiteout** (380 m, snowstorm, poor visibility, `strict`). Kill the
   radio operator and destroy the dish before the lodge can call for the
   helicopter. Patrolling guards with lamps.
6. **c3m6 First Light** (480 or 700 m, dawn, wind 4). Two positions: the near
   ridge (trees hide part of the deck) or the far peak (clear, but a very long
   shot). August's two personal guards must go without an alarm so that he
   stays for the next mission.
7. **c3m7 August** (680 m, gusting wind 5, time limit). Finale. August walks to
   the helicopter under escort. White hair, green coat, cane. Detective Varga
   arrives at the gate by car and must not be hit. `after`: Pip finds a page of
   August's accounts. The Calloways were paying nobody for protection. Someone
   was paying the Ledger to remove them. The name on the page is Aurel.

## Chapter 4: GLASS TOWERS (ids c4m1 to c4m7)

Downtown Port Calder at night. The Ledger's targets stop looking like
criminals. Location: `SCN.towers` (glass office towers with floor-to-ceiling
windows and lit floors, a rooftop terrace, a construction crane with a girder,
a window-cleaning cradle, neon, a far skyline). Cameras and fuse boxes.

1. **c4m1 Night Shift** (300 m). An Aurel accountant working late, described
   by Marlow as "the Calloways' inside man". Cleaners pass through. Closed
   glass: aim centre mass or bring armour-piercing rounds.
2. **c4m2 Power Cut** (350 m). Cameras cover the floor. Shoot the fuse box to
   kill the lights and cameras, then find the target in a dark room (his phone
   glows; night vision helps).
3. **c4m3 The Reception** (320 m, wind 3). A rooftop party. A chain of clues
   picks out the target among a dozen guests. Fireworks give cover.
4. **c4m4 Scaffold** (400 m, wind 4, accident only). A target who inspects his
   building site at night: a crane girder, workers who must not be hurt.
5. **c4m5 The Journalist** (380 m). **Choice.** Marlow orders the death of
   **Nadia Brandt**, a reporter "printing Calloway lies". Through her window
   you can see what she is writing about, and a masked Aurel man is coming up
   the fire escape with a pistol. Shoot her (`savedBrandt` false), shoot him
   (`savedBrandt` true), or wait and he does it (false). Either way Kestrel now
   knows who the Ledger works for.
6. **c4m6 Proof of Concept** (450 m, wind 3, `noKills`, time limit). Wreck
   Aurel's rooftop Stormglass demonstration without killing anyone: capacitor
   bank, cooling valve, fuse box, in the right order between guard passes.
   `after`: in the confusion Pip walks out with the prototype. It is yours.
7. **c4m7 Burned** (350 m, rain). Finale. The Ledger has cut you loose and
   sent a team for Pip. Protect her as she crosses from the workshop to her
   car: several gunmen appear one after another from different places, each
   with a countdown. Marlow speaks to you directly for the last time.

## Chapter 5: DEAD LETTERS (ids c5m1 to c5m7)

Kestrel, Pip and (if she has any reason to trust you) Varga against Aurel and
what is left of the Ledger. Locations: `SCN.yard` (a rail yard with freight
trains that block the view and cover noise), `SCN.estate` (a walled villa with
garden, pool, hedges, gate and guards), `SCN.bridge` (a river bridge with a
convoy). If `sparedReyes` or `savedBrandt` is true, Varga helps: fewer guards,
radio tips from her. If both are false she is hunting you too, and police are
extra people who must not be hit.

1. **c5m1 Dead Drop** (450 m, dusk). Rail yard. An Aurel fixer is buying the
   evidence back from a frightened clerk. Take the fixer between passing
   trains without the clerk seeing where it came from.
2. **c5m2 House Guests** (500 m, day, wind 4). Estate garden party hosted by
   Aurel's lawyer. Identify and remove the head of security, with cameras
   watching. If `savedBrandt`, Brandt is among the guests and tips you off.
3. **c5m3 The Quartermaster** (420 m, night, `noKills`). The Ledger's armoury
   boat on the river. Sink it (fuel) with the crew ashore.
4. **c5m4 Bridge Toll** (700 m, wind 5, time limit). A prisoner van crosses the
   bridge with escorts. Stop it and deal with the guards before they turn on
   the prisoner. The prisoner is Reyes if `sparedReyes`, otherwise a records
   clerk.
5. **c5m5 Marlow** (550 m, night). **Choice.** The Ledger safehouse. Marlow is
   burning files and leaving. Kill her (`sparedMarlow` false), or strand her
   for Varga by wrecking her car and radio without killing her (`sparedMarlow`
   true). Her two guards are fair game.
6. **c5m6 Paper Trail** (600 m, wind 4, protect). Varga's people go into the
   Aurel records office. Gunmen appear on balconies and rooftops, each with a
   countdown.
7. **c5m7 Counter-Fire** (800 m, wind 6, protect, time limit). Finale. Aurel
   escapes by helicopter while a hidden marksman pins Varga's team: Rook. Find
   his scope glint among decoys and put a round through the scope before he
   fires again. He survives and withdraws. `after`: Kestrel recognises the way
   he shoots.

## Chapter 6: HARROW RIDGE (ids c6m1 to c6m6)

The snowbound proving ground where it began. Location: `SCN.ridge` (a white
valley, a compound of bunkers, towers, a radar dish, fuel tanks and a helipad,
and a far rock ridge with hides). Very long shots: long flight times, big
holdovers, strong gusting wind. Loud rifles are often out of earshot here.

1. **c6m1 Approach** (800 m, wind 4). Two tower sentries, no alarm.
2. **c6m2 Blackout** (900 m, wind 5). Destroy the generator and the dish
   between patrols.
3. **c6m3 The Long Walk** (1000 m, wind 5, protect). Varga (and Reyes or
   Brandt if alive) cross open ground. Four gunmen at different ranges.
4. **c6m4 Glint** (1200 m, wind 6). Rook is on the far ridge. Three hides,
   mirrors as decoys, one real lens. Choose wrong and he fires at the people
   you are protecting.
5. **c6m5 Rook** (1300 m, wind 4). **Choice.** Rook stands up with his hands
   raised, exactly as the man did three years ago. Shoot him (`sparedRook`
   false), or hold fire for twenty seconds and he puts the rifle down and
   walks away (`sparedRook` true). Shooting his rifle on the ground also
   counts as sparing him.
6. **c6m6 Cold Bore** (1400 m, gusting wind 7, time limit). Finale. Aurel's
   helicopter is lifting off. One shot. Kill Aurel through the cabin
   (`arrestedAurel` false), or cripple the tail rotor so it settles back onto
   the pad and Varga takes him alive (`arrestedAurel` true). If `sparedRook`,
   Rook calls the wind for you over the radio.
