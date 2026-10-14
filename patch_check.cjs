const fs = require('fs');
let code = fs.readFileSync('src/game/GameEngine.ts', 'utf8');

const regex = /\.([a-zA-Z0-9_]+)/g;
let match;
while ((match = regex.exec(code)) !== null) {
  // if (match[1] === 'x') console.log(match[0]);
}

// find all ".x " or ".x," or ".x)" or ".x+"
