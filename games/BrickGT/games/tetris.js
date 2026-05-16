const Tetris = {
    name: "Тетрис", hasHD: true,
    hiscore: parseInt(localStorage.getItem('bg_tetris_hi')) || 0,
    pieces: ['T', 'J', 'L', 'O', 'S', 'Z', 'I'],
    colors: { 'T':'#FF00FF', 'O':'#FFFF00', 'L':'#FFA500', 'J':'#0000FF', 'I':'#00FFFF', 'S':'#00FF00', 'Z':'#FF0000', 'X':'#555555', 'F':'#FFFFFF' },
    init(sp, lvl, isHD, replayData = null) { 
        this.isHD = isHD; this.level = lvl; this.speed = sp;
        this.cols = 10; this.rows = 20; this.cellSize = 20;
        App.updateGridSize(this.cols, this.rows, this.cellSize);
        
        this.arena = new Array(this.rows).fill(0).map(()=>new Array(this.cols).fill(0));
        this.score = 0; this.lines = 0; this.combo = 1; 
        this.animTimer = 0;      // сброс анимации
        this.linesToClear = [];
        this.dropCounter = 0;    // сброс падения
        this.newHighScore = false;
        
        this.isReplay = !!replayData;
        this.seedPieces = this.isReplay ? replayData.seed : [];
        this.seedIdx = 0;

        this.bag = []; this.nextPiece = this.getNextPiece(); this.spawnNewPiece();
    },
    getPan() { return (this.player.pos.x / this.cols) * 2 - 1; },
    initBag() { 
        this.bag = [...this.pieces]; 
        for(let i=this.bag.length-1; i>0; i--) { const j = Math.floor(Math.random()*(i+1)); [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; } 
    },
    getNextPiece() { 
        if(this.isReplay && this.seedIdx < this.seedPieces.length) return this.seedPieces[this.seedIdx++];
        if(this.bag.length === 0) this.initBag(); 
        let p = this.bag.pop();
        if(!this.isReplay) this.seedPieces.push(p);
        return p; 
    },
    createPiece(type) { const map = { 'T':[[0,'T',0],['T','T','T'],[0,0,0]], 'O':[['O','O'],['O','O']], 'L':[[0,'L',0],[0,'L',0],[0,'L','L']], 'J':[[0,'J',0],[0,'J',0],['J','J',0]], 'I':[[0,'I',0,0],[0,'I',0,0],[0,'I',0,0],[0,'I',0,0]], 'S':[[0,'S','S'],['S','S',0],[0,0,0]], 'Z':[['Z','Z',0],[0,'Z','Z'],[0,0,0]] }; return map[type]; },
    collide(arena, player) {
        for(let y=0; y<player.matrix.length; y++) for(let x=0; x<player.matrix[y].length; x++) if(player.matrix[y][x]) {
            const ax = player.pos.x + x, ay = player.pos.y + y;
            if(ax<0 || ax>=this.cols || ay>=this.rows || ay<0 || (ay>=0 && arena[ay][ax]!==0)) return true;
        } return false;
    },
    spawnNewPiece() {
        const type = this.nextPiece; this.nextPiece = this.getNextPiece();
        const matrix = this.createPiece(type);
        this.player = { pos: { x: Math.floor((this.cols - matrix[0].length)/2), y: 0 }, matrix: matrix, type: type };
        if(this.collide(this.arena, this.player)) App.setState('GAMEOVER');
    },
    getGhostY() { let y = this.player.pos.y; while(!this.collide(this.arena, { pos: { x: this.player.pos.x, y: y+1 }, matrix: this.player.matrix })) y++; return y; },
    merge() { this.player.matrix.forEach((row, y) => row.forEach((val, x) => { if(val) { const ny = y+this.player.pos.y, nx = x+this.player.pos.x; if(ny>=0 && ny<this.rows && nx>=0 && nx<this.cols) this.arena[ny][nx] = val; } })); },
    checkLines() {
        this.linesToClear = [];
        for(let y=0; y<this.rows; y++) if(this.arena[y].every(cell => cell!==0 && cell!=='X')) this.linesToClear.push(y);
        if(this.linesToClear.length > 0) {
            AudioFX.clear(); vibrate(100); this.animTimer = 400; 
            this.linesToClear.forEach(y => { for(let x=0; x<this.cols; x++) this.arena[y][x] = 'F'; }); 
        } else { this.combo = 1; AudioFX.drop(this.getPan()); this.spawnNewPiece(); }
    },
    sweep() {
        this.linesToClear.forEach(y => { this.arena.splice(y,1); this.arena.unshift(new Array(this.cols).fill(0)); });
        let c = this.linesToClear.length; this.lines += c;
        this.score += (c === 1 ? 100 : c === 2 ? 300 : c === 3 ? 500 : 800) * this.level * this.combo;
        if(c === 4) TTS.speak("Тетрис!"); else if(this.combo > 1) TTS.speak("Комбо " + this.combo);
        this.combo++;
        while(this.lines >= (this.level*10) && this.speed<10) { this.speed++; this.level++; TTS.speak("Быстрее"); }
        if(this.score > (this.hiscore||0)) { this.hiscore = this.score; this.newHighScore = true; }
        UI.update(this.score, this.hiscore||0, this.speed, this.level);
        this.linesToClear = []; this.spawnNewPiece();
    },
    move(dx) { if(this.animTimer>0) return; this.player.pos.x += dx; if(this.collide(this.arena, this.player)) this.player.pos.x -= dx; else AudioFX.move(this.getPan()); },
    drop() { if(this.animTimer>0) return; this.player.pos.y++; if(this.collide(this.arena, this.player)) { this.player.pos.y--; this.merge(); this.checkLines(); } this.dropCounter = 0; },
    rotate() {
        if(this.animTimer>0) return; const pos = this.player.pos.x, matrix = this.player.matrix;
        for(let y=0; y<matrix.length; y++) for(let x=0; x<y; x++) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        matrix.forEach(row => row.reverse()); let offset = 1;
        while(this.collide(this.arena, this.player)) {
            this.player.pos.x += offset; offset = -(offset + (offset>0?1:-1));
            if(Math.abs(offset) > matrix[0].length) {
                matrix.forEach(row => row.reverse()); for(let y=0; y<matrix.length; y++) for(let x=0; x<y; x++) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
                this.player.pos.x = pos; return;
            }
        } AudioFX.rotate(this.getPan());
    },
    input(action) {
        if(action === 'LEFT') this.move(-1); if(action === 'RIGHT') this.move(1); if(action === 'DOWN') { this.drop(); this.dropCounter = 0; } if(action === 'ACTION') this.rotate();
        if(action === 'HARD' && this.animTimer<=0) { while(!this.collide(this.arena, { pos: { x: this.player.pos.x, y: this.player.pos.y+1 }, matrix: this.player.matrix })) this.player.pos.y++; this.merge(); this.checkLines(); this.dropCounter = 0; vibrate(50); }
    },
    update(dt) {
        if (this.animTimer > 0) { this.animTimer -= dt; if (this.animTimer <= 0) this.sweep(); return; }
        this.dropCounter += dt; if(this.dropCounter > getSpeedInterval(800, 70, this.speed)) { this.drop(); this.dropCounter = 0; }
    },
    draw() {
        clearCanvas(ctx, this.cols, this.rows, this.cellSize, this.isHD);
        if (this.animTimer > 0 && Math.floor(this.animTimer / 100) % 2 === 0) this.linesToClear.forEach(y => { for(let x=0; x<this.cols; x++) this.arena[y][x] = 0; });
        else if (this.animTimer > 0) this.linesToClear.forEach(y => { for(let x=0; x<this.cols; x++) this.arena[y][x] = 'F'; });
        drawGridMatrix(ctx, this.arena, 0, 0, this.cellSize, this.isHD, this.colors);
        if(this.player && this.animTimer <= 0) {
            if (this.isHD) {
                drawGridMatrix(ctx, this.player.matrix, this.player.pos.x, this.getGhostY(), this.cellSize, this.isHD, {'T':'rgba(255,255,255,0.2)','O':'rgba(255,255,255,0.2)','L':'rgba(255,255,255,0.2)','J':'rgba(255,255,255,0.2)','S':'rgba(255,255,255,0.2)','Z':'rgba(255,255,255,0.2)','I':'rgba(255,255,255,0.2)'}); 
            }
            drawGridMatrix(ctx, this.player.matrix, this.player.pos.x, this.player.pos.y, this.cellSize, this.isHD, this.colors);
        }
    },
    drawMini(isHD) {
        clearCanvas(miniCtx, 4, 4, 20, isHD); if(!this.nextPiece) return;
        const m = this.createPiece(this.nextPiece);
        drawGridMatrix(miniCtx, m, Math.floor((4 - m[0].length)/2), Math.floor((4 - m.length)/2), 20, isHD, this.colors);
    },
    onGameOver() { if(this.newHighScore && !this.isReplay) { TTS.speak("Новый рекорд!"); localStorage.setItem('bg_tetris_hi', this.hiscore); } }
};
window.GAMES.push(Tetris);