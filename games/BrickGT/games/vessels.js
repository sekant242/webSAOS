const Vessels = {
    name: "Сосуды", hasHD: true,
    hiscore: parseInt(localStorage.getItem('bg_vessels_hi')) || 0,
    colors: ['#000', '#F00', '#0F0', '#00F', '#FF0', '#0FF', '#F0F', '#F80', '#80F', '#08F', '#8F0'],
    init(sp, lvl, isHD, replayData = null) {
        this.isHD = isHD; this.level = lvl; this.speed = sp;
        this.tubesCount = Math.min(lvl + 2, 10);
        this.colorCount = this.tubesCount - 2;
        this.cols = this.tubesCount * 6 + 1; this.rows = 22; this.cellSize = 20; 
        App.updateGridSize(this.cols, this.rows, this.cellSize);
        
        this.score = 0; this.newHighScore = false;
        this.isReplay = !!replayData;
        
        if (this.isReplay) {
            this.tubes = JSON.parse(JSON.stringify(replayData.seed));
        } else {
            this.generatePuzzle();
            this.seedPieces = JSON.parse(JSON.stringify(this.tubes));
        }
        
        this.selectedTube = 0; this.liftedTube = null; 
    },
    getPan() { return (this.selectedTube / this.tubesCount) * 2 - 1; },
    generatePuzzle() {
        this.tubes = []; let pool = [];
        for(let i=1; i<=this.colorCount; i++) { for(let j=0; j<4; j++) pool.push(i); }
        for(let i=pool.length-1; i>0; i--) { let j = Math.floor(Math.random()*(i+1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        for(let i=0; i<this.tubesCount; i++) { if(i < this.colorCount) this.tubes.push([pool.pop(), pool.pop(), pool.pop(), pool.pop()]); else this.tubes.push([]); }
    },
    update(dt) {},
    draw() {
        clearCanvas(ctx, this.cols, this.rows, this.cellSize, this.isHD);
        for (let i = 0; i < this.tubesCount; i++) {
            let baseX = 1 + i * 6; let baseY = 4;
            if (this.liftedTube === i) baseY -= 2;
            // стенки теперь рисуются всегда, в ретро-режиме тоже
            let wallColor = this.isHD ? '#888' : '#888';
            for (let y = 0; y < 13; y++) { drawLCDPixel(ctx, baseX, baseY + y, this.cellSize, true, wallColor, this.isHD); drawLCDPixel(ctx, baseX + 4, baseY + y, this.cellSize, true, wallColor, this.isHD); }
            for (let x = 0; x <= 4; x++) { drawLCDPixel(ctx, baseX + x, baseY + 13, this.cellSize, true, wallColor, this.isHD); }
            if (this.selectedTube === i) { drawLCDPixel(ctx, baseX + 2, baseY + 15, this.cellSize, true, this.isHD ? '#FF0' : null, this.isHD); }

            let tube = this.tubes[i];
            for (let u = 0; u < tube.length; u++) {
                let colorIdx = tube[u], hColor = this.isHD ? this.colors[colorIdx] : null;
                let startY = baseY + 13 - (u + 1) * 3;
                for (let dy = 0; dy < 3; dy++) {
                    for (let dx = 0; dx < 3; dx++) {
                        let cx = baseX + 1 + dx, cy = startY + dy, active = true;
                        if (!this.isHD) {
                            if (colorIdx === 1) active = true; else if (colorIdx === 2) active = (cx + cy) % 2 === 0; else if (colorIdx === 3) active = cy % 2 === 0; else if (colorIdx === 4) active = cx % 2 === 0; else if (colorIdx === 5) active = (cx + cy) % 3 === 0; else if (colorIdx === 6) active = cx === baseX+2 || cy === startY+1; else if (colorIdx === 7) active = cx % 2 !== 0 && cy % 2 !== 0; else if (colorIdx === 8) active = (cx - cy) % 2 === 0; 
                        }
                        if (active) drawLCDPixel(ctx, cx, cy, this.cellSize, true, hColor, this.isHD);
                    }
                }
            }
        }
    },
    drawMini(isHD) {
        clearCanvas(miniCtx, 4, 4, 20, isHD);
        [[1,1],[1,2],[2,2],[3,2],[3,1]].forEach(([x,y])=>drawLCDPixel(miniCtx, x, y, 20, true, isHD?'#888':null, isHD));
        drawLCDPixel(miniCtx, 2, 1, 20, true, isHD?'#08F':null, isHD);
    },
    input(action) {
        if (action === 'LEFT') { this.selectedTube = (this.selectedTube - 1 + this.tubesCount) % this.tubesCount; AudioFX.move(this.getPan()); }
        if (action === 'RIGHT') { this.selectedTube = (this.selectedTube + 1) % this.tubesCount; AudioFX.move(this.getPan()); }
        if (action === 'ACTION' || action === 'HARD') {
            if (this.liftedTube === null) {
                if (this.tubes[this.selectedTube].length > 0) { this.liftedTube = this.selectedTube; AudioFX.move(this.getPan()); vibrate(20); }
            } else {
                let src = this.tubes[this.liftedTube], dst = this.tubes[this.selectedTube];
                if (this.liftedTube === this.selectedTube) { this.liftedTube = null; AudioFX.move(this.getPan()); } 
                else if (dst.length < 4 && (dst.length === 0 || dst[dst.length - 1] === src[src.length - 1])) {
                    let colorToPour = src[src.length - 1], poured = false;
                    while(src.length > 0 && src[src.length - 1] === colorToPour && dst.length < 4) { dst.push(src.pop()); poured = true; }
                    this.liftedTube = null; if(poured) { AudioFX.pour(); vibrate(50); this.checkWin(); }
                } else { this.liftedTube = null; AudioFX.crash(); vibrate(100); }
            }
        }
    },
    checkWin() {
        let won = true;
        for(let t of this.tubes) { if(t.length > 0 && (t.length < 4 || new Set(t).size !== 1)) won = false; }
        if(won) {
            this.score += 100 * this.level;
            if(this.score > this.hiscore) { this.hiscore = this.score; this.newHighScore = true; localStorage.setItem('bg_vessels_hi', this.hiscore); }
            UI.update(this.score, this.hiscore, this.speed, this.level); TTS.speak("Уровень пройден");
            this.level++; if (this.speed < 10) this.speed++;
            setTimeout(() => this.init(this.speed, this.level, this.isHD), 1500);
        }
    },
    onGameOver() { if(this.newHighScore && !this.isReplay) { TTS.speak("Новый рекорд!"); localStorage.setItem('bg_vessels_hi', this.hiscore); } }
};
window.GAMES.push(Vessels);