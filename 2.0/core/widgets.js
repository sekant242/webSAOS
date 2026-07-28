// core/widgets.js - виджеты, Центр управления и глобальные обработчики
// ====================================================================
// Этот модуль отвечает за:
// - Виджет часов (отрисовка времени, перетаскивание)
// - Виджет Dock (настройки, перетаскивание, применение стилей)
// - Виджет хранилища (настройки видимости)
// - Центр управления (показать/скрыть, перетаскивание)
// - Главное меню (Пуск)
// - Глобальные обработчики: закрытие меню при клике вне,
//   контекстное меню на рабочем столе, долгое нажатие

// ============ ЛОКАЛЬНЫЕ УТИЛИТЫ ============

/**
 * Преобразовать HEX цвет в RGB строку (для rgba())
 * @param {string} hex
 * @returns {string}
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '22, 31, 41';
}

// ============ ЧАСЫ ============

/**
 * Обновить время на виджете часов
 * Вызывается каждую секунду из main.js
 */
window.tickClock = () => {
    const now = new Date();
    document.getElementById('clock-time').innerText =
        now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0');
    document.getElementById('clock-date').innerText = now.toLocaleDateString('ru');
};

/**
 * Применить позицию виджета часов из конфига и запустить таймер
 */
function applyWidgetState() {
    const w = document.getElementById('clock-widget');
    w.style.left = window.VFS.config.widgetPos.x + 'px';
    w.style.top = window.VFS.config.widgetPos.y + 'px';
    window.tickClock();
}

/**
 * Инициализировать перетаскивание виджета часов
 * @param {HTMLElement} w - элемент часов
 */
window.initWidgetDrag = (w) => {
    w.onmousedown = w.ontouchstart = (e) => {
        let sX = (e.clientX || e.touches[0].clientX) - w.offsetLeft;
        let sY = (e.clientY || e.touches[0].clientY) - w.offsetTop;
        
        document.onmousemove = document.ontouchmove = (ev) => {
            w.style.left = (ev.clientX || ev.touches[0].clientX) - sX + 'px';
            w.style.top = (ev.clientY || ev.touches[0].clientY) - sY + 'px';
        };
        
        document.onmouseup = document.ontouchend = () => {
            document.onmousemove = document.ontouchmove = null;
            window.VFS.config.widgetPos = {
                x: parseInt(w.style.left),
                y: parseInt(w.style.top)
            };
            window.saveProfile();
        };
    };
};

// ============ НАСТРОЙКИ ВИДЖЕТОВ ============

/**
 * Загрузить настройки виджета в UI
 * @param {string} wId - ID виджета
 */
window.loadWidgetSettings = (wId) => {
    const state = window.VFS.config;
    if (!state.widgets) return;
    if (!state.widgets[wId]) state.widgets[wId] = { visible: true, top: false };
    document.getElementById('widget-visible').checked = state.widgets[wId].visible;
    document.getElementById('widget-top').checked = state.widgets[wId].top;
};

/**
 * Обновить настройки виджета из UI и сохранить
 */
window.updateWidgetSettings = () => {
    const wId = document.getElementById('sel-widget').value;
    const visible = document.getElementById('widget-visible').checked;
    const top = document.getElementById('widget-top').checked;
    window.VFS.config.widgets[wId] = { visible, top };
    window.saveProfile();
    window.applyWidgetSettingsToDOM();
};

/**
 * Применить настройки видимости виджетов к DOM
 */
window.applyWidgetSettingsToDOM = () => {
    const state = window.VFS.config;
    if (!state.widgets) return;
    
    for (let wId in state.widgets) {
        const el = document.getElementById(wId);
        if (el) {
            el.style.display = state.widgets[wId].visible
                ? ((wId === 'windows-widget' || wId === 'clock-widget' || wId === 'storage-widget') ? 'flex' : 'block')
                : 'none';
            el.style.zIndex = state.widgets[wId].top ? '9999999' : '50';
        }
    }
};

// ============ DOCK (ВИДЖЕТ ОКОН) ============

/**
 * Обновить настройки Dock из UI
 */
window.updateWWSettings = () => {
    const bgHex = document.getElementById('ww-set-bg').value;
    const op = document.getElementById('ww-set-op').value;
    const border = document.getElementById('ww-set-border').value;
    const confirm = document.getElementById('ww-set-confirm').checked;
    
    window.VFS.config.dockSettings = { bg: bgHex, op: op, border: border, confirm: confirm };
    document.getElementById('lbl-ww-op').innerText = op;
    window.saveProfile();
    window.applyWWSettingsUI();
};

/**
 * Применить настройки Dock к DOM
 */
window.applyWWSettingsUI = () => {
    const s = window.VFS.config.dockSettings;
    const rgb = hexToRgb(s.bg);
    
    document.documentElement.style.setProperty('--ww-bg', `rgba(${rgb}, ${s.op})`);
    document.documentElement.style.setProperty('--ww-border', s.border);
    
    const dock = document.getElementById('windows-widget');
    if (window.VFS.config.dockPos && window.VFS.config.dockPos.x) {
        dock.style.left = window.VFS.config.dockPos.x;
        dock.style.top = window.VFS.config.dockPos.y;
        dock.style.transform = 'none';
    } else {
        dock.style.left = '50%';
        dock.style.top = '20px';
        dock.style.transform = 'translateX(-50%)';
    }
    
    // Синхронизация с UI
    if (document.getElementById('ww-set-bg')) {
        document.getElementById('ww-set-bg').value = s.bg;
        document.getElementById('ww-set-op').value = s.op;
        document.getElementById('lbl-ww-op').innerText = s.op;
        document.getElementById('ww-set-border').value = s.border;
        document.getElementById('ww-set-confirm').checked = s.confirm;
    }
};

/**
 * Инициализировать перетаскивание Dock
 * @param {HTMLElement} w - элемент виджета
 */
window.initDockDrag = (w) => {
    const handle = w.querySelector('.ww-drag-handle');
    if (!handle) return;
    
    handle.onmousedown = handle.ontouchstart = (e) => {
        let sX = (e.clientX || e.touches[0].clientX) - w.offsetLeft;
        let sY = (e.clientY || e.touches[0].clientY) - w.offsetTop;
        
        document.onmousemove = document.ontouchmove = (ev) => {
            w.style.left = (ev.clientX || ev.touches[0].clientX) - sX + 'px';
            w.style.top = (ev.clientY || ev.touches[0].clientY) - sY + 'px';
            w.style.transform = 'none';
        };
        
        document.onmouseup = document.ontouchend = () => {
            document.onmousemove = document.ontouchmove = null;
            window.VFS.config.dockPos = { x: w.style.left, y: w.style.top };
            window.saveProfile();
        };
    };
};

// ============ ЦЕНТР УПРАВЛЕНИЯ ============

/**
 * Инициализировать перетаскивание Центра управления
 */
window.initControlCenterDrag = () => {
    const cc = document.getElementById('control-center');
    const ccHeader = cc.querySelector('.cc-header');
    
    // Восстанавливаем позицию
    if (window.VFS.config.ccPos) {
        cc.style.left = window.VFS.config.ccPos.left;
        cc.style.top = window.VFS.config.ccPos.top;
        cc.style.right = 'auto';
        cc.style.bottom = 'auto';
    } else {
        cc.style.right = '20px';
        cc.style.bottom = '90px';
    }
    
    // Фокусировка при клике
    const focusCC = () => { cc.style.zIndex = window.State.nextZ(); };
    cc.addEventListener('mousedown', focusCC, { capture: true });
    cc.addEventListener('touchstart', focusCC, { passive: true, capture: true });
    
    // Перетаскивание
    ccHeader.onmousedown = ccHeader.ontouchstart = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('.win-controls')) return;
        
        cc.style.zIndex = window.State.nextZ();
        let sX = (e.clientX || e.touches[0].clientX);
        let sY = (e.clientY || e.touches[0].clientY);
        let startLeft = cc.offsetLeft;
        let startTop = cc.offsetTop;
        
        document.onmousemove = document.ontouchmove = (ev) => {
            if (cc.classList.contains('fullscreen')) return;
            let currX = (ev.clientX || ev.touches[0].clientX);
            let currY = (ev.clientY || ev.touches[0].clientY);
            cc.style.left = Math.max(0, Math.min(window.innerWidth - cc.offsetWidth, startLeft + (currX - sX))) + 'px';
            cc.style.top = Math.max(0, Math.min(window.innerHeight - cc.offsetHeight, startTop + (currY - sY))) + 'px';
            cc.style.right = 'auto';
            cc.style.bottom = 'auto';
        };
        
        document.onmouseup = document.ontouchend = () => {
            document.onmousemove = document.ontouchmove = null;
            document.onmouseup = document.ontouchend = null;
            window.VFS.config.ccPos = { left: cc.style.left, top: cc.style.top };
            window.saveProfile();
        };
    };
};

/**
 * Переключение видимости Центра управления
 * @param {Event} e
 */
window.toggleControlCenter = (e) => {
    if (e) e.stopPropagation();
    const cc = document.getElementById('control-center');
    
    if (cc.style.display === 'flex' && !cc.classList.contains('cc-closing')) {
        cc.classList.add('cc-closing');
        setTimeout(() => {
            cc.style.display = 'none';
            cc.classList.remove('cc-closing');
        }, 300);
    } else {
        cc.classList.remove('cc-closing');
        cc.style.display = 'flex';
        cc.style.zIndex = window.State.nextZ();
    }
};

// ============ ГЛАВНОЕ МЕНЮ (ПУСК) ============

/**
 * Переключение главного меню (Пуск)
 * @param {Event} e
 */
window.toggleMenu = (e) => {
    if (e) e.stopPropagation();
    document.getElementById('main-menu').classList.toggle('active');
};

// ============ ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ============

// Элементы контекстных меню
const contextMenu = document.getElementById('context-menu');
const widgetContextMenu = document.getElementById('widget-context-menu');
const iconContextMenu = document.getElementById('icon-context-menu');
let longPressTimer;

/**
 * Закрытие всех меню при клике вне их
 */
document.addEventListener('click', (e) => {
    contextMenu.style.display = 'none';
    widgetContextMenu.style.display = 'none';
    iconContextMenu.style.display = 'none';
    
    if (!e.target.closest('#taskbar-container') && !e.target.closest('#control-center')) {
        document.getElementById('main-menu').classList.remove('active');
    }
});

/**
 * Контекстное меню на рабочем столе (правый клик)
 */
document.addEventListener('contextmenu', (e) => {
    if (e.target.id === 'desktop' || e.target.id === 'desktop-icons') {
        e.preventDefault();
        window.showMenuAt(contextMenu, e);
    }
});

/**
 * Контекстное меню на рабочем столе (долгое нажатие на тач-устройствах)
 */
document.addEventListener('touchstart', (e) => {
    if (e.target.id === 'desktop' || e.target.id === 'desktop-icons') {
        longPressTimer = setTimeout(() => {
            e.preventDefault();
            window.showMenuAt(contextMenu, e);
        }, 600);
    }
});

document.addEventListener('touchend', () => clearTimeout(longPressTimer));
document.addEventListener('touchmove', () => clearTimeout(longPressTimer));