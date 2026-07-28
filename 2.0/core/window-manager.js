// core/window-manager.js - управление окнами WebSAOS
// ===================================================
// Этот модуль отвечает за:
// - Создание и открытие окон (стандартных и приложений)
// - Перетаскивание окон с эффектами (наклон, ткань, прозрачность)
// - Snap-систему (прилипание к краям экрана)
// - Изменение размера окон
// - Сворачивание, разворачивание, закрытие окон
// - Виджет Dock (отрисовка иконок открытых окон)

// ============ УПРАВЛЕНИЕ СОСТОЯНИЕМ ОКОН ============

/**
 * Свернуть окно
 * @param {string} id - ID окна
 */
window.minimizeWindow = (id) => {
    const w = document.getElementById(id);
    if (!w) return;
    w.style.display = 'none';
    const winObj = window.State.findWindow(id);
    if (winObj) winObj.state = 'minimized';
    window.renderWindowWidget();
};

/**
 * Развернуть окно на весь экран (максимизировать)
 * @param {string} id - ID окна
 */
window.maximizeWindow = (id) => {
    const w = document.getElementById(id);
    if (!w) return;
    w.classList.toggle('fullscreen');
    w.style.zIndex = window.State.nextZ();
    if (w.classList.contains('fullscreen')) {
        w.style.left = '0';
        w.style.top = '0';
        w.style.width = '100vw';
        w.style.height = '100vh';
    }
};

/**
 * Закрыть окно
 * @param {string} id - ID окна
 * @param {boolean} skipConfirm - пропустить подтверждение
 */
window.closeWindow = (id, skipConfirm = false) => {
    if (!skipConfirm && window.VFS.config.dockSettings?.confirm) {
        if (!confirm("Уверены, что хотите закрыть это окно?")) return;
    }
    const w = document.getElementById(id);
    if (w) {
        if (w.id.startsWith('run-') || w.id.startsWith('win-folder-')) {
            w.remove();
        } else {
            w.style.display = 'none';
        }
    }
    window.State.unregisterWindow(id);
    window.renderWindowWidget();
};

/**
 * Переключить состояние окна (развернуть/свернуть)
 * Используется при клике на иконку в Dock
 * @param {string} id - ID окна
 */
window.toggleWindowState = (id) => {
    const w = document.getElementById(id);
    const winObj = window.State.findWindow(id);
    if (!w || !winObj) return;
    
    if (winObj.state === 'minimized') {
        w.style.display = 'flex';
        w.style.zIndex = window.State.nextZ();
        winObj.state = 'open';
    } else {
        w.style.display = 'none';
        winObj.state = 'minimized';
    }
    window.renderWindowWidget();
};

// ============ ВИДЖЕТ DOCK (ОКНА) ============

/**
 * Отрисовать виджет окон (Dock)
 * Показывает иконки всех открытых/свёрнутых окон
 */
window.renderWindowWidget = () => {
    const cont = document.getElementById('ww-icons-container');
    if (!cont) return;
    cont.innerHTML = '';
    
    window.State.windowInstances.forEach((win, index) => {
        const iconEl = document.createElement('div');
        iconEl.className = `ww-icon ${win.state === 'minimized' ? 'minimized' : ''}`;
        iconEl.innerHTML = `${win.icon} ${win.state === 'open' ? '<div class="ww-indicator"></div>' : ''}`;
        iconEl.title = win.title;
        iconEl.draggable = true;
        
        // Клик — переключить состояние
        iconEl.onclick = () => window.toggleWindowState(win.id);
        
        // Контекстное меню (правый клик / долгое нажатие)
        const openCtx = (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('wcm-max').onclick = () => {
                window.maximizeWindow(win.id);
                document.getElementById('widget-context-menu').style.display = 'none';
            };
            document.getElementById('wcm-close').onclick = () => {
                window.closeWindow(win.id);
                document.getElementById('widget-context-menu').style.display = 'none';
            };
            window.showMenuAt(document.getElementById('widget-context-menu'), e);
        };
        iconEl.oncontextmenu = openCtx;
        
        let pressTimer;
        iconEl.ontouchstart = (e) => {
            pressTimer = setTimeout(() => openCtx(e), 600);
        };
        iconEl.ontouchend = iconEl.ontouchcancel = () => clearTimeout(pressTimer);
        
        // Drag & Drop для переупорядочивания иконок в Dock
        iconEl.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', index);
            iconEl.classList.add('dragging');
        };
        iconEl.ondragend = () => iconEl.classList.remove('dragging');
        iconEl.ondragover = (e) => e.preventDefault();
        iconEl.ondrop = (e) => {
            e.preventDefault();
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            const toIdx = index;
            if (fromIdx !== toIdx) {
                const moved = window.State.windowInstances.splice(fromIdx, 1)[0];
                window.State.windowInstances.splice(toIdx, 0, moved);
                window.renderWindowWidget();
            }
        };
        
        cont.appendChild(iconEl);
    });
};

// ============ РАЗМЕРЫ ОКОН ============

/**
 * Применить сохранённый размер окна из конфига
 * @param {HTMLElement} w - элемент окна
 */
window.applySavedSize = (w) => {
    if (window.VFS.config.winSizes && window.VFS.config.winSizes[w.id]) {
        w.style.width = window.VFS.config.winSizes[w.id].w;
        w.style.height = window.VFS.config.winSizes[w.id].h;
    }
};

// ============ ОТКРЫТИЕ ОКОН ============

/**
 * Открыть стандартное окно по ID (Настройки, Терминал, ФМ и т.д.)
 * @param {string} id - ID окна в DOM
 */
window.openWin = (id) => {
    const w = document.getElementById(id);
    if (!w) return;
    
    w.className = `window ${window.VFS.config.theme.openAnim || 'anim-fade'}`;
    window.applySavedSize(w);
    w.style.display = 'flex';
    w.style.zIndex = window.State.nextZ();
    
    document.getElementById('main-menu').classList.remove('active');
    
    // Определяем иконку и заголовок окна
    let icon = '⚙️', title = 'Окно';
    if (id === 'win-app-manager') { icon = '📦'; title = 'Менеджер'; }
    else if (id === 'win-app-editor') { icon = '✏️'; title = 'Редактор'; }
    else if (id === 'win-settings') { icon = '⚙️'; title = 'Настройки ОС'; }
    else if (id === 'win-ww-settings') { icon = '🎛'; title = 'Настройки дока'; }
    else if (id === 'win-terminal') {
        icon = '🔲'; title = 'Терминал';
        setTimeout(() => document.getElementById('term-input').focus(), 100);
    }
    else if (id === 'win-file-manager') {
        icon = '📁'; title = 'Файлы';
        window.renderFM();
    }
    else if (id === 'win-notepad') {
        icon = '📝';
        title = document.getElementById('np-title').innerText || 'Блокнот';
    }
    
    window.State.registerWindow(id, icon, title);
};

// ============ ЗАПУСК ПРИЛОЖЕНИЙ ============

/**
 * Запустить приложение (в iframe)
 * @param {string} id - ID приложения
 * @param {object} app - объект приложения из VFS.apps
 */
window.runApp = (id, app) => {
    let w = document.getElementById('run-' + id);
    
    if (!w) {
        w = document.createElement('div');
        w.id = 'run-' + id;
        w.className = `window ${window.VFS.config.theme.openAnim || 'anim-fade'}`;
        w.style.cssText = "width:80%;height:60%;top:20%;left:10%;display:flex;";
        w.innerHTML = `
            <div class="win-header">
                <span>${app.icon} ${app.name}</span>
                <div class="win-controls">
                    <button class="ctrl-btn" onclick="minimizeWindow('run-${id}')">_</button>
                    <button class="ctrl-btn" onclick="maximizeWindow('run-${id}')">□</button>
                    <button class="ctrl-btn" style="background:var(--danger)" onclick="closeWindow('run-${id}')">✕</button>
                </div>
            </div>
            <div class="win-content" style="padding:0; position:relative;">
                <iframe id="frame-${id}" style="width:100%;height:100%;border:none;background:#fff;" sandbox="allow-scripts allow-same-origin"></iframe>
            </div>
        `;
        document.body.appendChild(w);
        document.getElementById('frame-' + id).srcdoc = app.code;
        
        // Инициализация drag/resize
        window.initDrag(w);
        window.initResize(w);
        window.applySavedSize(w);
        
        // Фокусировка при клике
        const focusMe = () => { w.style.zIndex = window.State.nextZ(); };
        w.addEventListener('mousedown', focusMe, { capture: true });
        w.addEventListener('touchstart', focusMe, { passive: true, capture: true });
    }
    
    w.className = `window ${window.VFS.config.theme.openAnim || 'anim-fade'}`;
    w.style.display = 'flex';
    w.style.zIndex = window.State.nextZ();
    
    document.getElementById('main-menu').classList.remove('active');
    window.State.registerWindow(w.id, app.icon, app.name);
};

// ============ ПЕРЕТАСКИВАНИЕ ОКОН (С ЭФФЕКТАМИ И SNAP) ============

/**
 * Инициализировать перетаскивание окна
 * Поддерживает: наклон, эффект ткани, прозрачность, уменьшение, snap к краям
 * @param {HTMLElement} w - окно
 */
window.initDrag = (w) => {
    const h = w.querySelector('.win-header');
    if (!h) return;
    
    h.onmousedown = h.ontouchstart = (e) => {
        // Игнорируем клики по кнопкам управления и инпутам
        if (e.target.tagName === 'BUTTON' || e.target.closest('.win-controls') || e.target.tagName === 'INPUT') return;
        
        w.style.zIndex = window.State.nextZ();
        w.classList.remove('fullscreen');
        
        let startX = e.clientX || e.touches[0].clientX;
        let startY = e.clientY || e.touches[0].clientY;
        
        // Если окно было snapped — восстанавливаем размер
        if (w.dataset.snapped === 'true') {
            w.dataset.snapped = 'false';
            w.classList.remove('snapped');
            if (w.dataset.preSnapW) w.style.width = w.dataset.preSnapW;
            if (w.dataset.preSnapH) w.style.height = w.dataset.preSnapH;
            w.style.left = (startX - (w.offsetWidth / 2)) + 'px';
        }
        
        let offX = startX - w.offsetLeft;
        let offY = startY - w.offsetTop;
        
        // Сохраняем размер до snap
        if (w.dataset.snapped !== 'true') {
            w.dataset.preSnapW = w.style.width || w.offsetWidth + 'px';
            w.dataset.preSnapH = w.style.height || w.offsetHeight + 'px';
        }
        
        const anim = window.VFS.config.theme.moveAnim || 'move-none';
        const hl = document.getElementById('snap-highlight');
        const snapOn = window.VFS.config.theme.snapWindows !== false;
        let snapZone = '';
        
        // Отключаем pointer-events у iframe, чтобы не перехватывал события
        const iframe = w.querySelector('iframe');
        if (iframe) iframe.style.pointerEvents = 'none';
        
        // Начальные эффекты анимации
        if (anim === 'move-scale') w.style.transform = `scale(0.95)`;
        else if (anim === 'move-ghost') w.style.opacity = '0.6';
        
        document.onmousemove = document.ontouchmove = (ev) => {
            let currX = ev.clientX || ev.touches[0].clientX;
            let currY = ev.clientY || ev.touches[0].clientY;
            let dx = currX - startX;
            let dy = currY - startY;
            startX = currX;
            startY = currY;
            
            // Двигаем окно в пределах экрана
            w.style.left = Math.max(0, Math.min(window.innerWidth - 50, currX - offX)) + 'px';
            w.style.top = Math.max(0, Math.min(window.innerHeight - 50, currY - offY)) + 'px';
            
            // Snap-зоны
            let ww = window.innerWidth, wh = window.innerHeight, edge = 20;
            if (snapOn) {
                snapZone = '';
                hl.style.display = 'block';
                
                if (currX < edge && currY < edge) {
                    snapZone = 'tl'; hl.style.left = '0'; hl.style.top = '0'; hl.style.width = '50vw'; hl.style.height = '50vh';
                } else if (currX > ww - edge && currY < edge) {
                    snapZone = 'tr'; hl.style.left = '50vw'; hl.style.top = '0'; hl.style.width = '50vw'; hl.style.height = '50vh';
                } else if (currX < edge && currY > wh - edge) {
                    snapZone = 'bl'; hl.style.left = '0'; hl.style.top = '50vh'; hl.style.width = '50vw'; hl.style.height = '50vh';
                } else if (currX > ww - edge && currY > wh - edge) {
                    snapZone = 'br'; hl.style.left = '50vw'; hl.style.top = '50vh'; hl.style.width = '50vw'; hl.style.height = '50vh';
                } else if (currY < 10) {
                    snapZone = 'top'; hl.style.left = '0'; hl.style.top = '0'; hl.style.width = '100vw'; hl.style.height = '50vh';
                } else if (currY > wh - 10) {
                    snapZone = 'bottom'; hl.style.left = '0'; hl.style.top = '50vh'; hl.style.width = '100vw'; hl.style.height = '50vh';
                } else if (currX < 10) {
                    snapZone = 'left'; hl.style.left = '0'; hl.style.top = '0'; hl.style.width = '50vw'; hl.style.height = '100vh';
                } else if (currX > ww - 10) {
                    snapZone = 'right'; hl.style.left = '50vw'; hl.style.top = '0'; hl.style.width = '50vw'; hl.style.height = '100vh';
                } else {
                    hl.style.display = 'none';
                }
            }
            
            // Эффекты анимации при движении
            if (anim === 'move-tilt') w.style.transform = `rotate(${dx > 0 ? 2 : -2}deg)`;
            else if (anim === 'move-cloth') w.style.transform = `skewX(${-dx * 0.5}deg) skewY(${-dy * 0.5}deg)`;
        };
        
        document.onmouseup = document.ontouchend = () => {
            document.onmousemove = document.ontouchmove = null;
            document.onmouseup = document.ontouchend = null;
            
            // Сброс эффектов
            w.style.transform = 'none';
            w.style.opacity = '1';
            hl.style.display = 'none';
            
            if (iframe) iframe.style.pointerEvents = 'auto';
            
            // Применяем snap
            if (snapOn && snapZone) {
                w.dataset.snapped = 'true';
                w.classList.add('snapped');
                
                if (snapZone === 'tl') {
                    w.style.left = '0'; w.style.top = '0'; w.style.width = '50vw'; w.style.height = '50vh';
                } else if (snapZone === 'tr') {
                    w.style.left = '50vw'; w.style.top = '0'; w.style.width = '50vw'; w.style.height = '50vh';
                } else if (snapZone === 'bl') {
                    w.style.left = '0'; w.style.top = '50vh'; w.style.width = '50vw'; w.style.height = '50vh';
                } else if (snapZone === 'br') {
                    w.style.left = '50vw'; w.style.top = '50vh'; w.style.width = '50vw'; w.style.height = '50vh';
                } else if (snapZone === 'top') {
                    w.style.left = '0'; w.style.top = '0'; w.style.width = '100vw'; w.style.height = '50vh';
                } else if (snapZone === 'bottom') {
                    w.style.left = '0'; w.style.top = '50vh'; w.style.width = '100vw'; w.style.height = '50vh';
                } else if (snapZone === 'left') {
                    w.style.left = '0'; w.style.top = '0'; w.style.width = '50vw'; w.style.height = '100vh';
                } else if (snapZone === 'right') {
                    w.style.left = '50vw'; w.style.top = '0'; w.style.width = '50vw'; w.style.height = '100vh';
                }
            }
        };
    };
};

// ============ ИЗМЕНЕНИЕ РАЗМЕРА ОКОН ============

/**
 * Инициализировать изменение размера окна (ресайз)
 * @param {HTMLElement} w - окно
 */
window.initResize = (w) => {
    let r = w.querySelector('.resize-handle');
    if (!r) {
        r = document.createElement('div');
        r.className = 'resize-handle';
        w.appendChild(r);
    }
    
    r.onmousedown = r.ontouchstart = (e) => {
        e.stopPropagation();
        e.preventDefault();
        w.style.zIndex = window.State.nextZ();
        
        let sW = w.offsetWidth, sH = w.offsetHeight;
        let sX = e.clientX || e.touches[0].clientX;
        let sY = e.clientY || e.touches[0].clientY;
        
        const iframe = w.querySelector('iframe');
        if (iframe) iframe.style.pointerEvents = 'none';
        
        document.onmousemove = document.ontouchmove = (ev) => {
            if (w.classList.contains('fullscreen')) return;
            w.style.width = Math.max(250, sW + ((ev.clientX || ev.touches[0].clientX) - sX)) + 'px';
            w.style.height = Math.max(150, sH + ((ev.clientY || ev.touches[0].clientY) - sY)) + 'px';
        };
        
        document.onmouseup = document.ontouchend = () => {
            document.onmousemove = document.ontouchmove = null;
            document.onmouseup = document.ontouchend = null;
            
            if (iframe) iframe.style.pointerEvents = 'auto';
            
            // Сохраняем размер
            if (!window.VFS.config.winSizes) window.VFS.config.winSizes = {};
            window.VFS.config.winSizes[w.id] = { w: w.style.width, h: w.style.height };
            window.saveProfile();
        };
    };
};