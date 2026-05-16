const Snake = {
    name: "Змейка", hasHD: true,
    hiscore: parseInt(localStorage.getItem('bg_snake_hi')) || 0,
    colors: ['#F00', '#0F0', '#00F', '#FF0', '#0FF', '#F0F'],
    init(sp, lvl, isHD, replayData = null) {
        this.isHD = isHD; this.level = lvl; this.speed = sp;
        this.cols = 10; this.rows = 20; this.cellSize = 20;
        App.updateGridSize(this.cols, this.rows, this.cellSize);
        
        this.body = [{x:5,y:10,c:'#0F0'},{x:5,y:11,c:'#0F0'},{x:5,y:12,c:'#0F0'}];
        this.dir = {x:0,y:-1}; this.queue = []; this.score = 0; this.turbo = false; this.walls = []; this.eatAnim = null;
        this.moveCounter = 0; // инициализация
        
        // очистка старого таймера, если есть
        if (this.turboTimer) clearTimeout(this.turboTimer);
        this.turboTimer = null;
        
        this.isReplay = !!replayData;
        this.seedPieces = this.isReplay ? replayData.seed : [];
        this.seedIdx = 0;
        
        this.spawnApple(); this.newHighScore = false;
    },
    getPan() { return (this.body[0].x / this.cols) * 2 - 1; },
    spawnApple() {
        if (this.isReplay && this.seedIdx < this.seedPieces.length) {
            this.apple = this.seedPieces[this.seedIdx++]; return;
        }
        let free = false;
        while(!free) {
            this.apple = { x: Math.floor(Math.random()*this.cols), y: Math.floor(Math.random()*this.rows), c: this.colors[Math.floor(Math.random()*this.colors.length)] };
            if(!this.body.some(s=>s.x===this.apple.x && s.y===this.apple.y)) free = true;
        }
        if(!this.isReplay) this.seedPieces.push(this.apple);
    },
    update(dt) {
        if (this.eatAnim) { this.eatAnim.timer -= dt; if (this.eatAnim.timer <= 0) this.eatAnim = null; }
        this.moveCounter += dt;
        if(this.moveCounter >= getSpeedInterval(450, 40, this.speed) / (this.turbo ? 2.5 : 1)) {
            this.moveCounter = 0; if(this.queue.length > 0) this.dir = this.queue.shift();
            const head = { x: this.body[0].x + this.dir.x, y: this.body[0].y + this.dir.y, c: this.body[0].c };
            if(head.x<0 || head.x>=this.cols || head.y<0 || head.y>=this.rows || this.body.some(s=>s.x===head.x && s.y===head.y)) { App.setState('GAMEOVER'); return; }
            this.body.unshift(head);
            if(head.x === this.apple.x && head.y === this.apple.y) {
                AudioFX.clear(); vibrate(50); this.score += 10 * this.level; this.eatAnim = {x: head.x, y: head.y, timer: 200};
                if(this.score > (this.hiscore||0)) { this.hiscore = this.score; this.newHighScore = true; }
                UI.update(this.score, this.hiscore||0, this.speed, this.level);
                if(this.isHD) this.body[0].c = this.apple.c; this.spawnApple();
            } else { this.body.pop(); AudioFX.move(this.getPan()); }
        }
    },
    draw() {
        clearCanvas(ctx, this.cols, this.rows, this.cellSize, this.isHD);
        drawLCDPixel(ctx, this.apple.x, this.apple.y, this.cellSize, true, this.isHD ? this.apple.c : null, this.isHD);
        if (this.eatAnim) { [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx,dy]) => drawLCDPixel(ctx, this.eatAnim.x+dx, this.eatAnim.y+dy, this.cellSize, true, null, this.isHD)); }
        this.body.forEach((b, i) => drawLCDPixel(ctx, b.x, b.y, this.cellSize, true, (this.isHD && i===0 && Math.floor(Date.now()/200)%2===0) ? '#FFF' : (this.isHD?b.c:null), this.isHD));
    },
    drawMini(isHD) { clearCanvas(miniCtx, 4, 4, 20, isHD); [[1,1],[2,1],[2,2]].forEach(([x,y])=>drawLCDPixel(miniCtx, x, y, 20, true, isHD?'#0F0':null, isHD)); },
    input(action) {
        if(action === 'ACTION') { 
            if (this.turboTimer) clearTimeout(this.turboTimer);
            this.turbo = true; 
            this.turboTimer = setTimeout(()=> this.turbo = false, 200);
            return; 
        }
        let lastDir = this.queue.length > 0 ? this.queue[this.queue.length-1] : this.dir;
        if(this.queue.length < 2) {
            if(action === 'LEFT' && lastDir.x !== 1) this.queue.push({x:-1,y:0}); if(action === 'RIGHT' && lastDir.x !== -1) this.queue.push({x:1,y:0});
            if(action === 'UP' && lastDir.y !== 1) this.queue.push({x:0,y:-1}); if(action === 'DOWN' && lastDir.y !== -1) this.queue.push({x:0,y:1});
        }
    },
    onGameOver() { if(this.newHighScore && !this.isReplay) { TTS.speak("Новый рекорд!"); localStorage.setItem('bg_snake_hi', this.hiscore); } }
};
window.GAMES.push(Snake);