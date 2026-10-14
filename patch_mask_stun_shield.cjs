const fs = require('fs');
let code = fs.readFileSync('src/game/GameEngine.ts', 'utf8');

// Disable shield blocks
let shieldMelee = `                  if (this.eyeMiniBoss.shieldActive) {
                      // Deflected by shield
                      this.playSound('hit');
                      this.spawnHitParticles(hitX, hitY, Math.cos(this.player.attackAngle));
                  } else {`;
code = code.replace(shieldMelee, "                  if (false) {\n                  } else {");

let shieldProj = `                if (this.eyeMiniBoss.shieldActive) {
                    // Deflected by shield
                    this.playSound('hit');
                } else {`;
code = code.replace(shieldProj, "                if (false) {\n                } else {");

// Disable mask stun (melee hitting mask and flying to boss)
let maskStunOld = `              if (dist < 50) {
                  if (this.enemy.phase === 3) {
                      if (this.eyeMiniBoss.shieldActive) {
                          this.eyeMiniBoss.shieldHp -= 1;
                          this.playSound('hit');
                          this.bossSubtitleText = '"SHIELD WEAKENING..."';
                          this.bossSubtitleTimer = 1.0;
                          if (this.eyeMiniBoss.shieldHp <= 0) {
                              this.eyeMiniBoss.shieldActive = false;
                              this.eyeMiniBoss.shieldDownTimer = 12.0;
                              this.bossSubtitleText = '"MY PROTECTION IS GONE!"';
                              this.bossSubtitleTimer = 2.0;
                          }
                      } else {
                          this.eyeMiniBoss.hp -= 30;
                          this.dealDamage(30);
                          this.playSound('hit');
                      }
                  } else {
                      this.enemy.hp -= 30;
                      this.dealDamage(30);
                      this.enemy.state = 'stunned';
                      this.enemy.stateTimer = 2.0;
                      this.bossSubtitleText = '"AGH! STOP THIS!"';
                      this.bossSubtitleTimer = 2.0;
                      this.playSound('hit');
                  }
                  this.spawnHitParticles(m.x, m.y, 0);
                  this.notifyHpChange();
                  this.masks.splice(i, 1);
                  continue;`;

let maskStunNew = `              if (dist < 50) {
                  if (this.enemy.phase === 3) {
                      this.eyeMiniBoss.hp -= 30;
                      this.dealDamage(30);
                      this.playSound('hit');
                  } else {
                      this.enemy.hp -= 30;
                      this.dealDamage(30);
                      this.playSound('hit');
                  }
                  this.spawnHitParticles(m.x, m.y, 0);
                  this.notifyHpChange();
                  this.masks.splice(i, 1);
                  continue;`;

code = code.replace(maskStunOld, maskStunNew);

// Add gold mask attack speed buff and heal
let goldMaskDestroyOld = `                          if (m.type === 'gold') {
                              for (let k = 0; k < 12; k++) {
                                  const angle = (Math.PI * 2 / 12) * k;
                                  this.projectiles.push({
                                      x: m.x, y: m.y,
                                      vx: Math.cos(angle) * 250,
                                      vy: Math.sin(angle) * 250,
                                      radius: 12, hp: 1, life: 10,
                                      type: 'blast', color: '#fbbf24', neutral: true
                                  });
                              }
                              this.masks.splice(i, 1);
                              i--;
                              continue;
                          }`;

let goldMaskDestroyNew = `                          if (m.type === 'gold') {
                              for (let k = 0; k < 12; k++) {
                                  const angle = (Math.PI * 2 / 12) * k;
                                  this.projectiles.push({
                                      x: m.x, y: m.y,
                                      vx: Math.cos(angle) * 250,
                                      vy: Math.sin(angle) * 250,
                                      radius: 12, hp: 1, life: 10,
                                      type: 'blast', color: '#fbbf24', neutral: true
                                  });
                              }
                              this.player.buffTimer = 3.0; // Attack speed boost
                              this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1); // Heal 1 HP
                              if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                              this.masks.splice(i, 1);
                              i--;
                              continue;
                          }`;

code = code.replace(goldMaskDestroyOld, goldMaskDestroyNew);

let goldMaskDestroyProjOld = `                          if (m.type === 'gold') {
                              for (let k = 0; k < 12; k++) {
                                  const angle = (Math.PI * 2 / 12) * k;
                                  this.projectiles.push({
                                      x: m.x, y: m.y,
                                      vx: Math.cos(angle) * 250,
                                      vy: Math.sin(angle) * 250,
                                      radius: 12, hp: 1, life: 10,
                                      type: 'blast', color: '#fbbf24', neutral: true
                                  });
                              }
                              this.masks.splice(j, 1);
                              j--;
                              break;
                          }`;

let goldMaskDestroyProjNew = `                          if (m.type === 'gold') {
                              for (let k = 0; k < 12; k++) {
                                  const angle = (Math.PI * 2 / 12) * k;
                                  this.projectiles.push({
                                      x: m.x, y: m.y,
                                      vx: Math.cos(angle) * 250,
                                      vy: Math.sin(angle) * 250,
                                      radius: 12, hp: 1, life: 10,
                                      type: 'blast', color: '#fbbf24', neutral: true
                                  });
                              }
                              this.player.buffTimer = 3.0; // Attack speed boost
                              this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1); // Heal 1 HP
                              if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                              this.masks.splice(j, 1);
                              j--;
                              break;
                          }`;

code = code.replace(goldMaskDestroyProjOld, goldMaskDestroyProjNew);

fs.writeFileSync('src/game/GameEngine.ts', code);
