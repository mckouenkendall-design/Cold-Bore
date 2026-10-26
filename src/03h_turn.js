// ---------------------------------------------------------------------------
// Turning round, as drawn. The simulation swings A.faceS from one side to the other in a
// fifth of a second, and the shapes a round is tested against simply narrow through the turn
// (actorJoints in src/03_figures.js). The picture does better: the person turns toward us, so
// half way round we see them from the front, shoulders square, arms at their sides and feet
// apart, and on the way one foot and then the other is lifted and put down again.
// Drawing only: it moves the copies of the joints that drawFigure works with (G.*), never
// the ones the simulation uses.
// ---------------------------------------------------------------------------

// how far out to the side each joint is seen from the front (metres; the far side positive)
const FIG_TURN_W = { elL: 0.2, haL: 0.21, knL: 0.085, ftL: 0.1, elR: -0.2, haR: -0.21, knR: -0.085, ftR: -0.1 };
const FIG_SHL = [0, 0], FIG_SHR = [0, 0];

function figTurnView(G, A) {
  G.shL = G.shR = G.sh;
  const fS = clamp(A.faceS === undefined ? 1 : A.faceS, -1, 1);
  if (Math.abs(fS) >= 0.995 || A.dead || G.seated) return;
  // G.f is the narrowed facing actorJoints used (never under 0.22 across); undo it, then turn properly
  const s = Math.sqrt(1 - fS * fS), sg = G.fs, k = fS / G.f;
  for (let i = 0; i < FIG_JN.length; i++) { const key = FIG_JN[i], p = G[key], w = FIG_TURN_W[key] || 0; p[0] = p[0] * k + w * sg * s; }
  // the two shoulders come apart as the chest turns to us
  FIG_SHL[0] = G.sh[0] + 0.15 * sg * s; FIG_SHL[1] = G.sh[1]; FIG_SHR[0] = G.sh[0] - 0.15 * sg * s; FIG_SHR[1] = G.sh[1];
  G.shL = FIG_SHL; G.shR = FIG_SHR;
  // stepping round: the near foot is lifted and put down, then the far one
  if (figMv(A) < 0.5) {
    const u = (1 - fS * (A.face || 1)) / 2;
    const lift = (a, b) => (u > a && u < b ? Math.sin((Math.PI * (u - a)) / (b - a)) : 0);
    const r = lift(0.05, 0.55) * 0.07, l = lift(0.45, 0.95) * 0.07;
    G.ftR[1] += r; G.knR[1] += r * 0.5; G.knR[0] += sg * r * 0.6;
    G.ftL[1] += l; G.knL[1] += l * 0.5; G.knL[0] += sg * l * 0.6;
  }
}
