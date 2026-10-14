const fs = require('fs');
let code = fs.readFileSync('src/game/GameEngine.ts', 'utf8');

let drawOld = `        mainCtx.fillText(this.bossSubtitleText, ROOM_WIDTH / 2, FLOOR_Y - 200);
        mainCtx.restore();
    }`;

let drawNew = `        mainCtx.fillText(this.bossSubtitleText, ROOM_WIDTH / 2, FLOOR_Y - 200);
        mainCtx.restore();
    }

    if (this.gameMode === 'tutorial') {
        mainCtx.save();
        mainCtx.fillStyle = 'white';
        mainCtx.font = '24px "Press Start 2P", sans-serif';
        mainCtx.textAlign = 'center';
        mainCtx.shadowColor = 'black';
        mainCtx.shadowBlur = 4;
        mainCtx.fillText("Press A/D to Move, SPACE to Jump, Click to Attack", ROOM_WIDTH / 2, 110);
        mainCtx.restore();
    }`;

code = code.replace(drawOld, drawNew);
fs.writeFileSync('src/game/GameEngine.ts', code);
