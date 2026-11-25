// Independent calculator for Pharaoh's Fortune. Mirrors the rules of the frontend mock.ts evaluate().
// Usage: node pharaoh-calc.js
const SYMS = ['pharaoh', 'scarab', 'anubis', 'horus', 'sphinx', 'temple', 'coin', 'jewel'];
const PAYTABLE = { anubis: [4, 12, 40], horus: [4, 12, 40], sphinx: [4, 12, 40], temple: [2, 5, 15], coin: [2, 5, 15], jewel: [2, 5, 15] };
const JACKPOT = 1000;
const SCATTER = { 3: { mult: 5, fs: 10 }, 4: { mult: 20, fs: 15 } };
const PAYLINES = [[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2]];

function linePay(seq) {
  if (seq[0] === 'scarab') return 0;
  if (seq.every((s) => s === 'pharaoh')) return JACKPOT;
  const base = seq.find((s) => s !== 'pharaoh');
  if (!base || base === 'scarab') return 0;
  let count = 0;
  for (const s of seq) { if (s === base || s === 'pharaoh') count++; else break; }
  return count >= 3 ? PAYTABLE[base][count - 3] : 0;
}

// exact expected pay of one payline for independent cells with probabilities p (object sym->prob)
function lineStats(p) {
  let ev = 0, hit = 0;
  const probs = SYMS.map((s) => p[s] || 0);
  const idx = [0, 0, 0, 0, 0];
  const total = Math.pow(SYMS.length, 5);
  for (let n = 0; n < total; n++) {
    let m = n, pr = 1;
    const seq = [];
    for (let i = 0; i < 5; i++) { const k = m % SYMS.length; m = Math.floor(m / SYMS.length); pr *= probs[k]; seq.push(SYMS[k]); }
    if (pr === 0) continue;
    const pay = linePay(seq);
    ev += pr * pay;
    if (pay > 0) hit += pr;
  }
  return { ev, hit };
}

const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
const binom = (n, k, q) => choose(n, k) * Math.pow(q, k) * Math.pow(1 - q, n - k);

function analyse(weights, label) {
  const sum = SYMS.reduce((a, s) => a + (weights[s] || 0), 0);
  const p = {}; SYMS.forEach((s) => (p[s] = (weights[s] || 0) / sum));
  // free-spin distribution: same weights but no scarab
  const w2 = { ...weights, scarab: 0 };
  const sum2 = SYMS.reduce((a, s) => a + (w2[s] || 0), 0);
  const p2 = {}; SYMS.forEach((s) => (p2[s] = (w2[s] || 0) / sum2));
  const base = lineStats(p), free = lineStats(p2);
  const baseLineEV = base.ev * PAYLINES.length;
  const freeLineEV = free.ev * PAYLINES.length;
  const q = p.scarab;
  let pS3 = binom(15, 3, q), pS4plus = 0;
  for (let k = 4; k <= 15; k++) pS4plus += binom(15, k, q);
  const fsEV = (n) => n * freeLineEV;
  const scatterEV = pS3 * (SCATTER[3].mult + fsEV(SCATTER[3].fs)) + pS4plus * (SCATTER[4].mult + fsEV(SCATTER[4].fs));
  const rtp = baseLineEV + scatterEV;
  return { label, p, baseLineEV, freeLineEV, pS3, pS4plus, scatterEV, rtp, lineHitOne: base.hit };
}

module.exports = { analyse, linePay, PAYLINES, SYMS, PAYTABLE, JACKPOT, SCATTER };

if (require.main === module) {
  // Same weights as src/modules/game-engine/engines/pharaohs-fortune/pharaohs-fortune.config.ts
  const weights = { pharaoh: 1, scarab: 2, anubis: 10, horus: 10, sphinx: 10, temple: 10, coin: 10, jewel: 10 };
  const r = analyse(weights, 'pharaohs-fortune');
  console.log('Line wins (5 lines), multiple of bet :', (r.baseLineEV * 100).toFixed(2) + '%');
  console.log('Instant scatter prizes               :', ((r.pS3 * SCATTER[3].mult + r.pS4plus * SCATTER[4].mult) * 100).toFixed(2) + '%');
  console.log('Free spins (their line wins)         :', ((r.pS3 * SCATTER[3].fs + r.pS4plus * SCATTER[4].fs) * r.freeLineEV * 100).toFixed(2) + '%');
  console.log('TOTAL return to player               :', (r.rtp * 100).toFixed(2) + '%');
  console.log('P(3 scarabs) =', r.pS3.toFixed(6), ' P(4+ scarabs) =', r.pS4plus.toFixed(6), ' P(win on one line) =', r.lineHitOne.toFixed(6));
}
