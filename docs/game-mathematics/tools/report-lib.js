// Helpers for build-reports.js: number formatting, markdown tables and pooling of simulation runs.
const fs = require('node:fs');
const path = require('node:path');

const RESULTS = path.join(__dirname, 'results');
const read = (name) => JSON.parse(fs.readFileSync(path.join(RESULTS, `${name}.json`), 'utf8'));
const exists = (name) => fs.existsSync(path.join(RESULTS, `${name}.json`));

const group = (x, d = 0) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x, d = 2) => `${(x * 100).toFixed(d)}%`;
const mult = (x, d = 2) => `${group(x, d)}×`;
const oneIn = (p) => (p > 0 ? `1 in ${group(Math.round(1 / p))}` : 'never');
const sci = (x) => x.toExponential(2);
const credits = (x) => group(x, Number.isInteger(x) ? 0 : 2);

/** Markdown table. `align` is a string like 'lrr'. */
function table(headers, rows, align) {
  const a = align ?? headers.map((_, i) => (i === 0 ? 'l' : 'r')).join('');
  const sep = [...a].map((c) => (c === 'r' ? '---:' : '---'));
  return [`| ${headers.join(' | ')} |`, `| ${sep.join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

/**
 * Pools independent simulation runs (different seed sets) of one configuration. Every run has equal stake per
 * paid round, so the pooled RTP is the weighted mean and its standard error follows from the pooled variance.
 */
function pool(names) {
  const runs = names.filter(exists).map((n) => ({ name: n, ...read(n) }));
  const n = runs.reduce((s, r) => s + r.paidRounds, 0);
  const w = (f) => runs.reduce((s, r) => s + f(r) * r.paidRounds, 0) / n;
  const variance = runs.reduce((s, r) => s + r.standardDeviationPerPaidRound ** 2 * r.paidRounds, 0) / n;
  const se = Math.sqrt(variance / n);
  const rtp = w((r) => r.rtp);
  const comps = {};
  for (const r of runs) for (const [k, v] of Object.entries(r.componentRtp ?? {})) comps[k] = (comps[k] ?? 0) + v * r.paidRounds;
  for (const k of Object.keys(comps)) comps[k] /= n;
  const thresholds = {};
  for (const r of runs) for (const [k, v] of Object.entries(r.returnThresholds)) thresholds[k] = (thresholds[k] ?? 0) + v * r.paidRounds;
  for (const k of Object.keys(thresholds)) thresholds[k] /= n;
  return {
    runs,
    paidRounds: n,
    rtp,
    se,
    ci95: [rtp - 1.96 * se, rtp + 1.96 * se],
    sd: Math.sqrt(variance),
    hit: w((r) => r.hitFrequencyIncludingFeature),
    baseHit: w((r) => r.baseSpinHitFrequency),
    trigger: w((r) => r.featureTriggerRate),
    comps,
    thresholds,
    maxReturn: Math.max(...runs.map((r) => r.maxReturnObserved)),
    maxCredit: Math.max(...runs.map((r) => r.maxCreditObserved)),
    violations: runs.reduce((s, r) => s + r.invariantViolations, 0),
    extra: runs.reduce((acc, r) => { for (const [k, v] of Object.entries(r.extra)) acc[k] = (acc[k] ?? 0) + v; return acc; }, {}),
  };
}

const zScore = (estimate, exact, se) => (estimate - exact) / se;

module.exports = { read, exists, group, pct, mult, oneIn, sci, credits, table, pool, zScore };
