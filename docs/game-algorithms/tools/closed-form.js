// Exact figures for the games whose rules need no assumption about symbol chances.
// SKYFALL uses the house edge from skyfall.config.ts (HOUSE_EDGE); Tiger Clash and Roulette have no settings.
const EDGE = 0.05; // HOUSE_EDGE in skyfall.config.ts
const GROWTH = 0.105;

console.log('SKYFALL (house edge ' + EDGE * 100 + '%)');
for (const m of [1.01, 1.5, 2, 3, 5, 10, 50, 100, 1000]) {
  const reach = Math.min(1, (1 - EDGE) / m);
  console.log('  aim ' + String(m).padEnd(5) + 'x  P(win) = ' + (reach * 100).toFixed(3) + '%   return = ' + (reach * m * 100).toFixed(1) + '%   flight time = ' + (Math.log(m) / GROWTH).toFixed(1) + ' s');
}
console.log('  instant crash (1.00x): ' + EDGE * 100 + '%   median crash point: ' + ((1 - EDGE) / 0.5).toFixed(2) + 'x');

console.log('TIGER CLASH (52-card deck)');
const tie = 3 / 51, side = 24 / 51;
console.log('  P(Tiger) = P(Dragon) = ' + (side * 100).toFixed(3) + '%   P(Tie) = ' + (tie * 100).toFixed(3) + '%');
console.log('  return, Tiger/Dragon bet = ' + ((side * 2 + tie * 0.5) * 100).toFixed(2) + '%   return, Tie bet = ' + (tie * 9 * 100).toFixed(2) + '%');

console.log('ROULETTE (European, 37 pockets)');
const bets = { straight: [1, 35], split: [2, 17], street: [3, 11], corner: [4, 8], sixline: [6, 5], dozen: [12, 2], column: [12, 2], 'red/black/odd/even/low/high': [18, 1] };
for (const [name, [n, win]] of Object.entries(bets)) {
  console.log('  ' + name.padEnd(30) + 'P(win) = ' + ((n / 37) * 100).toFixed(3) + '%   return = ' + ((n / 37) * (win + 1) * 100).toFixed(3) + '%');
}
