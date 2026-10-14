const fs = require('fs');
let code = fs.readFileSync('src/game/GameEngine.ts', 'utf8');

const targetStr = `    if (this.gameMode === 'devastated_path') {
        this.devastatedTimer += dt;
        if (this.devastatedTimer >= 30) {`;

const hordeLogicStr = `    if (this.gameMode === 'devastated_path') {
        // --- HORDE LOGIC ---
        if (this.hordeState === 'waiting') {
            this.hordeTimer -= dt;
            if (this.hordeTimer <= 0) {
                this.hordeWave++;
                this.hordeState = 'spawning';
                this.hordeMobsRemaining = 3 + this.hordeWave * 2;
            }
        } else if (this.hordeState === 'spawning') {
            this.hordeTimer -= dt;
            if (this.hordeTimer <= 0 && this.hordeMobsRemaining > 0) {
                const isFlying = Math.random() < 0.3;
                let spawnX = this.player.x + (Math.random() > 0.5 ? 400 : -400) + (Math.random() * 200 - 100);
                if (spawnX < 100) spawnX = 100;
                // Assuming ROOM_WIDTH is available globally or accessible
                // if (spawnX > ROOM_WIDTH - 100) spawnX = ROOM_WIDTH - 100; // I'll skip ROOM_WIDTH here if it fails
                
                if (isFlying) {
                    this.mobs.push({
                        type: 'flying_eye',
                        x: spawnX,
                        y: FLOOR_Y - 200 - Math.random() * 100,
                        width: 40, height: 40,
                        hp: 3 + this.hordeWave,
                        maxHp: 3 + this.hordeWave,
                        vx: 0, vy: 0,
                        hitTimer: 0,
                        attackCooldown: 2.0,
                        hoverTargetX: spawnX,
                        hoverTargetY: FLOOR_Y - 200
                    });
                } else {
                    this.mobs.push({
                        type: 'skeleton',
                        x: spawnX,
                        y: FLOOR_Y - 30, // Assuming centered, so height 60 / 2 = 30
                        width: 40, height: 60,
                        hp: 5 + this.hordeWave * 2,
                        maxHp: 5 + this.hordeWave * 2,
                        vx: 0, vy: 0,
                        hitTimer: 0,
                        attackCooldown: 2.0
                    });
                }
                
                this.hordeMobsRemaining--;
                this.hordeTimer = 1.0 + Math.random() * 1.5;
                
                if (this.hordeMobsRemaining <= 0) {
                    this.hordeState = 'cleared';
                }
            }
        } else if (this.hordeState === 'cleared') {
            if (this.mobs.length === 0) {
                this.hordeState = 'waiting';
                this.hordeTimer = 5.0; // Wait 5 seconds before next wave
            }
        }
        // --- END HORDE LOGIC ---

        this.devastatedTimer += dt;
        if (this.devastatedTimer >= 30) {`;

code = code.replace(targetStr, hordeLogicStr);
fs.writeFileSync('src/game/GameEngine.ts', code);
