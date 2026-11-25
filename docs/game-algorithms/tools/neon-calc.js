// Independent exact calculator for Neon Overdrive (lines: exact enumeration; Hold & Respin: exact DP).
const SYMS = ['cell', 'chip', 'crystal', 'visor', 'drone', 'reactor', 'orb'];
const PAYS = { cell: [0.4, 1.2, 3], chip: [0.6, 2, 5], crystal: [1, 4, 10], visor: [2, 8, 25], drone: [4, 15, 50], reactor: [5, 25, 100] };
const PAYLINES = 12, REELS = 5, CELLS = 20, TRIGGER = 6, OVERDRIVE_AT = 10, GRAND = 100, START_RESPINS = 3;
const ORB_VALUES = [1, 2, 3, 4, 5, 6, 8, 10, 40];
const ORB_WEIGHTS = ORB_VALUES.map((v) => 120 / v); // chance proportional to 1/value

function linePay(seq) {
  let base = null, count = 0;
  for (let i = 0; i < REELS; i++) {
    const s = seq[i];
    if (s === 'orb') break;
    if (s !== 'reactor') { if (base && s !== base) break; base = s; }
    count++;
  }
  if (count >= 3) return PAYS[base || 'reactor'][count - 3];
  return 0;
}

function lineStats(p) {
  let ev = 0, hit = 0;
  const probs = SYMS.map((s) => p[s]);
  const total = Math.pow(SYMS.length, 5);
  for (let n = 0; n < total; n++) {
    let m = n, pr = 1; const seq = [];
    for (let i = 0; i < 5; i++) { const k = m % SYMS.length; m = Math.floor(m / SYMS.length); pr *= probs[k]; seq.push(SYMS[k]); }
    const pay = linePay(seq);
    ev += pr * pay; if (pay > 0) hit += pr;
  }
  return { ev, hit };
}

const lchoose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
const binom = (n, k, q) => lchoose(n, k) * Math.pow(q, k) * Math.pow(1 - q, n - k);

function analyse(cfg) {
  const wsum = SYMS.reduce((a, s) => a + cfg.weights[s], 0);
  const p = {}; SYMS.forEach((s) => (p[s] = cfg.weights[s] / wsum));
  const line = lineStats(p);
  const baseLineEV = line.ev * PAYLINES;
  // trigger
  const q = p.orb;
  let pTrig = 0; const init = new Array(CELLS + 1).fill(0);
  for (let k = TRIGGER; k <= CELLS; k++) { init[k] = binom(CELLS, k, q); pTrig += init[k]; }
  // DP over (n, respinsLeft)
  const r = cfg.respinChance;
  let dist = new Map(); // key n|left -> prob (unnormalised, conditioned on trigger)
  for (let k = TRIGGER; k <= CELLS; k++) dist.set(k + '|' + START_RESPINS, init[k] / pTrig);
  const finalN = new Array(CELLS + 1).fill(0);
  let guard = 0;
  while (dist.size && guard++ < 1000) {
    const next = new Map();
    for (const [key, pr] of dist) {
      const [n, left] = key.split('|').map(Number);
      if (n >= CELLS || left <= 0) { finalN[n] += pr; continue; }
      const empty = CELLS - n;
      for (let L = 0; L <= empty; L++) {
        const pl = binom(empty, L, r); if (pl < 1e-18) continue;
        const nn = n + L, nl = L > 0 ? START_RESPINS : left - 1;
        const k2 = nn + '|' + nl;
        next.set(k2, (next.get(k2) || 0) + pr * pl);
      }
    }
    dist = next;
  }
  const wv = ORB_WEIGHTS.reduce((a, b) => a + b, 0);
  const meanV = ORB_VALUES.reduce((a, v, i) => a + v * ORB_WEIGHTS[i], 0) / wv;
  let bonusEV = 0, pFull = 0, pOD = 0, meanN = 0;
  for (let n = 0; n <= CELLS; n++) {
    if (!finalN[n]) continue;
    meanN += n * finalN[n];
    const od = n >= OVERDRIVE_AT; if (od) pOD += finalN[n];
    if (n === CELLS) pFull += finalN[n];
    bonusEV += finalN[n] * (n * meanV * (od ? 2 : 1) + (n === CELLS ? GRAND : 0));
  }
  const rtp = baseLineEV + pTrig * bonusEV;
  return { p, baseLineEV, lineHit: line.hit, pTrig, meanV, bonusEV, pFull, pOD, meanN, finalN, rtp, bonusShare: pTrig * bonusEV };
}

module.exports = { analyse, linePay, ORB_VALUES, ORB_WEIGHTS };

if (require.main === module) {
  // Same numbers as src/modules/game-engine/engines/neon-overdrive/neon-overdrive.config.ts
  const weights = { cell: 60, chip: 45, crystal: 35, visor: 30, drone: 15, reactor: 1, orb: 14 };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const a = analyse({ weights, respinChance: weights.orb / total });
  console.log('Line wins (12 lines)             :', (a.baseLineEV * 100).toFixed(2) + '%');
  console.log('Hold & Respin share of return    :', (a.bonusShare * 100).toFixed(2) + '%');
  console.log('TOTAL return to player           :', (a.rtp * 100).toFixed(2) + '%');
  console.log('Hold & Respin triggers 1 in      :', (1 / a.pTrig).toFixed(0));
  console.log('Average bonus (x bet) | trigger  :', a.bonusEV.toFixed(1));
  console.log('P(overdrive | trigger) =', a.pOD.toFixed(4), ' P(full grid | trigger) =', a.pFull.toFixed(4));
}
