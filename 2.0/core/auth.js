// core/auth.js - авторизация, пользователи и загрузка состояния
// =============================================================
// Этот модуль отвечает за:
// - Отрисовку сетки пользователей на экране входа
// - Вход/выход из системы
// - Создание новых пользователей
// - Загрузку состояния после входа (темы, виджеты, рабочий стол)

// ============ ОТРИСОВКА ПОЛЬЗОВАТЕЛЕЙ ============

/**
 * Отрисовать сетку пользователей на экране входа
 */
window.renderUsersGrid = () => {
    const grid = document.getElementById('users-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let username in window.VFS.users) {
        let card = document.createElement('div');
        card.className = 'user-card';
        card.innerHTML = `<div class="user-icon">${window.VFS.users[username].icon}</div><div class="user-name">${username}</div>`;
        card.onclick = () => window.attemptLogin(username, window.VFS.users[username].pass);
        grid.appendChild(card);
    }
};

// ============ ВХОД В СИСТЕМУ ============

/**
 * Попытка входа пользователя
 * @param {string} username
 * @param {string} hasPass - пароль (может быть пустым)
 */
window.attemptLogin = async (username, hasPass) => {
    if (hasPass) {
        if (prompt(`Введите пароль для ${username}:`) !== hasPass) {
            return window.notify("Неверный пароль!", "error");
        }
    }
    window.VFS.currentUser = username;
    document.getElementById('login-screen').style.display = 'none';
    await window.VFS.loadUser(username);
    
    // Запуск игрового сервиса (если есть)
    if (window.GameService) await window.GameService.init();
    
    // Загрузка состояния пользователя
    window.loadUserState();
};

// ============ СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ ============

/**
 * Показать/скрыть форму создания нового пользователя
 */
window.toggleNewUserForm = () => {
    const f = document.getElementById('new-user-form');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
};

/**
 * Создать нового пользователя
 */
window.createNewUser = () => {
    const name = document.getElementById('new-u-name').value.trim();
    if (!name || window.VFS.users[name]) {
        return window.notify('Ошибка имени', "error");
    }
    window.VFS.users[name] = {
        icon: document.getElementById('new-u-icon').value || '👤',
        pass: document.getElementById('new-u-pass').value
    };
    window.VFS.saveUsers();
    window.toggleNewUserForm();
    window.renderUsersGrid();
    window.notify('Пользователь создан', 'success');
};

// ============ ВЫХОД ИЗ СИСТЕМЫ ============

/**
 * Выход из текущего пользователя
 */
window.logout = () => {
    // Закрываем все окна
    window.State.windowInstances.forEach(win => {
        const w = document.getElementById(win.id);
        if (w) {
            if (w.id.startsWith('run-') || w.id.startsWith('win-folder-')) {
                w.remove();
            } else {
                w.style.display = 'none';
            }
        }
    });
    window.State.windowInstances = [];
    
    // Скрываем виджеты и меню
    document.getElementById('windows-widget').style.display = 'none';
    document.getElementById('main-menu').classList.remove('active');
    document.getElementById('control-center').style.display = 'none';
    document.getElementById('desktop-icons').innerHTML = '';
    document.getElementById('clock-widget').style.display = 'none';
    
    // Показываем экран входа
    document.getElementById('login-screen').style.display = 'flex';
    window.VFS.currentUser = '';
    window.renderUsersGrid();
};

// ============ ЗАГРУЗКА СОСТОЯНИЯ ПОЛЬЗОВАТЕЛЯ ============

/**
 * Загрузить состояние пользователя после входа
 * Применяет темы, настройки, виджеты, рабочий стол
 * Это "оркестратор", который вызывает функции из других модулей
 */
window.loadUserState = () => {
    // 1. Применяем CSS-переменные по умолчанию
    for (let key in window.State.defaultVars) {
        document.documentElement.style.setProperty(key, window.State.defaultVars[key]);
    }
    
    // 2. Загружаем состояние из конфига
    let state = window.VFS.config;
    
    // Инициализируем недостающие поля конфига
    if (!state.theme) state.theme = {};
    if (state.theme.snapWindows === undefined) state.theme.snapWindows = true;
    if (!state.theme.winCtrlPos) state.theme.winCtrlPos = 'right';
    if (!state.theme.taskbarPos) state.theme.taskbarPos = 'horizontal';
    if (!state.dockSettings) {
        state.dockSettings = {
            bg: '#161f29',
            op: '0.8',
            border: '#444444',
            confirm: true
        };
    }
    if (!state.dockPos) state.dockPos = { x: null, y: null };
    if (!state.widgetPos) state.widgetPos = { x: 100, y: 100 };
    if (!state.iconPos) state.iconPos = {};
    if (!state.winSizes) state.winSizes = {};
    if (!state.widgets) {
        state.widgets = {
            'clock-widget': { visible: true, top: false },
            'windows-widget': { visible: true, top: false },
            'storage-widget': { visible: true, top: false }
        };
    }
    
    // 3. Заполняем селектор тем (если ещё не заполнен)
    const themeSel = document.getElementById('sel-theme');
    if (themeSel && themeSel.options.length <= 1 && window.Themes) {
        for (let key in window.Themes) {
            let opt = document.createElement('option');
            opt.value = key;
            opt.innerText = window.Themes[key].name;
            themeSel.appendChild(opt);
        }
    }
    
    // 4. Восстанавливаем CSS-класс темы
    document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
    if (state.theme.cssClass) {
        document.body.classList.add(state.theme.cssClass);
    }
    
    // 5. Меняем иконку кнопки "Пуск"
    if (state.theme.startIcon) {
        const bBtn = document.getElementById('burger-btn');
        if (bBtn) bBtn.innerHTML = state.theme.startIcon;
    }
    
    // 6. Применяем настройки (из themes.js)
    window.applySettings();
    
    // 7. Отрисовываем рабочий стол (из desktop.js)
    window.renderDesktop();
    
    // 8. Применяем состояние виджетов (из widgets.js)
    window.applyWidgetState();
    
    // 9. Загружаем радиусы в UI (из themes.js)
    window.loadRadiiUI();
    
    // 10. Инициализируем drag/resize для всех окон (из window-manager.js)
    document.querySelectorAll('.window').forEach(win => {
        window.initDrag(win);
        window.initResize(win);
        window.applySavedSize(win);
        
        // Фокусировка окна при клике
        const focusMe = () => {
            win.style.zIndex = window.State.nextZ();
        };
        win.addEventListener('mousedown', focusMe, { capture: true });
        win.addEventListener('touchstart', focusMe, { passive: true, capture: true });
    });
    
    // 11. Инициализируем перетаскивание виджетов (из widgets.js)
    window.initWidgetDrag(document.getElementById('clock-widget'));
    window.initDockDrag(document.getElementById('windows-widget'));
    window.initControlCenterDrag();
    
    // 12. Применяем настройки виджетов к DOM (из widgets.js)
    window.applyWidgetSettingsToDOM();
    window.loadWidgetSettings('clock-widget');
    window.applyWWSettingsUI();
    
    // 13. Приветственное уведомление
    window.notify(`Добро пожаловать, ${window.VFS.currentUser}!`, "success");
};