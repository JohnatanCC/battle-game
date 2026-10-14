const fs = require('fs');
let code = fs.readFileSync('src/game/GameEngine.ts', 'utf8');

code = code.replace(/loop = \(time: number\) => \{/, `loop = (time: number) => {
    try {`);

code = code.replace(/this\.animationId = requestAnimationFrame\(this\.loop\);\n  \};/, `this.animationId = requestAnimationFrame(this.loop);
    } catch(e) {
       console.error(e);
       this.ctx.fillStyle = 'red';
       this.ctx.font = '20px sans-serif';
       this.ctx.fillText(e.stack || e.message, 50, 50);
       throw e;
    }
  };`);

fs.writeFileSync('src/game/GameEngine.ts', code);
