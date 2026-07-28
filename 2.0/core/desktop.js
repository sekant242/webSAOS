// core/desktop.js - рабочий стол, иконки, папки
// ==============================================
// Этот модуль отвечает за:
// - Отрисовку иконок приложений и папок на рабочем столе
// - Перетаскивание иконок с сохранением позиции
// - Создание/переименование/удаление папок
// - Создание ярлыков URL
// - Открытие папок в отдельных окнах
// - Контекстные меню для иконок

// ============ СОЗДАНИЕ ПАПКИ ============

/**
 * Создать новую папку на рабочем столе
 */
window.createNewFolder = () => {
    const name = prompt("Имя новой папки:");
    if (!name) return;
    window.VFS.folders['df_' + Date.now()] = { name: name };
    window.VFS.saveFolders();
    window.renderDesktop();
};

// ============ СОЗДАНИЕ ЯРЛЫКА ============

/**
 * Создать ярлык URL на рабочем столе
 */
window.createUrlShortcut = () => {
    const name = prompt("Имя ярлыка:");
    if (!name) return;
    const url = prompt("Введите URL:", "https://");
    if (!url) return;
    window.VFS.apps['url_' + Date.now()] = { name, icon: '🌐', type: 'url', url };
    window.VFS.saveApps();
    window.renderDesktop();
};

// ============ УПРАВЛЕНИЕ ПАПКАМИ ============

/**
 * Переименовать папку на рабочем столе
 * @param {string} fId - ID папки
 * @param {Event} e - событие для остановки всплытия
 */
window.renameDesktopFolder = (fId, e) => {
    e.stopPropagation();
    if (!window.VFS.folders[fId]) return;
    const currentName = window.VFS.folders[fId].name;
    const newName = prompt("Введите новое имя папки:", currentName);
    if (newName && newName.trim() !== "" && newName !== currentName) {
        window.VFS.folders[fId].name = newName.trim();
        window.VFS.saveFolders();
        window.renderDesktop();
    }
};

/**
 * Удалить папку с рабочего стола
 * Все приложения из неё перемещаются на рабочий стол
 * @param {string} fId - ID папки
 * @param {Event} e - событие
 */
window.deleteDesktopFolder = (fId, e) => {
    e.stopPropagation();
    if (!confirm("Удалить эту папку? Все приложения из неё будут перемещены на рабочий стол.")) return;
    delete window.VFS.folders[fId];
    window.VFS.saveFolders();
    
    let appsUpdated = false;
    for (let appId in window.VFS.apps) {
        if (window.VFS.apps[appId].deskFolderId === fId) {
            window.VFS.apps[appId].deskFolderId = null;
            appsUpdated = true;
        }
    }
    if (appsUpdated) window.VFS.saveApps();
    
    window.notify("Папка удалена", "success");
    window.renderDesktop();
};

// ============ ОТКРЫТИЕ ПАПКИ В ОКНЕ ============

/**
 * Открыть папку на рабочем столе в отдельном окне
 * @param {string} fId - ID папки
 * @param {string} name - имя папки
 */
window.openDeskFolder = (fId, name) => {
    let winId = 'win-folder-' + fId;
    let w = document.getElementById(winId);
    
    if (!w) {
        w = document.createElement('div');
        w.id = winId;
        w.className = `window ${window.VFS.config.theme.openAnim || 'anim-fade'}`;
        w.style.cssText = "width:300px; height:350px; top:20%; left:20%; display:flex;";
        w.innerHTML = `
            <div class="win-header">
                <span id="title-${winId}">${name}</span>
                <div class="win-controls">
                    <button class="ctrl-btn" onclick="minimizeWindow('${winId}')">_</button>
                    <button class="ctrl-btn" onclick="maximizeWindow('${winId}')">□</button>
                    <button class="ctrl-btn" style="background:var(--danger)" onclick="closeWindow('${winId}')">✕</button>
                </div>
            </div>
            <div class="win-content" style="padding:0; background:rgba(0,0,0,0.2);">
                <div id="content-${winId}" class="folder-grid"></div>
            </div>
        `;
        document.body.appendChild(w);
        
        // Инициализация drag/resize (из window-manager.js)
        window.initDrag(w);
        window.initResize(w);
        window.applySavedSize(w);
        
        // Фокусировка при клике
        const focusMe = () => { w.style.zIndex = window.State.nextZ(); };
        w.addEventListener('mousedown', focusMe, { capture: true });
        w.addEventListener('touchstart', focusMe, { passive: true, capture: true });
    }
    
    // Отрисовка содержимого папки
    const content = document.getElementById(`content-${winId}`);
    content.innerHTML = '';
    const myApps = window.VFS.apps;
    
    for (let id in myApps) {
        if (myApps[id].deskFolderId === fId) {
            const appIcon = document.createElement('div');
            appIcon.className = 'desk-icon';
            appIcon.style.position = 'relative';
            appIcon.innerHTML = `
                <div class="desk-icon-img">${myApps[id].icon}</div>
                <div class="desk-icon-text">${myApps[id].name}</div>
            `;
            appIcon.onclick = () => {
                if (myApps[id].type === 'url') {
                    window.open(myApps[id].url, '_blank');
                } else {
                    window.runApp(id, myApps[id]);
                }
            };
            content.appendChild(appIcon);
        }
    }
    
    w.style.display = 'flex';
    w.style.zIndex = window.State.nextZ();
    
    // Регистрация окна в виджете Dock (из widgets.js)
    window.State.registerWindow(winId, '📁', name);
    if (window.renderWindowWidget) window.renderWindowWidget();
};

// ============ КОНТЕКСТНОЕ МЕНЮ ИКОНОК ============

/**
 * Действие для контекстного меню иконки рабочего стола
 * @param {string} action - 'open' | 'delete' | 'move'
 * @param {string} id - ID приложения
 * @param {string|null} folderId - ID папки (для move)
 */
window.desktopIconAction = (action, id, folderId = null) => {
    document.getElementById('icon-context-menu').style.display = 'none';
    
    if (action === 'open') {
        if (window.VFS.apps[id].type === 'url') {
            window.open(window.VFS.apps[id].url, '_blank');
        } else {
            window.runApp(id, window.VFS.apps[id]);
        }
    } else if (action === 'delete') {
        window.removeApp(id, window.VFS.currentUser);
    } else if (action === 'move') {
        window.VFS.apps[id].deskFolderId = folderId;
        window.VFS.saveApps();
        window.notify(folderId ? "Перемещено в папку" : "Перемещено на рабочий стол", "success");
        window.renderDesktop();
    }
};

/**
 * Показать контекстное меню для иконки рабочего стола
 * @param {Event} e
 * @param {string} id - ID приложения
 * @param {object} app - объект приложения
 */
const showIconContextMenu = (e, id, app) => {
    e.preventDefault();
    e.stopPropagation();
    const menu = document.getElementById('icon-context-menu');
    
    let html = `
        <div class="cm-item" onclick="desktopIconAction('open', '${id}')">🚀 Открыть</div>
        <div class="cm-item" style="color:var(--danger)" onclick="desktopIconAction('delete', '${id}')">🗑 Удалить</div>
        <hr style="border-color:rgba(128,128,128,0.2); margin: 5px 0;">
        <div style="padding: 5px 15px; font-size:10px; opacity:0.6;">Переместить в:</div>
    `;
    
    let hasFolders = false;
    for (let fId in window.VFS.folders) {
        if (app.deskFolderId !== fId) {
            hasFolders = true;
            html += `<div class="cm-item" onclick="desktopIconAction('move', '${id}', '${fId}')">📁 ${window.VFS.folders[fId].name}</div>`;
        }
    }
    
    if (app.deskFolderId) {
        html += `<div class="cm-item" onclick="desktopIconAction('move', '${id}', null)">🖥 На рабочий стол</div>`;
    } else if (!hasFolders) {
        html += `<div style="padding: 5px 15px; font-size:10px; opacity:0.6;">(Нет других папок)</div>`;
    }
    
    menu.innerHTML = html;
    window.showMenuAt(menu, e);
};

// ============ ПЕРЕТАСКИВАНИЕ ИКОНОК ============

/**
 * Сделать иконку рабочего стола перетаскиваемой, восстановить позицию
 * @param {HTMLElement} icon - элемент иконки
 * @param {string} id - ID (приложения или папки)
 * @param {boolean} isFolder - это папка?
 */
function makeIconDraggable(icon, id, isFolder = false) {
    // Восстанавливаем сохранённую позицию
    if (window.VFS.config.iconPos && window.VFS.config.iconPos[id]) {
        icon.style.left = window.VFS.config.iconPos[id].x + 'px';
        icon.style.top = window.VFS.config.iconPos[id].y + 'px';
    }
    
    icon.onmousedown = icon.ontouchstart = (e) => {
        if (e.button === 2 || e.target.closest('[title]')) return;
        
        let sX = (e.clientX || e.touches[0].clientX) - icon.offsetLeft;
        let sY = (e.clientY || e.touches[0].clientY) - icon.offsetTop;
        let dragged = false;
        
        let moveHandler = (ev) => {
            dragged = true;
            icon.classList.add('dragging');
            icon.style.left = (ev.clientX || ev.touches[0].clientX) - sX + 'px';
            icon.style.top = (ev.clientY || ev.touches[0].clientY) - sY + 'px';
        };
        
        let upHandler = () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('touchmove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            document.removeEventListener('touchend', upHandler);
            icon.classList.remove('dragging');
            
            if (dragged) {
                window.VFS.config.iconPos[id] = {
                    x: parseInt(icon.style.left),
                    y: parseInt(icon.style.top)
                };
                window.saveProfile();
            }
        };
        
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('touchmove', moveHandler);
        document.addEventListener('mouseup', upHandler);
        document.addEventListener('touchend', upHandler);
    };
}

// ============ ОТРИСОВКА РАБОЧЕГО СТОЛА ============

/**
 * Отрисовать рабочий стол (иконки приложений и папок)
 */
window.renderDesktop = () => {
    const deskCont = document.getElementById('desktop-icons');
    deskCont.innerHTML = '';
    
    // 1. Рисуем папки
    for (let fId in window.VFS.folders) {
        const folderIcon = document.createElement('div');
        folderIcon.className = 'desk-icon';
        folderIcon.innerHTML = `
            <div onclick="renameDesktopFolder('${fId}', event)" title="Переименовать" style="position:absolute; top:-5px; left:-5px; width:20px; height:20px; background:#f39c12; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer; z-index:5;">✏️</div>
            <div onclick="deleteDesktopFolder('${fId}', event)" title="Удалить" style="position:absolute; top:-5px; left:18px; width:20px; height:20px; background:var(--danger); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer; z-index:5;">🗑</div>
            <div class="desk-icon-img">📁</div>
            <div class="desk-icon-text">${window.VFS.folders[fId].name}</div>
        `;
        
        folderIcon.onclick = (e) => {
            if (e.target.classList.contains('desk-icon-img') || 
                e.target.classList.contains('desk-icon-text') || 
                e.target.classList.contains('desk-icon')) {
                window.openDeskFolder(fId, window.VFS.folders[fId].name);
            }
        };
        
        makeIconDraggable(folderIcon, fId, true);
        deskCont.appendChild(folderIcon);
    }
    
    // 2. Рисуем приложения (без папок)
    for (let id in window.VFS.apps) {
        if (!window.VFS.apps[id].deskFolderId) {
            const appIcon = document.createElement('div');
            appIcon.className = 'desk-icon';
            appIcon.innerHTML = `
                <div class="desk-icon-img">${window.VFS.apps[id].icon}</div>
                <div class="desk-icon-text">${window.VFS.apps[id].name}</div>
            `;
            
            // Контекстное меню (правый клик)
            appIcon.oncontextmenu = (e) => showIconContextMenu(e, id, window.VFS.apps[id]);
            
            // Контекстное меню (долгое нажатие на тач-устройствах)
            let pressTimer;
            appIcon.ontouchstart = (e) => {
                pressTimer = setTimeout(() => showIconContextMenu(e, id, window.VFS.apps[id]), 600);
            };
            appIcon.ontouchend = appIcon.ontouchcancel = () => clearTimeout(pressTimer);
            
            // Открытие приложения (левый клик)
            appIcon.onclick = (e) => {
                if (document.getElementById('icon-context-menu').style.display !== 'flex') {
                    if (window.VFS.apps[id].type === 'url') {
                        window.open(window.VFS.apps[id].url, '_blank');
                    } else {
                        window.runApp(id, window.VFS.apps[id]);
                    }
                }
            };
            
            makeIconDraggable(appIcon, id);
            deskCont.appendChild(appIcon);
        }
    }
};