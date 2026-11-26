// Writes docs/game-mathematics/pharaohs-fortune.md from the measured/exact result files.
//   node build-pharaoh-report.js
const fs = require('node:fs');
const path = require('node:path');
const md = require('./docs-pharaoh')();
fs.writeFileSync(path.join(__dirname, '..', 'pharaohs-fortune.md'), md);
console.log('written', md.length, 'characters');
