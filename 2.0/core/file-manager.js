// core/file-manager.js - файловый менеджер, блокнот, бэкапы
// =========================================================
// Этот модуль отвечает за:
// - Переключение вкладок ФМ (Документы, Система, Рабочий стол, Бэкап)
// - Отрисовку файлового менеджера (навигация, drag&drop, контекстные меню)
// - Создание/удаление файлов и папок
// - Блокнот (открытие и сохранение файлов)
// - Экспорт/импорт бэкапов системы
// - Скачивание отдельных файлов

// ============ ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ============

/**
 * Переключить вкладку файлового менеджера
 * @param {string} tab - 'docs' | 'system' | 'desktop' | 'backup'
 * @param {HTMLElement} el - элемент вкладки (для подсветки)
 */
window.switchFMTab = (tab, el) => {
    document.querySelectorAll('.fm-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    window.State.currentFMTab = tab;
    window.State.currentFMPath = '/';
    window.renderFM();
};

// ============ ОТРИСОВКА ФАЙЛОВОГО МЕНЕДЖЕРА ============

/**
 * Отрисовать файловый менеджер согласно текущей вкладке и пути
 * Поддерживает 4 режима: документы, система, рабочий стол, бэкап
 */
window.renderFM = async () => {
    const grid = document.getElementById('fm-grid');
    const ctrl = document.getElementById('fm-controls');
    grid.innerHTML = '';
    ctrl.innerHTML = '';

    // === ВКЛАДКА: ДОКУМЕНТЫ ===
    if (window.State.currentFMTab === 'docs') {
        // Панель управления
        ctrl.innerHTML = `
            ${window.State.currentFMPath !== '/' ? `<button class="btn" style="width:auto; padding:8px 15px; margin:0;" onclick="fmGoUp()">⬅ Назад</button>` : ''}
            <button class="btn" style="width:auto; padding:8px 15px; margin:0;" onclick="createNewFile()">📄 Файл</button>
            <button class="btn" style="width:auto; padding:8px 15px; margin:0;" onclick="fmCreateFolder()">📁 Папка</button>
            <span style="align-self:center; margin-left:10px; opacity:0.7">Корневая ${window.State.currentFMPath}</span>
        `;

        // Собираем элементы текущего каталога
        let items = [];
        for (let path in window.VFS.files) {
            if (path === window.State.currentFMPath) continue;
            if (path.startsWith(window.State.currentFMPath)) {
                let rel = path.slice(window.State.currentFMPath.length);
                if (window.VFS.files[path].type === 'dir') {
                    if (rel.indexOf('/') === rel.length - 1) {
                        items.push({ name: rel.slice(0, -1), isDir: true });
                    }
                } else {
                    if (rel.indexOf('/') === -1) {
                        items.push({ name: rel, isDir: false });
                    }
                }
            }
        }

        // Сортировка: папки сверху, потом по алфавиту
        items.sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name));

        // Отрисовка элементов
        for (let item of items) {
            const icon = document.createElement('div');
            icon.className = 'desk-icon';
            icon.style.position = 'relative';
            const isDir = item.isDir;
            const file = item.name;

            icon.innerHTML = `
                <div class="desk-icon-img" style="font-size:26px; border-radius:8px;">${isDir ? '📁' : '📄'}</div>
                <div class="desk-icon-text" style="color:var(--text);">${file}</div>
            `;

            // Drag для файлов
            icon.draggable = true;
            icon.ondragstart = e => e.dataTransfer.setData('text/plain', file);

            if (isDir) {
                // Drop в папку (перемещение файлов)
                icon.ondragover = e => e.preventDefault();
                icon.ondrop = e => {
                    e.preventDefault();
                    let dragFileName = e.dataTransfer.getData('text/plain');
                    if (dragFileName && dragFileName !== file) {
                        let isDragDir = window.VFS.files[window.State.currentFMPath + dragFileName + '/'] !== undefined;
                        let oldPrefix = window.State.currentFMPath + dragFileName + (isDragDir ? '/' : '');
                        let targetPrefix = window.State.currentFMPath + file + '/';
                        for (let k in window.VFS.files) {
                            if (k.startsWith(oldPrefix)) {
                                let newK = targetPrefix + dragFileName + (isDragDir ? '/' : '') + k.slice(oldPrefix.length);
                                window.VFS.files[newK] = window.VFS.files[k];
                                delete window.VFS.files[k];
                            }
                        }
                        window.VFS.saveFiles();
                        window.renderFM();
                        window.notify("Перемещено", "success");
                    }
                };
                // Открытие папки
                icon.onclick = () => {
                    window.State.currentFMPath += file + '/';
                    window.renderFM();
                };
            } else {
                // Открытие файла в блокноте
                icon.onclick = () => window.openNotepad(file, window.State.currentFMPath);
            }

            // Контекстное меню
            icon.oncontextmenu = e => {
                e.preventDefault();
                e.stopPropagation();
                let cm = document.getElementById('icon-context-menu');
                cm.innerHTML = `
                    ${!isDir ? `<div class="cm-item" onclick="openNotepad('${file}', '${window.State.currentFMPath}')">🚀 Открыть</div>` : `<div class="cm-item" onclick="window.State.currentFMPath += '${file}/'; renderFM();">🚀 Открыть</div>`}
                    ${!isDir ? `<div class="cm-item" onclick="downloadFile('${file}')">⬇ Скачать</div>` : ''}
                    <div class="cm-item" style="color:var(--danger)" onclick="deleteFile('${file}', ${isDir})">🗑 Удалить</div>
                `;
                window.showMenuAt(cm, e);
            };

            grid.appendChild(icon);
        }
    }

    // === ВКЛАДКА: СИСТЕМА ===
    else if (window.State.currentFMTab === 'system') {
        ctrl.innerHTML = `<span style="opacity:0.7">Установленные приложения</span>`;
        for (let id in window.VFS.apps) {
            const icon = document.createElement('div');
            icon.className = 'desk-icon';
            icon.style.position = 'relative';
            icon.innerHTML = `
                <div class="desk-icon-img">${window.VFS.apps[id].icon}</div>
                <div class="desk-icon-text">${window.VFS.apps[id].name}</div>
            `;
            icon.onclick = () => window.openAppEditor(id, window.VFS.currentUser);
            grid.appendChild(icon);
        }
    }

    // === ВКЛАДКА: РАБОЧИЙ СТОЛ ===
    else if (window.State.currentFMTab === 'desktop') {
        ctrl.innerHTML = `<span style="opacity:0.7">Ярлыки и папки рабочего стола</span>`;

        // Папки рабочего стола
        for (let fId in window.VFS.folders) {
            const icon = document.createElement('div');
            icon.className = 'desk-icon';
            icon.style.position = 'relative';
            icon.innerHTML = `
                <div class="desk-icon-img">📁</div>
                <div class="desk-icon-text">${window.VFS.folders[fId].name}</div>
            `;
            icon.onclick = () => window.openDeskFolder(fId, window.VFS.folders[fId].name);
            grid.appendChild(icon);
        }

        // Приложения без папки
        for (let id in window.VFS.apps) {
            if (!window.VFS.apps[id].deskFolderId) {
                const icon = document.createElement('div');
                icon.className = 'desk-icon';
                icon.style.position = 'relative';
                icon.innerHTML = `
                    <div class="desk-icon-img">${window.VFS.apps[id].icon}</div>
                    <div class="desk-icon-text">${window.VFS.apps[id].name}</div>
                `;
                icon.onclick = () => {
                    if (window.VFS.apps[id].type === 'url') {
                        window.open(window.VFS.apps[id].url, '_blank');
                    } else {
                        window.runApp(id, window.VFS.apps[id]);
                    }
                };
                grid.appendChild(icon);
            }
        }
    }

    // === ВКЛАДКА: БЭКАП ===
    else if (window.State.currentFMTab === 'backup') {
        ctrl.innerHTML = `
            <button class="btn" style="width:auto; padding:8px 15px; margin:0; background:#2ecc71;" onclick="downloadBackup()">⬇ Скачать бэкап ОС (JSON)</button>
            <button class="btn" style="width:auto; padding:8px 15px; margin:0;" onclick="document.getElementById('backup-upload').click()">⬆ Загрузить бэкап</button>
        `;
        grid.innerHTML = `
            <div style="color:var(--text); opacity:0.8; padding:10px;">
                Файл бэкапа содержит настройки ОС, все установленные приложения и личные файлы благодаря переходу на единую базу данных IndexedDB.
            </div>
        `;
    }
};

// ============ НАВИГАЦИЯ ============

/**
 * Перейти на уровень выше в файловом менеджере
 */
window.fmGoUp = () => {
    let parts = window.State.currentFMPath.split('/').filter(p => p);
    parts.pop();
    window.State.currentFMPath = parts.length > 0 ? '/' + parts.join('/') + '/' : '/';
    window.renderFM();
};

// ============ СОЗДАНИЕ ФАЙЛОВ И ПАПOK ============

/**
 * Создать новую папку в текущем каталоге ФМ
 */
window.fmCreateFolder = () => {
    const name = prompt("Имя папки:");
    if (!name) return;
    const safeName = name.replace(/\//g, '');
    const newPath = window.State.currentFMPath + safeName + '/';
    window.VFS.files[newPath] = { type: 'dir' };
    window.VFS.saveFiles();
    window.renderFM();
};

/**
 * Создать новый текстовый файл в текущем каталоге ФМ
 */
window.createNewFile = () => {
    const name = prompt("Введите имя файла:");
    if (!name) return;
    const safeName = name.replace(/\//g, '');
    const fname = safeName.endsWith('.txt') ? safeName : safeName + '.txt';
    const newPath = window.State.currentFMPath + fname;
    window.VFS.files[newPath] = { type: 'file', content: '' };
    window.VFS.saveFiles();
    window.renderFM();
    window.notify("Файл создан", "success");
};

// ============ СКАЧИВАНИЕ ============

/**
 * Скачать файл из ФМ
 * @param {string} fileName - имя файла
 */
window.downloadFile = (fileName) => {
    const fullPath = window.State.currentFMPath + fileName;
    if (window.VFS.files[fullPath]) {
        const blob = new Blob([window.VFS.files[fullPath].content || ''], { type: 'text/plain' });
        let a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
    } else {
        window.notify("Ошибка скачивания: Файл не найден", "error");
    }
};

/**
 * Скачать полный бэкап системы (все данные IndexedDB)
 */
window.downloadBackup = async () => {
    const allKeys = await window.idb.keys();
    const backupData = {};
    for (let key of allKeys) {
        backupData[key] = await window.idb.get(key);
    }
    const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'websaos_system_backup.json';
    a.click();
};

// ============ ЗАГРУЗКА БЭКАПА ============

// Обработчик загрузки бэкапа из файла
document.getElementById('backup-upload').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            let data = JSON.parse(ev.target.result);
            for (let k in data) await window.idb.set(k, data[k]);
            window.notify("Бэкап системы успешно восстановлен! Перезагрузка...", "success");
            setTimeout(() => location.reload(), 2000);
        } catch (err) {
            window.notify("Ошибка файла бэкапа", "error");
        }
    };
    reader.readAsText(file);
    e.target.value = '';
};

// ============ УДАЛЕНИЕ ============

/**
 * Удалить файл или папку в ФМ
 * @param {string} name - имя
 * @param {boolean} isDir - это папка?
 */
window.deleteFile = (name, isDir) => {
    if (!confirm(`Удалить ${name}?`)) return;
    const pathToDelete = window.State.currentFMPath + name + (isDir ? '/' : '');
    for (let k in window.VFS.files) {
        if (k.startsWith(pathToDelete)) delete window.VFS.files[k];
    }
    window.VFS.saveFiles();
    window.renderFM();
    window.notify("Удалено");
    document.getElementById('icon-context-menu').style.display = 'none';
};

// ============ БЛОКНОТ ============

/**
 * Открыть блокнот для редактирования файла
 * @param {string} fileName - имя файла (если пусто — новый)
 * @param {string} path - путь к файлу
 */
window.openNotepad = (fileName = "", path = "") => {
    let content = '';
    if (fileName) {
        const fullPath = (path || window.State.currentFMPath) + fileName;
        if (window.VFS.files[fullPath]) {
            content = window.VFS.files[fullPath].content || '';
        }
    }
    document.getElementById('icon-context-menu').style.display = 'none';
    document.getElementById('np-title').innerText = fileName ? `Блокнот - ${fileName}` : 'Блокнот (Новый файл)';
    document.getElementById('np-filename').value = fileName;
    document.getElementById('np-filename').dataset.path = path || window.State.currentFMPath;
    document.getElementById('np-text').value = content;
    window.openWin('win-notepad');
};

/**
 * Сохранить содержимое блокнота в файл
 */
window.saveNotepad = () => {
    let fileName = document.getElementById('np-filename').value.trim();
    if (!fileName) {
        fileName = prompt("Укажите имя для сохранения файла:");
        if (!fileName) return;
        fileName = fileName.replace(/\//g, '');
        fileName = fileName.endsWith('.txt') ? fileName : fileName + '.txt';
        document.getElementById('np-filename').value = fileName;
        document.getElementById('np-title').innerText = `Блокнот - ${fileName}`;
    }
    let path = document.getElementById('np-filename').dataset.path || window.State.currentFMPath;
    const fullPath = path + fileName;
    if (!window.VFS.files[fullPath]) {
        window.VFS.files[fullPath] = { type: 'file', content: '' };
    }
    window.VFS.files[fullPath].content = document.getElementById('np-text').value;
    window.VFS.saveFiles();
    window.notify("Файл успешно сохранен", "success");
    if (window.State.currentFMTab === 'docs') window.renderFM();
};