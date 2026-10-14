const fs = require('fs');
let code = fs.readFileSync('src/game/GameEngine.ts', 'utf8');

let target1 = `  gameMode: 'devastated_path' | 'battle' | 'tutorial' = 'battle';
  mobs: Array<any> = [];
`;
let replacement1 = target1 + `  hordeWave: number = 0;
  hordeTimer: number = 2.0;
  hordeMobsRemaining: number = 0;
  hordeState: 'waiting' | 'spawning' | 'cleared' = 'waiting';
`;

code = code.replace(target1, replacement1);
fs.writeFileSync('src/game/GameEngine.ts', code);
