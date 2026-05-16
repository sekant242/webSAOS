// main.js — исправленный
// Настройки интерфейса
document.getElementById('btn-toggle-sound').addEventListener('click', () => { CONFIG.SOUND_ENABLED = !CONFIG.SOUND_ENABLED; localStorage.setItem('bg_sound', CONFIG.SOUND_ENABLED); UI.updateIcons(); });
document.getElementById('btn-toggle-music').addEventListener('click', () => { CONFIG.MUSIC_ENABLED = !CONFIG.MUSIC_ENABLED; localStorage.setItem('bg_music', CONFIG.MUSIC_ENABLED); UI.updateIcons(); if(App.state==='PLAYING') AudioFX.startMusic(App.menuSpeed); else AudioFX.stopMusic();});
document.getElementById('btn-toggle-tts').addEventListener('click', () => { CONFIG.TTS_ENABLED = !CONFIG.TTS_ENABLED; localStorage.setItem('bg_tts', CONFIG.TTS_ENABLED); UI.updateIcons(); });
document.getElementById('btn-toggle-disco').addEventListener('click', () => { CONFIG.DISCO_ENABLED = !CONFIG.DISCO_ENABLED; localStorage.setItem('bg_disco', CONFIG.DISCO_ENABLED); UI.updateIcons(); });
document.getElementById('console-color-picker').addEventListener('input', (e) => { CONFIG.CONSOLE_COLOR = e.target.value; localStorage.setItem('bg_console_color', CONFIG.CONSOLE_COLOR); UI.applyConsoleStyle(); });

// Фиктивные тумблеры настроек
document.getElementById('btn-toggle-eye').addEventListener('click', () => alert('Для Eye Tracking требуется HTTPS и разрешение камеры. Функция заглушена.'));
document.getElementById('btn-toggle-xr').addEventListener('click', () => alert('WebXR требует шлема виртуальной реальности.'));
document.getElementById('btn-close-settings').addEventListener('click', () => { document.getElementById('settings-modal').style.display='none'; App.setState('MENU'); });

// Привязка кнопок экрана
function bindBtn(id, act) { 
    let el = document.getElementById(id);
    const trigger = (e) => { e.preventDefault(); App.input(act); };
    el.addEventListener('mousedown', trigger); el.addEventListener('touchstart', trigger); 
}
bindBtn('btn-left', 'LEFT'); bindBtn('btn-right', 'RIGHT'); bindBtn('btn-down', 'DOWN'); bindBtn('btn-up', 'UP'); bindBtn('btn-action', 'ACTION');
document.getElementById('btn-start').addEventListener('click', ()=>App.input('START')); 
document.getElementById('btn-reset').addEventListener('click', ()=>App.input('RESET')); 
document.getElementById('btn-settings').addEventListener('click', ()=>App.input('SETTINGS')); 
document.getElementById('btn-hd').addEventListener('click', ()=>App.input('HD'));

// Привязка клавиатуры с увеличенным кулдауном для ACTION (пробел/Enter)
const keyMap = { 'ArrowLeft':'LEFT', 'ArrowRight':'RIGHT', 'ArrowDown':'DOWN', 'ArrowUp':'UP', ' ': 'ACTION', 'Enter':'ACTION', 'MediaPlayPause': 'START', 'p':'START', 'Escape':'RESET', 's':'SETTINGS', 'd':'HD' };
let keyCooldown={};
window.addEventListener('keydown', (e)=>{ 
    const act = keyMap[e.key]; 
    if(act){ 
        e.preventDefault(); 
        // увеличил кулдаун для ACTION до 200 мс, остальное 80
        let cooldownMs = (act === 'ACTION') ? 200 : 80;
        if(!keyCooldown[act]){ 
            App.input(act); 
            keyCooldown[act]=true; 
            setTimeout(()=>{ keyCooldown[act]=false; }, cooldownMs); 
        } 
    } 
});

// Разблокировка аудио (Браузеры требуют клика для запуска AudioContext)
function unlockAudio() { AudioFX.init(); if(window.speechSynthesis) window.speechSynthesis.getVoices(); }
// Используем постоянные обработчики, а не once, чтобы гарантировать разблокировку при любом касании
document.body.addEventListener('touchstart', unlockAudio);
document.body.addEventListener('mousedown', unlockAudio);

// СТАРТ!
window.onload = () => {
    if (window.ModManager) {
        window.ModManager.init();
    } else {
        console.warn("ModManager не найден. Игра запущена без поддержки пользовательских модов.");
    }
    App.init(); 
};