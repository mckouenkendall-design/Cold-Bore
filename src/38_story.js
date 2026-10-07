// ---------------------------------------------------------------------------
// The story wrapper: prologue, chapter cards, and the epilogue, which is built
// from the choices the player made.
// ---------------------------------------------------------------------------
const PROLOGUE = [
  { h: 'Harrow Ridge. Three years ago.', p: 'Your spotter called the target. Through the glass you saw a man standing with his hands up.' },
  { h: '', p: 'The order came twice. You put the round a metre wide, on purpose. Then the ridge lit up, and they told you your spotter died there. They told you a lot of things.' },
  { h: '', p: 'The army called it "failure to engage" and let you go.' },
  { h: 'Port Calder. Now.', p: 'You work for a firm with no sign on the door. It calls itself the Ledger. A voice named Marlow reads you names, and you make the books balance. She calls you Kestrel. It is raining.' },
];

const CHAPTERS = [
  { n: 1, title: 'Cold Start', place: 'Brickworks, Port Calder',
    intro: ['The Calloway family has run Port Calder\'s streets for forty years. Collectors, bagmen, a counting house, and a street boss named Dutch Pell who has never once been charged with anything.', 'Marlow has a list. It starts at the bottom.'],
    outro: 'Brickworks is quiet. The Calloways have lost their street. Marlow says the money came in by sea, and the docks belong to the old man\'s daughter.' },
  { n: 2, title: 'Harbour Lights', place: 'The docks',
    intro: ['Maeve Calloway runs the harbour: the customs clerk, the night cranes, the boats that come in dark. Out here there is wind off the water, and a bullet goes where the wind sends it.', 'Pip, the Ledger\'s armourer, has a few things on the bench if you have the money.'],
    outro: 'Maeve is gone. There was a crate on that yacht with a name stencilled on it: AUREL. You asked Marlow about it. She changed the subject. Old August Calloway has run for the mountains.' },
  { n: 3, title: 'High Country', place: 'The Ashlock mountains',
    intro: ['August Calloway has a lodge in the Ashlocks, a private road, and nothing left to lose. The shots are long up here. Past three hundred metres a bullet falls a long way before it arrives, and it takes its time getting there.', 'Learn the marks on the glass.'],
    outro: 'The Calloways are finished. And a page from the old man\'s accounts says he was never the one paying. Someone hired the Ledger to clear the board. The name on the page is Aurel.' },
  { n: 4, title: 'Glass Towers', place: 'Downtown Port Calder',
    intro: ['The work has moved downtown. The names Marlow reads you now belong to accountants, engineers, people with lanyards. She says they are Calloway loose ends.', 'Pip has stopped making jokes on the radio.'],
    outro: 'The Ledger sent men to kill its own armourer. You are no longer on the books. Pip is alive, the prototype is in the back of her truck, and you both know who you work against now.' },
  { n: 5, title: 'Dead Letters', place: 'Rail yard, estate, river',
    intro: ['No handler, no fee, no list but the one you write yourself. Caspian Aurel bought a city by hiring other people\'s hands. You were one of them.', 'Pip reads the briefs now. Whether the detective helps depends on what you gave her reason to believe.'],
    outro: 'Aurel is in the air and heading north. And the man who covered his escape shoots a way you have seen before, lying beside you on a ridge, calling wind. Rook is alive.' },
  { n: 6, title: 'Harrow Ridge', place: 'The proving ground',
    intro: ['It ends where it started. The old army ground at Harrow Ridge belongs to Aurel now: bunkers, towers, a helicopter pad, snow. The distances are measured in kilometres.', 'Every shot here is the first shot from a cold barrel. You do not get it back.'],
    outro: '' },
];
const CHAPTER_BY_N = {}; CHAPTERS.forEach((c) => { CHAPTER_BY_N[c.n] = c; });

const CH1_AFTER = {
  c1m1: 'Clean. The shopkeepers of Brickworks keep their Friday takings for the first time in years. One collector is not a crew, though. Follow the money.',
  c1m2: 'The bag never arrived. The Calloways will count it twice tonight and come up short both times.',
  c1m3: 'Both spotters, and the dice game never knew it had been watched over. They will move it again. It will not help them.',
  c1m4: 'The coroner will write "misadventure". The piano was a write-off. Voss was heavily insured, which is funny if you think about it.',
  c1m5: 'The driver took him to the hospital at full speed, which was considerate, and four minutes too late.',
  c1m6: 'No bookkeeper, no books. Nobody in that family now knows who owes what. Dutch Pell will have to come out and sort it in person.',
  c1m7: 'Dutch Pell ran Brickworks for twenty years and it ended in the dark with a phone in his hand. Detective Varga saw a man fall and nothing else. She has opened a file. She is calling you the Brickworks Ghost.',
};

function missionText(M, key) {
  const v = M[key]; const f = Save.data.flags;
  if (typeof v === 'function') return v(f);
  if (v === undefined && key === 'after') return CH1_AFTER[M.id] || '';
  return v;
}
function speakerOf(M) {
  const s = typeof M.speaker === 'function' ? M.speaker(Save.data.flags) : M.speaker;
  return s || (M.ch >= 5 ? 'Pip' : 'Marlow');
}

// The ending, assembled from the five choices.
function epilogue(f) {
  const out = [];
  out.push(f.arrestedAurel
    ? 'Caspian Aurel walked off the pad at Harrow Ridge with his hands on his head and Detective Varga\'s cuffs waiting. The trial took eleven months. He will not see the harbour again.'
    : 'Caspian Aurel did not leave Harrow Ridge. The helicopter flew south without him aboard in any way that mattered. The Aurel Group denied everything for a week, and then stopped existing.');
  out.push(f.sparedRook
    ? 'Rook walked down off the ridge and kept walking. Months later a postcard came with no message, only a wind reading written in the corner. It was correct.'
    : 'Rook stayed on the ridge. You carried his rifle down yourself and left it with the detective. Neither of you said anything about it.');
  out.push(f.sparedMarlow
    ? 'Marlow gave the court every name in the Ledger, in order, in a voice like someone reading a shopping list. Yours was not among them. Nobody has ever asked her why.'
    : 'Marlow\'s files burned with the safehouse. Whatever she knew about who paid for what in Port Calder went with her.');
  if (f.savedBrandt) out.push('Nadia Brandt\'s story ran on a Sunday, across six pages. She sent you a copy with one line marked: "A source who cannot be named declined to fire."');
  else out.push('Nadia Brandt\'s notes were found on her wall, exactly as she left them. Someone else finished the story. It carried her name first.');
  if (f.sparedReyes) out.push('Tomas Reyes went back to work on the docks. He testified twice. He still waves at empty rooftops, in case.');
  else out.push('There is a small brass plate on the dock gate now with a docker\'s name on it. You have read it more than once.');
  const kept = (f.arrestedAurel ? 1 : 0) + (f.sparedRook ? 1 : 0) + (f.sparedMarlow ? 1 : 0) + (f.savedBrandt ? 1 : 0) + (f.sparedReyes ? 1 : 0);
  let title, last;
  if (kept === 5) { title = 'Clean Hands'; last = 'Five times the easy answer was a trigger, and five times you found another one. Detective Varga closed the Brickworks Ghost file herself. Under "suspect" she wrote: none.'; }
  else if (kept === 0) { title = 'Balanced Books'; last = 'Every name on every list, yours and theirs. The books balance. Varga keeps the Brickworks Ghost file open on her desk, and she has stopped expecting to close it.'; }
  else if (kept >= 3) { title = 'The Wide Shot'; last = 'You missed on purpose once, three years ago, and it cost you everything. This time it mostly worked. Varga marked the Ghost file "inactive", which is not the same as closed.'; }
  else { title = 'Failure to Engage'; last = 'Some you spared and some you did not, and you could not always say why. Varga keeps the Ghost file in a drawer. She has not thrown it away.'; }
  out.push(last);
  out.push('Pip opened a locksmith\'s shop with a very good back room. The rifle is in a case under the bench. It has been cold a long time.');
  return { title, lines: out, kept };
}
