// core/themes.js - темы, CSS-переменные и кастомизация интерфейса
// ================================================================
// Этот модуль отвечает за:
// - Применение готовых пресетов тем (Windows 95, 11, macOS и т.д.)
// - Изменение CSS-переменных (цвета, прозрачность, радиусы)
// - Переключение светлой/тёмной темы
// - Настройку анимаций окон (открытие, перемещение)
// - Настройку радиусов скругления
// - Применение всех настроек к DOM
// - Положение кнопок управления и панели задач

// ============ ПРИМЕНЕНИЕ ТЕМЫ ============

/**
 * Применить готовый пресет темы
 * Меняет CSS-класс, иконку Пуск, фон, переменные и настройки
 * @param {string} themeId - идентификатор темы из window.Themes
 */
window.applyThemePreset = (themeId) => {
    if (!themeId || !window.Themes || !window.Themes[themeId]) return;
    const theme = window.Themes[themeId];
    
    // 1. Применяем структурный CSS-класс
    document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
    if (theme.cssClass) {
        document.body.classList.add(theme.cssClass);
        window.VFS.config.theme.cssClass = theme.cssClass;
    }
    
    // 2. Меняем иконку меню Пуск
    const burgerBtn = document.getElementById('burger-btn');
    if (burgerBtn && theme.startIcon) {
        burgerBtn.innerHTML = theme.startIcon;
        window.VFS.config.theme.startIcon = theme.startIcon;
    }
    
    // 3. Ставим фоновый цвет (если обои не загружены пользователем)
    if (theme.bg && !window.VFS.config.bgValue) {
        document.getElementById('desktop').style.background = theme.bg;
    }
    
    // 4. Меняем CSS переменные
    for (let key in theme.vars) {
        window.changeCssVar(key, theme.vars[key]);
        
        // Синхронизируем с UI контролов
        if (key === '--win-opacity' && document.getElementById('cc-opacity')) {
            document.getElementById('cc-opacity').value = theme.vars[key];
            document.getElementById('lbl-op').innerText = theme.vars[key];
        }
        if (key === '--glass-blur' && document.getElementById('cc-glass')) {
            let v = parseInt(theme.vars[key]);
            document.getElementById('cc-glass').value = v;
            document.getElementById('lbl-gbl').innerText = theme.vars[key];
        }
        if (key === '--win-border' && document.getElementById('cc-border')) {
            document.getElementById('cc-border').value = theme.vars[key];
        }
        if (key === '--accent' && document.getElementById('cc-accent')) {
            document.getElementById('cc-accent').value = theme.vars[key];
        }
    }
    
    // 5. Меняем положение элементов управления
    if (theme.settings) {
        if (theme.settings.winCtrlPos) {
            document.getElementById('sel-win-ctrl-pos').value = theme.settings.winCtrlPos;
            window.changeWinCtrlPos(theme.settings.winCtrlPos);
        }
        if (theme.settings.taskbarPos) {
            document.getElementById('sel-taskbar-pos').value = theme.settings.taskbarPos;
            window.changeTaskbarPos(theme.settings.taskbarPos);
        }
        if (theme.settings.isLightMode !== undefined) {
            document.getElementById('cc-theme-mode').checked = theme.settings.isLightMode;
            window.toggleLightMode(theme.settings.isLightMode);
        }
    }
    
    window.loadRadiiUI();
    window.saveProfile();
    window.notify(`Тема "${theme.name}" применена!`, "success");
};

// ============ CSS-ПЕРЕМЕННЫЕ ============

/**
 * Изменить CSS-переменную и сохранить в конфиг
 * @param {string} variable - имя переменной (например, '--accent')
 * @param {string} value - новое значение
 * @param {string} labelId - опционально ID элемента для отображения значения
 */
window.changeCssVar = (variable, value, labelId) => {
    document.documentElement.style.setProperty(variable, value);
    if (labelId) {
        const label = document.getElementById(labelId);
        if (label) label.innerText = value.replace('px', '');
    }
    window.VFS.config.theme[variable] = value;
    window.saveProfile();
};

/**
 * Переключить светлую/тёмную тему
 * @param {boolean} isLight - true для светлой, false для тёмной
 */
window.toggleLightMode = (isLight) => {
    window.changeCssVar('--win-bg-rgb', isLight ? '240, 245, 250' : '22, 31, 41');
    window.changeCssVar('--text', isLight ? '#1a1a1a' : '#e6eef8');
    window.VFS.config.theme['isLightMode'] = isLight;
    window.saveProfile();
};

// ============ АНИМАЦИИ ============

/**
 * Изменить анимацию открытия или перемещения окон
 * @param {string} type - 'open' или 'move'
 * @param {string} val - имя анимации (anim-fade, anim-zoom, move-tilt и т.д.)
 */
window.changeAnim = (type, val) => {
    if (type === 'open') window.VFS.config.theme.openAnim = val;
    if (type === 'move') window.VFS.config.theme.moveAnim = val;
    window.saveProfile();
};

// ============ РАДИУСЫ СКРУГЛЕНИЯ ============

/**
 * Обновить радиусы скругления для выбранного элемента
 * (Окна, Виджеты и Меню, Кнопки и Иконки)
 */
window.updateRadii = () => {
    const target = document.getElementById('sel-radius-target').value;
    const val = `${document.getElementById('r-tl').value}px ` +
                `${document.getElementById('r-tr').value}px ` +
                `${document.getElementById('r-br').value}px ` +
                `${document.getElementById('r-bl').value}px`;
    window.changeCssVar(target, val);
};

/**
 * Загрузить значения радиусов из конфига в UI
 */
window.loadRadiiUI = () => {
    const target = document.getElementById('sel-radius-target').value;
    let val = window.VFS.config.theme[target] || window.State.defaultVars[target];
    let parts = val.replace(/px/g, '').split(' ');
    if (parts.length === 4) {
        document.getElementById('r-tl').value = parts[0];
        document.getElementById('r-tr').value = parts[1];
        document.getElementById('r-br').value = parts[2];
        document.getElementById('r-bl').value = parts[3];
    }
};

// ============ ПОЛОЖЕНИЕ ЭЛЕМЕНТОВ ============

/**
 * Изменить положение кнопок управления окном (слева/справа/по центру)
 * @param {string} val - 'left', 'right' или 'center'
 */
window.changeWinCtrlPos = (val) => {
    window.VFS.config.theme.winCtrlPos = val;
    document.body.setAttribute('data-ctrl-pos', val);
    window.saveProfile();
};

/**
 * Изменить положение панели задач (горизонтально/вертикально)
 * @param {string} val - 'horizontal' или 'vertical'
 */
window.changeTaskbarPos = (val) => {
    window.VFS.config.theme.taskbarPos = val;
    document.body.setAttribute('data-taskbar-pos', val);
    window.saveProfile();
};

/**
 * Обновить настройку прилипания окон (snap)
 */
window.updateSnapping = () => {
    window.VFS.config.theme.snapWindows = document.getElementById('cc-snap-windows').checked;
    window.saveProfile();
};

// ============ ПРИМЕНЕНИЕ ВСЕХ НАСТРОЕК ============

/**
 * Применить все настройки из конфига к DOM
 * Вызывается при входе пользователя и при изменении обоев
 */
window.applySettings = () => {
    let state = window.VFS.config;
    
    // Фон рабочего стола
    document.getElementById('desktop').style.backgroundImage = 
        state.bgValue ? `url(${state.bgValue})` : 'none';
    
    if (state.theme) {
        // Применяем все CSS-переменные из темы
        for (let key in state.theme) {
            // Пропускаем служебные поля (не CSS-переменные)
            if (['isLightMode', 'openAnim', 'moveAnim', 'winCtrlPos', 
                 'taskbarPos', 'snapWindows', 'cssClass', 'startIcon'].includes(key)) continue;
            
            document.documentElement.style.setProperty(key, state.theme[key]);
            
            // Синхронизируем с UI контролов
            if (document.getElementById('cc-border') && key === '--win-border') {
                document.getElementById('cc-border').value = state.theme[key];
            }
            if (document.getElementById('cc-accent') && key === '--accent') {
                document.getElementById('cc-accent').value = state.theme[key];
            }
            if (key === '--win-opacity') {
                document.getElementById('cc-opacity').value = state.theme[key];
                document.getElementById('lbl-op').innerText = state.theme[key];
            }
            if (key === '--glass-blur') {
                document.getElementById('cc-glass').value = parseInt(state.theme[key]);
                document.getElementById('lbl-gbl').innerText = state.theme[key];
            }
            if (key === '--blur') {
                document.getElementById('cc-bg-blur').value = parseInt(state.theme[key]);
                document.getElementById('lbl-bl').innerText = state.theme[key];
            }
            if (key === '--shadow-op') {
                document.getElementById('cc-shadow').value = state.theme[key];
                document.getElementById('lbl-shd').innerText = state.theme[key];
            }
        }
        
        // Чекбоксы и селекторы
        document.getElementById('cc-theme-mode').checked = state.theme['isLightMode'] || false;
        document.getElementById('cc-snap-windows').checked = state.theme.snapWindows !== false;
        document.getElementById('sel-anim-open').value = state.theme.openAnim || 'anim-fade';
        document.getElementById('sel-anim-move').value = state.theme.moveAnim || 'move-none';
        document.getElementById('sel-win-ctrl-pos').value = state.theme.winCtrlPos || 'right';
        document.body.setAttribute('data-ctrl-pos', state.theme.winCtrlPos || 'right');
        document.getElementById('sel-taskbar-pos').value = state.theme.taskbarPos || 'horizontal';
        document.body.setAttribute('data-taskbar-pos', state.theme.taskbarPos || 'horizontal');
    }
};

// ============ ЗАГРУЗКА ОБОЕВ ============

// Обработчик загрузки обоев через input
document.getElementById('file-upload').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
        window.VFS.config.bgValue = ev.target.result;
        window.saveProfile();
        window.applySettings();
        window.notify("Обои установлены", "success");
    };
    r.readAsDataURL(f);
    e.target.value = '';
};

// ============ ПОЛНЫЙ СБРОС СИСТЕМЫ ============

/**
 * Полный сброс системы (очистка IndexedDB и localStorage)
 */
window.fullReset = async () => {
    if (confirm("ВНИМАНИЕ! Вы удалите профили, системные приложения и настройки. Уверены?")) {
        await window.idb.clear();
        localStorage.clear();
        location.reload();
    }
};