const Game2048 = {
    name: "2048", hasHD: true,
    hiscore: parseInt(localStorage.getItem('bg_2048_hi')) || 0,
    init(sp, lvl, isHD, replayData = null) { 
        this.isHD = isHD; this.cols = 4; this.rows = 4; this.cellSize = 80;
        App.updateGridSize(this.cols, this.rows, this.cellSize);
        this.grid = Array(this.cols).fill().map(() => Array(this.rows).fill(0)); 
        this.score = 0; this.newHighScore = false; 
        
        this.isReplay = !!replayData;
        this.seedPieces = this.isReplay ? replayData.seed : [];
        this.seedIdx = 0;
        
        this.addRandomTile(); this.addRandomTile(); 
        UI.update(this.score, this.hiscore, '-', '-'); 
    },
    addRandomTile() { 
        if(this.isReplay && this.seedIdx < this.seedPieces.length) {
            let tile = this.seedPieces[this.seedIdx++];
            this.grid[tile.x][tile.y] = tile.v; return;
        }
        let empty = []; 
        for(let i=0; i<this.cols; i++) for(let j=0; j<this.rows; j++) if(this.grid[i][j]===0) empty.push([i,j]); 
        if(empty.length===0) return; 
        let [x,y] = empty[Math.floor(Math.random()*empty.length)]; 
        let v = Math.random()<0.9 ? 2 : 4;
        this.grid[x][y] = v; 
        if(!this.isReplay) this.seedPieces.push({x: x, y: y, v: v});
    },
    move(dir) {
        let moved = false, addedScore = 0;
        const rotate = (grid, times) => { for(let t=0; t<times; t++) grid = grid[0].map((_, idx) => grid.map(row => row[idx]).reverse()); return grid; };
        let work = JSON.parse(JSON.stringify(this.grid));
        if(dir === 'RIGHT') work = work.map(row => row.reverse()); else if(dir === 'UP') work = rotate(work, 3); else if(dir === 'DOWN') work = rotate(work, 1);
        for(let i=0; i<this.cols; i++) {
            let row = work[i].filter(v => v!==0);
            for(let j=0; j<row.length-1; j++) { if(row[j] === row[j+1]) { row[j] *= 2; addedScore += row[j]; row.splice(j+1,1); } }
            while(row.length < this.cols) row.push(0); work[i] = row;
        }
        if(dir === 'RIGHT') work = work.map(row => row.reverse()); if(dir === 'UP') work = rotate(work, 1); if(dir === 'DOWN') work = rotate(work, 3);
        if(JSON.stringify(work) !== JSON.stringify(this.grid)) { 
            moved = true; this.grid = work; this.score += addedScore; 
            if(this.score > this.hiscore) { this.hiscore = this.score; this.newHighScore = true; } 
            UI.update(this.score, this.hiscore, '-', '-'); 
            let hasEmpty = this.grid.some(row => row.some(v => v === 0));
            if (hasEmpty) this.addRandomTile(); 
            if(this.checkGameOver()) App.setState('GAMEOVER'); 
        }
    },
    checkGameOver() { 
        for(let i=0; i<this.cols; i++) for(let j=0; j<this.cols; j++) if(this.grid[i][j]===0) return false; 
        for(let i=0; i<this.cols; i++) for(let j=0; j<this.cols-1; j++) if(this.grid[i][j]===this.grid[i][j+1]) return false; 
        for(let i=0; i<this.cols-1; i++) for(let j=0; j<this.cols; j++) if(this.grid[i][j]===this.grid[i+1][j]) return false; 
        return true; 
    },
    update(dt) {},
    draw() {
        clearCanvas(ctx, this.cols, this.rows, this.cellSize, this.isHD);
        for(let i=0; i<this.rows; i++) {
            for(let j=0; j<this.cols; j++) {
                let val = this.grid[i][j];
                if(val !== 0) {
                    if (this.isHD) { 
                        drawLCDPixel(ctx, j, i, this.cellSize, true, this.getColor(val), true); 
                    } else { 
                        drawLCDPixel(ctx, j, i, this.cellSize, true, null, false); 
                    }
                    // В ретро-режиме текст белый, в HD — тёмный
                    ctx.fillStyle = this.isHD ? '#111' : '#fff';
                    ctx.font = `bold ${this.cellSize*0.35}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(val, j*this.cellSize + this.cellSize/2, i*this.cellSize + this.cellSize/2);
                }
            }
        }
    },
    getColor(val) { const c = { 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' }; return c[val] || '#edc22e'; },
    drawMini(isHD) { 
        clearCanvas(miniCtx, 4, 4, 20, isHD); 
        if(isHD) { miniCtx.fillStyle = '#edc22e'; miniCtx.fillRect(10, 10, 60, 60); } 
        else { drawGridMatrix(miniCtx, [[0,0,0,0],[0,1,1,0],[0,1,1,0],[0,0,0,0]], 0, 0, 20, false); }
    },
    input(action) { if(['LEFT','RIGHT','UP','DOWN'].includes(action)) this.move(action); },
    onGameOver() { if(this.newHighScore && !this.isReplay) { TTS.speak("Новый рекорд!"); localStorage.setItem('bg_2048_hi', this.hiscore); } }
};
window.GAMES.push(Game2048);