// core/apps.js - менеджер и редактор приложений WebSAOS
// =====================================================
// Этот модуль отвечает за:
// - Открытие менеджера приложений (список всех установленных)
// - Удаление приложений (с поддержкой режима Admin)
// - Редактирование приложений (иконка, имя, код)
// - Сохранение изменений
// - Загрузка приложений через input (файл .html/.js/.txt)

// ============ МЕНЕДЖЕР ПРИЛОЖЕНИЙ ============

/**
 * Открыть менеджер приложений
 * Для Admin показывает все приложения всех пользователей
 * Для обычного пользователя — только свои
 */
window.openAppManager = async () => {
    const mgrCont = document.getElementById('app-manager-list');
    mgrCont.innerHTML = '';
    
    document.getElementById('mgr-title').innerText = 
        window.VFS.currentUser === 'Admin' ? 'Менеджер (Глобальный)' : 'Менеджер Приложений';
    
    let appsToRender = [];
    
    // Режим Admin — собираем приложения всех пользователей
    if (window.VFS.currentUser === 'Admin') {
        const allKeys = await window.idb.keys();
        for (let key of allKeys) {
            if (key.startsWith('apps_')) {
                let owner = key.replace('apps_', '');
                let ownerApps = await window.idb.get(key) || {};
                for (let id in ownerApps) {
                    appsToRender.push({ id, owner, app: ownerApps[id] });
                }
            }
        }
    }
    // Обычный режим — только свои приложения
    else {
        for (let id in window.VFS.apps) {
            appsToRender.push({ id, owner: window.VFS.currentUser, app: window.VFS.apps[id] });
        }
    }
    
    // Отрисовка списка
    appsToRender.forEach(item => {
        const typeTag = item.app.type === 'url' ? '🌐 Ярлык' : '📦 Прил.';
        const ownerTag = window.VFS.currentUser === 'Admin'
            ? `<small style="color:var(--accent)"> [${item.owner}]</small>`
            : '';
        
        mgrCont.innerHTML += `
            <div class="list-item">
                <div>
                    ${item.app.icon} <b>${item.app.name}</b> ${ownerTag}
                    <br><small style="opacity:0.5">${typeTag}</small>
                </div>
                <div style="display:flex; gap:5px;">
                    ${item.app.type !== 'url' ? `
                        <button class="btn" style="width:auto; padding:5px; margin:0; background:#f39c12" 
                                onclick="openAppEditor('${item.id}', '${item.owner}')">✏️ Редакт.</button>
                    ` : ''}
                    <button class="btn" style="width:auto; padding:5px 10px; margin:0; background:var(--danger)" 
                            onclick="removeApp('${item.id}', '${item.owner}')">🗑</button>
                </div>
            </div>
        `;
    });
    
    window.openWin('win-app-manager');
};

// ============ УДАЛЕНИЕ ПРИЛОЖЕНИЯ ============

/**
 * Удалить приложение
 * @param {string} id - ID приложения
 * @param {string} owner - владелец приложения
 */
window.removeApp = async (id, owner) => {
    if (!confirm(`Удалить приложение?`)) return;
    
    if (owner === window.VFS.currentUser) {
        // Удаляем из своего профиля
        delete window.VFS.apps[id];
        window.VFS.saveApps();
    } else {
        // Admin удаляет из чужого профиля
        const targetApps = await window.idb.get(`apps_${owner}`) || {};
        delete targetApps[id];
        await window.idb.set(`apps_${owner}`, targetApps);
    }
    
    window.openAppManager();
    window.renderDesktop();
    window.notify("Удалено");
};

// ============ РЕДАКТОР ПРИЛОЖЕНИЙ ============

/**
 * Открыть редактор приложения
 * @param {string} id - ID приложения
 * @param {string} owner - владелец
 */
window.openAppEditor = async (id, owner) => {
    let apps = (owner === window.VFS.currentUser)
        ? window.VFS.apps
        : (await window.idb.get(`apps_${owner}`) || {});
    
    if (!apps[id]) return;
    
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-owner').value = owner;
    document.getElementById('edit-icon').value = apps[id].icon;
    document.getElementById('edit-name').value = apps[id].name;
    document.getElementById('edit-code').value = apps[id].code;
    
    window.openWin('win-app-editor');
};

/**
 * Сохранить отредактированное приложение
 */
window.saveEditedApp = async () => {
    const id = document.getElementById('edit-id').value;
    const owner = document.getElementById('edit-owner').value;
    
    if (owner === window.VFS.currentUser) {
        // Сохраняем в свой профиль
        window.VFS.apps[id].icon = document.getElementById('edit-icon').value;
        window.VFS.apps[id].name = document.getElementById('edit-name').value;
        window.VFS.apps[id].code = document.getElementById('edit-code').value;
        window.VFS.saveApps();
    } else {
        // Admin сохраняет в чужой профиль
        const apps = await window.idb.get(`apps_${owner}`) || {};
        if (apps[id]) {
            apps[id].icon = document.getElementById('edit-icon').value;
            apps[id].name = document.getElementById('edit-name').value;
            apps[id].code = document.getElementById('edit-code').value;
            await window.idb.set(`apps_${owner}`, apps);
        }
    }
    
    window.notify("Приложение сохранено!", "success");
    document.getElementById('win-app-editor').style.display = 'none';
    window.renderDesktop();
    window.openAppManager();
};

// ============ ЗАГРУЗКА ПРИЛОЖЕНИЯ ============

// Обработчик загрузки приложения через input
document.getElementById('app-upload').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        const name = file.name.replace(/\.[^/.]+$/, "");
        window.VFS.apps['app_' + Date.now()] = {
            name,
            icon: '🚀',
            type: 'internal',
            code: ev.target.result,
            deskFolderId: null
        };
        window.VFS.saveApps();
        window.renderDesktop();
        window.openAppManager();
        window.notify(`Приложение ${name} установлено!`, "success");
    };
    reader.readAsText(file);
    e.target.value = '';
};