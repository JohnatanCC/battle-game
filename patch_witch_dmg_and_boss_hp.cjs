const fs = require('fs');
let code = fs.readFileSync('src/game/GameEngine.ts', 'utf8');

// 1. Change witch damage to 3
code = code.replace(
    /damage: 1,\n              lifeTime/g,
    "damage: 3,\n              lifeTime"
);

// 2. Change eyeMiniBoss hp to 500
code = code.replace(
    /hp: 800, maxHp: 800,/g,
    "hp: 500, maxHp: 500,"
);
code = code.replace(
    /this.eyeMiniBoss.hp = 800;\n      this.eyeMiniBoss.maxHp = 800;/g,
    "this.eyeMiniBoss.hp = 500;\n      this.eyeMiniBoss.maxHp = 500;"
);

// 3. Remove shield drawing
code = code.replace(
    /if \(this.enemy.phase === 3 && this.eyeMiniBoss.shieldActive\)/g,
    "if (false)"
);

// Remove shield recovery logic
let shieldRecovery = `          if (!this.eyeMiniBoss.shieldActive) {
              this.eyeMiniBoss.shieldDownTimer -= dt;
              if (this.eyeMiniBoss.shieldDownTimer <= 0) {
                  this.eyeMiniBoss.shieldActive = true;
                  this.eyeMiniBoss.shieldHp = this.eyeMiniBoss.maxShieldHp || 2;
                  this.bossSubtitleText = '"MY SHIELD RETURNS!"';
                  this.bossSubtitleTimer = 2.0;
              }
          }`;
code = code.replace(shieldRecovery, "");

fs.writeFileSync('src/game/GameEngine.ts', code);
