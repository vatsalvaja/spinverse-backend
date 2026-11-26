// Every winning combination on ONE Pharaoh's Fortune payline, scored by the real evaluator.
//   node pharaoh-combos.js
const { load, writeResult } = require('./common');
const cfg = load('pharaohs-fortune/pharaohs-fortune.config');
const { evaluateLines } = load('pharaohs-fortune/pharaohs-fortune.engine');
const { SYMBOL_ORDER, SYMBOL_WEIGHTS, PAYLINES } = cfg;
const T = SYMBOL_WEIGHTS.reduce((a, b) => a + b, 0);
const table = {};
let none = 0;
for (let code = 0; code < 8 ** 5; code++) {
  let c = code, p = 1;
  const seq = [];
  for (let i = 0; i < 5; i++) { const s = c % 8; c = Math.floor(c / 8); seq.push(SYMBOL_ORDER[s]); p *= SYMBOL_WEIGHTS[s] / T; }
  const rows = [Array(5).fill('anubis'), seq, Array(5).fill('anubis')];
  const win = evaluateLines(rows).find((w) => w.line === 0);
  if (!win) { none += p; continue; }
  const key = `${win.symbol} x${win.count}`;
  const entry = (table[key] ??= { symbol: win.symbol, count: win.count, multiple: win.multiplier, probability: 0, sequences: 0, withWild: 0 });
  entry.probability += p;
  entry.sequences++;
  if (seq.includes('pharaoh') && win.symbol !== 'pharaoh') entry.withWild += p;
}
const rows = Object.values(table).sort((a, b) => b.multiple - a.multiple || b.probability - a.probability);
rows.forEach((r) => { r.rtpPerLine = r.multiple * r.probability; r.oneIn = 1 / r.probability; });
const out = { weightsTotal: T, lines: PAYLINES.length, probabilityNoWinOnALine: none, probabilityWinOnALine: 1 - none, rows, expectedMultiplePerLine: rows.reduce((s, r) => s + r.rtpPerLine, 0) };
writeResult('pharaoh-combos', out);
console.log(rows.map((r) => `${r.symbol.padEnd(8)} x${r.count} pays ${String(r.multiple).padStart(4)}  p=${r.probability.toExponential(4)}  1 in ${r.oneIn.toFixed(0)}  rtp/line=${r.rtpPerLine.toFixed(5)}`).join('\n'));
console.log('P(line wins)', 1 - none, 'E per line', out.expectedMultiplePerLine);
