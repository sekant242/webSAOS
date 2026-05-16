// core.js — исправленная версия
// Глобальный массив для игр
window.GAMES = [];

// Регистрация PWA
if ('serviceWorker' in navigator) {
    const swCode = `self.addEventListener('fetch', e => {}); self.addEventListener('install', e => self.skipWaiting());`;
    const blob = new Blob([swCode], {type: 'application/javascript'});
    navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(()=>{});
}

const CONFIG = {
    DEFAULT_COLS: 10, DEFAULT_ROWS: 20, DEFAULT_CELL_SIZE: 20,
    DEFAULT_SPEED: 1,
    DEFAULT_LEVEL: 1,
    REPEAT: { DELAY_MS: 300, INTERVAL_MS: 50 },
    SOUND_ENABLED: localStorage.getItem('bg_sound') !== 'false',
    MUSIC_ENABLED: localStorage.getItem('bg_music') === 'true',
    TTS_ENABLED: localStorage.getItem('bg_tts') !== 'false',
    DISCO_ENABLED: localStorage.getItem('bg_disco') !== 'false',
    VIBRATION_ENABLED: true,
    CONSOLE_COLOR: localStorage.getItem('bg_console_color') || '#dcdcdc',
    SOUND_FREQ: { MOVE: 400, ROTATE: 600, DROP: 300, CLEAR: 800, GAMEOVER: 200, CRASH: 150, START: 900, POUR: 500 }
};

const canvas = document.getElementById('mainCanvas'), ctx = canvas.getContext('2d');
const miniCanvas = document.getElementById('miniCanvas'), miniCtx = miniCanvas.getContext('2d');
miniCanvas.width = 80; miniCanvas.height = 80;

function vibrate(ms) { if(CONFIG.VIBRATION_ENABLED && navigator.vibrate && !BatteryManager.powerSave) navigator.vibrate(ms); }
function getSpeedInterval(base, step, speed) { return Math.max(40, base - (speed - 1) * step); }

// База данных для реплеев
const DB = {
    db: null,
    init() {
        const req = indexedDB.open("BrickGameDB", 1);
        req.onupgradeneeded = e => { this.db = e.target.result; if(!this.db.objectStoreNames.contains('replays')) this.db.createObjectStore('replays', {keyPath: 'id'}); };
        req.onsuccess = e => { this.db = e.target.result; };
    },
    saveReplay(gameName, score, inputs, seedData) {
        if(!this.db || inputs.length === 0) return;
        const tx = this.db.transaction('replays', 'readwrite');
        const entry = { id: Date.now() + Math.random() * 1000, game: gameName, score: score, inputs: inputs, seed: seedData }; // уникальный id
        tx.objectStore('replays').add(entry);
        tx.oncomplete = () => this.trimReplays(gameName);
    },
    trimReplays(gameName) {
        const tx = this.db.transaction('replays', 'readwrite');
        const store = tx.objectStore('replays');
        const req = store.getAll();
        req.onsuccess = () => {
            let replays = req.result.filter(r => r.game === gameName).sort((a,b) => b.score - a.score);
            if(replays.length > 5) for(let i=5; i<replays.length; i++) store.delete(replays[i].id);
        };
    },
    getRandomReplay(gameName, callback) {
        if(!this.db) return callback(null);
        const tx = this.db.transaction('replays', 'readonly');
        const req = tx.objectStore('replays').getAll();
        req.onsuccess = () => {
            let reps = req.result.filter(r => r.game === gameName);
            callback(reps.length > 0 ? reps[Math.floor(Math.random() * reps.length)] : null);
        };
    }
};
DB.init();

// Менеджер батареи
const BatteryManager = {
    level: 1, charging: true, powerSave: false,
    init() {
        if(navigator.getBattery) {
            navigator.getBattery().then(b => {
                this.update(b); b.addEventListener('levelchange', () => this.update(b)); b.addEventListener('chargingchange', () => this.update(b));
            });
        }
    },
    update(b) {
        this.level = b.level; this.charging = b.charging;
        this.powerSave = (!this.charging && this.level <= 0.2);
        document.body.classList.toggle('power-save-mode', this.powerSave);
        let icon = this.charging ? '⚡' : (this.level > 0.5 ? '🔋' : '🪫');
        document.getElementById('icon-bat').innerText = icon + Math.round(this.level*100) + '%';
    }
};
BatteryManager.init();

// Аудио и TTS
const TTS = {
    speak(text) {
        if (!CONFIG.TTS_ENABLED || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ru-RU'; utterance.rate = 1.2;
        // небольшая задержка, чтобы cancel успел сработать
        setTimeout(() => window.speechSynthesis.speak(utterance), 50);
    }
};

const AudioFX = {
    ctx: null, masterGain: null, bgmOsc: null, bgmTimer: null, noteIdx: 0,
    notes: [330, 247, 261, 294, 261, 247, 220, 220, 261, 330, 294, 261, 247, 247, 261, 294, 330, 261, 220, 220],
    init() { 
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)(); 
            this.masterGain = this.ctx.createGain(); this.masterGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume(); 
    },
    play(freq, type, duration, pan = 0) { 
        if (!CONFIG.SOUND_ENABLED || !this.ctx || this.ctx.state !== 'running') return; 
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(); 
        osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime); 
        
        let finalNode = gain;
        if (this.ctx.createStereoPanner) {
            const panner = this.ctx.createStereoPanner();
            panner.pan.value = Math.max(-1, Math.min(1, pan));
            gain.connect(panner); finalNode = panner;
        }
        finalNode.connect(this.masterGain);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration); 
        osc.connect(gain); osc.start(); osc.stop(this.ctx.currentTime + duration); 
    },
    startMusic(speed) {
        if(!CONFIG.MUSIC_ENABLED) return;
        this.stopMusic();
        if (!this.ctx) this.init();
        if (this.ctx.state !== 'running') return; // не запускаем, если контекст не активен
        let interval = Math.max(100, 300 - (speed * 15));
        this.bgmTimer = setInterval(() => {
            if(this.ctx && this.ctx.state === 'running') {
                this.play(this.notes[this.noteIdx], 'square', 0.1, 0);
                this.noteIdx = (this.noteIdx + 1) % this.notes.length;
            }
        }, interval);
    },
    stopMusic() { if(this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; } },
    move(pan=0) { this.play(CONFIG.SOUND_FREQ.MOVE, 'square', 0.05, pan); }, 
    rotate(pan=0) { this.play(CONFIG.SOUND_FREQ.ROTATE, 'square', 0.05, pan); },
    drop(pan=0) { this.play(CONFIG.SOUND_FREQ.DROP, 'square', 0.05, pan); }, 
    clear() { this.play(CONFIG.SOUND_FREQ.CLEAR, 'square', 0.1); },
    over() { this.play(CONFIG.SOUND_FREQ.GAMEOVER, 'sawtooth', 0.5); this.stopMusic(); },
    crash() { this.play(CONFIG.SOUND_FREQ.CRASH, 'sawtooth', 0.2); },
    pour() { this.play(CONFIG.SOUND_FREQ.POUR, 'triangle', 0.1); }
};

// UI Обновления
const UI = {
    update(s, hs, sp, lvl) {
        document.getElementById('lcd-score').innerText = String(s).padStart(6, '0');
        document.getElementById('lcd-hiscore').innerText = String(hs).padStart(6, '0');
        document.getElementById('lcd-speed').innerText = sp; document.getElementById('lcd-level').innerText = lvl;
    },
    updateIcons() {
        document.getElementById('icon-sound').innerText = CONFIG.SOUND_ENABLED ? "🔊" : "🔇";
        document.getElementById('icon-music').innerText = CONFIG.MUSIC_ENABLED ? "🎵" : "🤫";
        document.getElementById('icon-tts').innerText = CONFIG.TTS_ENABLED ? "💬" : "😶";
        document.getElementById('btn-toggle-sound').innerText = CONFIG.SOUND_ENABLED ? "ВКЛ" : "ВЫКЛ";
        document.getElementById('btn-toggle-music').innerText = CONFIG.MUSIC_ENABLED ? "ВКЛ" : "ВЫКЛ";
        document.getElementById('btn-toggle-tts').innerText = CONFIG.TTS_ENABLED ? "ВКЛ" : "ВЫКЛ";
        document.getElementById('btn-toggle-disco').innerText = CONFIG.DISCO_ENABLED ? "ВКЛ" : "ВЫКЛ";
    },
    setHDIndicator(visible, active) { document.getElementById('ind-hd').style.opacity = !visible ? '0' : active ? '1' : '0.2'; },
    applyConsoleStyle() { document.getElementById('console').style.background = CONFIG.CONSOLE_COLOR; }
};

// Рендеринг
function drawLCDPixel(context, x, y, size, isActive, color, isHD) {
    if (size <= 0) return; // защита от нуля
    if (!isHD) {
        const p = 2, ip = 2;
        // безопасный внутренний размер
        const innerW = Math.max(2, size - p*2);
        const innerH = Math.max(2, size - p*2);
        context.fillStyle = isActive ? '#111' : 'rgba(17, 17, 17, 0.08)';
        context.fillRect(x * size + p, y * size + p, innerW, innerH);
        context.fillStyle = '#7ea172';
        context.fillRect(x * size + p + 1, y * size + p + 1, Math.max(2, innerW - 2), Math.max(2, innerH - 2));
        context.fillStyle = isActive ? '#111' : 'rgba(17, 17, 17, 0.08)';
        context.fillRect(x * size + p + ip + 1, y * size + p + ip + 1, Math.max(2, innerW - ip*2 - 2), Math.max(2, innerH - ip*2 - 2));
    } else {
        context.fillStyle = color || (isActive ? '#222' : 'rgba(17, 17, 17, 0.03)');
        context.fillRect(x * size, y * size, size, size);
        if(isActive && color && !BatteryManager.powerSave) {
            context.fillStyle = 'rgba(255,255,255,0.3)'; context.fillRect(x * size, y * size, size, 2); context.fillRect(x * size, y * size, 2, size);
            context.fillStyle = 'rgba(0,0,0,0.3)'; context.fillRect(x * size + size - 2, y * size, 2, size); context.fillRect(x * size, y * size + size - 2, size, 2);
            context.fillStyle = color; context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
        } else if (isActive) {
            context.fillStyle = '#111'; context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
        }
    }
}

function drawGridMatrix(context, grid, offsetX, offsetY, cellSize, isHD, colorMap) {
    for(let y=0; y<grid.length; y++) {
        for(let x=0; x<grid[y].length; x++) {
            if(grid[y][x]) {
                let color = isHD ? (colorMap ? colorMap[grid[y][x]] : grid[y][x]) : null;
                drawLCDPixel(context, offsetX + x, offsetY + y, cellSize, true, color, isHD);
            }
        }
    }
}

function clearCanvas(ctx, cols, rows, cellSize, isHD) {
    const width = cols * cellSize;
    const height = rows * cellSize;
    ctx.clearRect(0, 0, width, height);
    if (!isHD) {
        ctx.fillStyle = '#7ea172'; 
        ctx.fillRect(0, 0, width, height);
    }
}

// Шрифт для меню
const Font3x5 = {
    0: [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]], 1: [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
    2: [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]], 3: [[1,1,1],[0,0,1],[0,1,1],[0,0,1],[1,1,1]],
    4: [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]], 5: [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
    6: [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]], 7: [[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
    8: [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]], 9: [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]]
};

// Автомат состояний
const App = {
    state: 'MENU', isHD: false,
    menuGame: parseInt(localStorage.getItem('bg_last_game')) || 0,
    menuSpeed: parseInt(localStorage.getItem('bg_last_speed')) || CONFIG.DEFAULT_SPEED,
    menuLevel: parseInt(localStorage.getItem('bg_last_level')) || CONFIG.DEFAULT_LEVEL,
    menuSelectParam: 0, lastTime: 0,
    animationFrameId: null,     // для отмены цикла
    gameoverTimer: null,        // для таймера GAMEOVER
    
    currentCols: 10, currentRows: 20, currentCellSize: 20,
    
    replayRec: { active: false, inputs: [], seed: [], startTime: 0 },
    activeReplay: null, replayTimer: 0, replayInputIdx: 0,
    
    init() {
        UI.updateIcons(); 
        UI.applyConsoleStyle();
        this.setState('MENU'); 
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = requestAnimationFrame((t) => this.loop(t)); 
    },

    updateGridSize(cols, rows, cellSize = 20) {
        const grid = document.getElementById('game-grid');
        if (!grid) return;
        grid.style.aspectRatio = `${cols} / ${rows}`;
        canvas.width = cols * cellSize;
        canvas.height = rows * cellSize;
        this.currentCols = cols;
        this.currentRows = rows;
        this.currentCellSize = cellSize;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    },

    loadReplayForMenu() {
        if (this.state !== 'MENU') return;
        document.getElementById('replay-badge').style.display = 'none';
        this.activeReplay = null;
        if (window.GAMES.length === 0) return;
        DB.getRandomReplay(window.GAMES[this.menuGame].name, (replay) => {
            if(replay && this.state === 'MENU') {
                this.activeReplay = replay;
                this.replayTimer = 0;
                this.replayInputIdx = 0;
                this.activeGame = Object.create(window.GAMES[this.menuGame]);
                Object.assign(this.activeGame, window.GAMES[this.menuGame]);
                this.activeGame.init(this.menuSpeed, this.menuLevel, this.isHD, replay);
                document.getElementById('replay-badge').style.display = 'block';
            } else {
                this.activeGame = null;
            }
        });
    },

    setState(newState) {
        this.state = newState;
        if(newState === 'MENU') {
            if (this.gameoverTimer) clearTimeout(this.gameoverTimer);
            this.activeGame = null; AudioFX.stopMusic();
            this.updateGridSize(10, 20);
            
            if(window.GAMES.length === 0) return; 
            if(this.menuGame >= window.GAMES.length) this.menuGame = 0;
            
            UI.update(0, window.GAMES[this.menuGame].hiscore || 0, this.menuSpeed, this.menuLevel);
            UI.setHDIndicator(window.GAMES[this.menuGame].hasHD, this.isHD);
            
            this.loadReplayForMenu();
        } else if(newState === 'PLAYING') {
            if (this.gameoverTimer) clearTimeout(this.gameoverTimer);
            document.getElementById('replay-badge').style.display = 'none';
            this.activeReplay = null;
            if(!this.activeGame || this.activeGame.isReplay) { 
                this.activeGame = window.GAMES[this.menuGame]; 
                this.activeGame.init(this.menuSpeed, this.menuLevel, this.isHD); 
                this.replayRec = { active: true, inputs: [], seed: this.activeGame.seedPieces || [], startTime: performance.now() };
            }
            AudioFX.startMusic(this.menuSpeed);
        } else if(newState === 'GAMEOVER') {
            if (this.gameoverTimer) clearTimeout(this.gameoverTimer);
            if(this.activeGame && this.replayRec.active) {
                DB.saveReplay(this.activeGame.name, this.activeGame.score, this.replayRec.inputs, this.replayRec.seed);
            }
            if(this.activeGame && this.activeGame.onGameOver) this.activeGame.onGameOver();
            AudioFX.over(); vibrate([100, 50, 100, 50, 300]); TTS.speak("Игра окончена");
            this.gameoverTimer = setTimeout(() => {
                if (this.state === 'GAMEOVER') this.setState('MENU');
            }, 3000);
        }
    },

    drawMenu() {
        if(window.GAMES.length === 0) return;
        clearCanvas(ctx, this.currentCols, this.currentRows, this.currentCellSize, false);
        const blink = Math.floor(Date.now() / 300) % 2 === 0;
        document.getElementById('lcd-speed').style.opacity = (this.menuSelectParam===1 && blink) ? 0 : 1;
        document.getElementById('lcd-level').style.opacity = (this.menuSelectParam===2 && blink) ? 0 : 1;
        const num = (this.menuGame + 1) % 10; const digit = Font3x5[num];
        if(!(this.menuSelectParam === 0 && blink)) {
            const offX = Math.floor((this.currentCols - 3)/2), offY = Math.floor((this.currentRows - 5)/2);
            drawGridMatrix(ctx, digit, offX, offY, this.currentCellSize, false);
        }
        if(window.GAMES[this.menuGame].drawMini) window.GAMES[this.menuGame].drawMini(this.isHD);
    },

    loop(now) {
        let dt = now - this.lastTime; this.lastTime = now; if(dt > 200) dt = 200;

        if(this.isHD && CONFIG.DISCO_ENABLED && !BatteryManager.powerSave && this.state === 'PLAYING') {
            let hue = (now / 50) % 360; document.getElementById('lcd-screen').style.background = `hsl(${hue}, 20%, 30%)`;
        } else { document.getElementById('lcd-screen').style.background = 'var(--lcd-bg)'; }

        if(this.state === 'PLAYING' && this.activeGame) {
            this.activeGame.update(dt); this.activeGame.draw();
            if(this.activeGame.drawMini) this.activeGame.drawMini(this.isHD);
        } else if(this.state === 'MENU') { 
            if (this.activeReplay && this.activeGame) {
                this.replayTimer += dt;
                while(this.replayInputIdx < this.activeReplay.inputs.length && this.activeReplay.inputs[this.replayInputIdx].t <= this.replayTimer) {
                    this.activeGame.input(this.activeReplay.inputs[this.replayInputIdx].a);
                    this.replayInputIdx++;
                }
                this.activeGame.update(dt); this.activeGame.draw();
            } else { this.drawMenu(); }
        }
        this.animationFrameId = requestAnimationFrame((t)=>this.loop(t));
    },

    input(action) {
        AudioFX.init();
        if(action === 'SETTINGS') { document.getElementById('settings-modal').style.display='flex'; this.state = 'SETTINGS'; return; }
        if(action === 'HD') { 
            if(window.GAMES[this.menuGame] && window.GAMES[this.menuGame].hasHD) { 
                this.isHD = !this.isHD; UI.setHDIndicator(true, this.isHD); 
                if(this.activeGame) this.activeGame.isHD = this.isHD;
            } return; 
        }
        if(action === 'RESET') { 
            if(this.state === 'PLAYING' && this.replayRec.active) { DB.saveReplay(this.activeGame.name, this.activeGame.score, this.replayRec.inputs, this.replayRec.seed); }
            localStorage.setItem('bg_last_game', this.menuGame); localStorage.setItem('bg_last_speed', this.menuSpeed); localStorage.setItem('bg_last_level', this.menuLevel);
            if (this.gameoverTimer) clearTimeout(this.gameoverTimer);
            this.setState('MENU'); return; 
        }
        if(action === 'START') { if(this.state === 'MENU') this.setState('PLAYING'); return; }
        
        if(this.state === 'MENU') {
            const is2048 = window.GAMES[this.menuGame].name === "2048";
            if(action === 'LEFT') { if(is2048) this.menuSelectParam = 0; else this.menuSelectParam = (this.menuSelectParam-1+3)%3; }
            if(action === 'RIGHT') { if(is2048) this.menuSelectParam = 0; else this.menuSelectParam = (this.menuSelectParam+1)%3; }
            if(action === 'UP') {
                if(this.menuSelectParam===0) {
                    this.menuGame = (this.menuGame + 1) % window.GAMES.length;
                    this.loadReplayForMenu();
                }
                else if(this.menuSelectParam===1) this.menuSpeed = Math.min(10, this.menuSpeed+1);
                else if(this.menuSelectParam===2) this.menuLevel = Math.min(10, this.menuLevel+1);
                AudioFX.move();
            }
            if(action === 'DOWN') {
                if(this.menuSelectParam===0) {
                    this.menuGame = (this.menuGame - 1 + window.GAMES.length) % window.GAMES.length;
                    this.loadReplayForMenu();
                }
                else if(this.menuSelectParam===1) this.menuSpeed = Math.max(1, this.menuSpeed-1);
                else if(this.menuSelectParam===2) this.menuLevel = Math.max(1, this.menuLevel-1);
                AudioFX.move();
            }
            UI.update(0, window.GAMES[this.menuGame].hiscore || 0, this.menuSpeed, this.menuLevel);
            UI.setHDIndicator(window.GAMES[this.menuGame].hasHD, this.isHD);
        } else if(this.state === 'PLAYING' && this.activeGame) {
            this.activeGame.input(action);
            if(this.replayRec.active) this.replayRec.inputs.push({t: performance.now() - this.replayRec.startTime, a: action});
        }
    }
};