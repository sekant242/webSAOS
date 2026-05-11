// core.js - обновленная версия с поддержкой тем, комментариями и функциями из core_upd.js

// PWA Installation Setup
(function setupPWA() {
    const manifest = {
        name: "WebSAOS 1.13", short_name: "WebSAOS",
        display: "standalone", start_url: ".",
        background_color: "#000000", theme_color: "#2b8cff",
        icons: [{src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💻</text></svg>", sizes: "192x192", type: "image/svg+xml"}]
    };
    const blob = new Blob([JSON.stringify(manifest)], {type: 'application/json'});
    const link = document.createElement('link'); link.rel = 'manifest'; link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);
    
    if('serviceWorker' in navigator) {
        const swBlob = new Blob(["self.addEventListener('fetch', function(event) {});"], {type: 'application/javascript'});
        navigator.serviceWorker.register(URL.createObjectURL(swBlob)).catch(e => console.log('SW Reg failed', e));
    }
})();

// Главная самовызывающаяся функция, содержащая всё ядро ОС
(function() {
  let highestZ = 1000;               // максимальный z-index для окон
  let currentOpenDeskFolder = null; 
  let windowInstances = [];           // массив открытых окон для виджета
  let currentFMTab = 'docs';          // текущая вкладка файлового менеджера
  let currentFMPath = '/';            // текущий путь в ФМ
  
  let rawStorageUsed = 0;
  let rawStorageQuota = 0;

  // значения CSS-переменных по умолчанию
  const defaultVars = {
    '--accent': '#2b8cff', '--win-bg-rgb': '22, 31, 41', '--text': '#e6eef8', 
    '--win-border': '#444444', '--win-opacity': '0.85', '--glass-blur': '15px', 
    '--blur': '0px', '--shadow-op': '0.5', '--win-radius': '16px 16px 16px 16px',
    '--btn-radius': '10px 10px 10px 10px', '--menu-radius': '16px 16px 16px 16px',
    '--icon-size': '54px', '--text-size': '11px', '--ww-bg': 'rgba(22, 31, 41, 0.8)', '--ww-border': '#444444'
  };

  /**
   * Показать всплывающее уведомление
   * @param {string} msg - текст уведомления
   * @param {string} type - тип: 'info', 'success', 'error'
   */
  window.notify = (msg, type = 'info') => {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = `toast ${type}`; toast.innerText = msg;
      container.appendChild(toast);
      setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 300); }, 3000);
  };

  /**
   * Показать контекстное меню в указанной позиции (по событию)
   * @param {HTMLElement} menu - элемент меню
   * @param {Event} e - событие мыши или касания
   */
  window.showMenuAt = (menu, e) => {
      menu.style.display = 'flex';
      let x = e.clientX || (e.touches ? e.touches[0].clientX : 0);
      let y = e.clientY || (e.touches ? e.touches[0].clientY : 0);
      menu.style.left = x + 'px'; menu.style.top = y + 'px';
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) x = window.innerWidth - rect.width - 10;
      if (rect.bottom > window.innerHeight) y = window.innerHeight - rect.height - 10;
      menu.style.left = Math.max(10, x) + 'px'; menu.style.top = Math.max(10, y) + 'px';
  };

  /**
   * Обновить круговую диаграмму использования хранилища
   */
  window.updateStorageChart = async () => {
      if(navigator.storage && navigator.storage.estimate) {
          try {
              const est = await navigator.storage.estimate();
              rawStorageUsed = est.usage || 0; rawStorageQuota = est.quota || 0;
              const percent = Math.min(Math.round((rawStorageUsed / rawStorageQuota) * 100), 100);
              document.getElementById('storage-circle').setAttribute('stroke-dasharray', `${percent}, 100`);
              document.getElementById('storage-text').innerText = `${percent}%`;
          } catch(e) {}
      }
  };

  /**
   * Показать детальную информацию о хранилище
   */
  window.showStorageInfo = () => {
      if (rawStorageQuota > 0) {
          const usedMB = (rawStorageUsed / 1024 / 1024).toFixed(2);
          const quotaGB = (rawStorageQuota / 1024 / 1024 / 1024).toFixed(2);
          notify(`Занято: ${usedMB} MB из ${quotaGB} GB`, 'info');
      } else notify('Информация о хранилище недоступна', 'error');
  }

  // загрузка после полной загрузки DOM
  window.onload = async () => {
    await window.VFS.loadSystem();
    renderUsersGrid(); 
    updateStorageChart(); 
    setInterval(tickClock, 1000);
  };

  /**
   * Отрисовать сетку пользователей на экране входа
   */
  function renderUsersGrid() {
    const grid = document.getElementById('users-grid'); grid.innerHTML = '';
    for(let username in window.VFS.users) {
        let card = document.createElement('div'); card.className = 'user-card';
        card.innerHTML = `<div class="user-icon">${window.VFS.users[username].icon}</div><div class="user-name">${username}</div>`;
        card.onclick = () => attemptLogin(username, window.VFS.users[username].pass);
        grid.appendChild(card);
    }
  }

  /**
   * Попытка входа пользователя
   * @param {string} username 
   * @param {string} hasPass - пароль (может быть пустым)
   */
  window.attemptLogin = async (username, hasPass) => {
      if (hasPass) { if (prompt(`Введите пароль для ${username}:`) !== hasPass) return notify("Неверный пароль!", "error"); }
      window.VFS.currentUser = username;
      document.getElementById('login-screen').style.display = 'none';
      await window.VFS.loadUser(username);
      if(window.GameService) await window.GameService.init(); // Запуск игрового сервиса
      loadUserState();
  }
  
  /**
   * Показать/скрыть форму создания нового пользователя
   */
  window.toggleNewUserForm = () => { const f = document.getElementById('new-user-form'); f.style.display = f.style.display === 'none' ? 'block' : 'none'; }
  
  /**
   * Создать нового пользователя
   */
  window.createNewUser = () => {
      const name = document.getElementById('new-u-name').value.trim();
      if (!name || window.VFS.users[name]) return notify('Ошибка имени', "error");
      window.VFS.users[name] = { icon: document.getElementById('new-u-icon').value || '👤', pass: document.getElementById('new-u-pass').value };
      window.VFS.saveUsers();
      toggleNewUserForm(); renderUsersGrid(); notify('Пользователь создан', 'success');
  }

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
          window.VFS.saveFolders(); renderDesktop(); 
      }
  };

  /**
   * Удалить папку с рабочего стола
   * @param {string} fId - ID папки
   * @param {Event} e - событие
   */
  window.deleteDesktopFolder = (fId, e) => {
      e.stopPropagation();
      if (!confirm("Удалить эту папку? Все приложения из неё будут перемещены на рабочий стол.")) return;
      delete window.VFS.folders[fId]; window.VFS.saveFolders();
      let appsUpdated = false;
      for (let appId in window.VFS.apps) { if (window.VFS.apps[appId].deskFolderId === fId) { window.VFS.apps[appId].deskFolderId = null; appsUpdated = true; } }
      if (appsUpdated) window.VFS.saveApps();
      notify("Папка удалена", "success"); renderDesktop(); 
  };

  /**
   * Выход из текущего пользователя
   */
  window.logout = () => {
      windowInstances.forEach(win => { const w = document.getElementById(win.id); if(w) { if(w.id.startsWith('run-') || w.id.startsWith('win-folder-')) w.remove(); else w.style.display = 'none'; }});
      windowInstances = [];
      document.getElementById('windows-widget').style.display = 'none';
      document.getElementById('main-menu').classList.remove('active');
      document.getElementById('control-center').style.display = 'none';
      document.getElementById('desktop-icons').innerHTML = '';
      document.getElementById('clock-widget').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
      window.VFS.currentUser = ''; renderUsersGrid();
  }

  // ========== ОБНОВЛЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ СОСТОЯНИЯ ПОЛЬЗОВАТЕЛЯ ==========
  /**
   * Загрузить состояние пользователя (темы, настройки, виджеты, рабочий стол)
   * Обновлена поддержка CSS-классов темы, иконки Пуск и фона
   */
  function loadUserState() {
    for (let key in defaultVars) document.documentElement.style.setProperty(key, defaultVars[key]);
    let state = window.VFS.config;
    
    if(!state.theme) state.theme = {};
    if(state.theme.snapWindows === undefined) state.theme.snapWindows = true;
    if(!state.theme.winCtrlPos) state.theme.winCtrlPos = 'right';
    if(!state.theme.taskbarPos) state.theme.taskbarPos = 'horizontal';
    if(!state.dockSettings) state.dockSettings = {bg: '#161f29', op: '0.8', border: '#444444', confirm: true};
    if(!state.dockPos) state.dockPos = {x: null, y: null};
    if(!state.widgetPos) state.widgetPos = {x: 100, y: 100};
    if(!state.iconPos) state.iconPos = {};
    if(!state.winSizes) state.winSizes = {};
    if(!state.widgets) { state.widgets = { 'clock-widget': { visible: true, top: false }, 'windows-widget': { visible: true, top: false }, 'storage-widget': { visible: true, top: false } }; }

    const themeSel = document.getElementById('sel-theme');
    if (themeSel && themeSel.options.length <= 1 && window.Themes) {
        for (let key in window.Themes) {
            let opt = document.createElement('option');
            opt.value = key;
            opt.innerText = window.Themes[key].name;
            themeSel.appendChild(opt);
        }
    }

    // Восстанавливаем CSS класс темы
    document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
    if(state.theme.cssClass) document.body.classList.add(state.theme.cssClass);
    if(state.theme.startIcon) {
        const bBtn = document.getElementById('burger-btn');
        if(bBtn) bBtn.innerHTML = state.theme.startIcon;
    }

    applySettings(); renderDesktop(); applyWidgetState(); loadRadiiUI();
    
    document.querySelectorAll('.window').forEach(win => { 
        initDrag(win); initResize(win); applySavedSize(win);
        const focusMe = () => { win.style.zIndex = ++highestZ; };
        win.addEventListener('mousedown', focusMe, {capture: true});
        win.addEventListener('touchstart', focusMe, {passive: true, capture: true});
    });
    
    initWidgetDrag(document.getElementById('clock-widget')); initDockDrag(document.getElementById('windows-widget')); initControlCenterDrag(); 
    applyWidgetSettingsToDOM(); loadWidgetSettings('clock-widget'); applyWWSettingsUI();
    notify(`Добро пожаловать, ${window.VFS.currentUser}!`, "success"); 
  }

  /**
   * Сохранить текущий профиль (настройки)
   */
  window.saveProfile = () => { window.VFS.saveConfig(); }

  /**
   * Переключение главного меню (Пуск)
   * @param {Event} e - событие
   */
  window.toggleMenu = (e) => { if(e) e.stopPropagation(); document.getElementById('main-menu').classList.toggle('active'); };

  // Элементы контекстных меню
  const contextMenu = document.getElementById('context-menu');
  const widgetContextMenu = document.getElementById('widget-context-menu');
  const iconContextMenu = document.getElementById('icon-context-menu');
  let longPressTimer;
  
  // Закрытие меню при клике вне
  document.addEventListener('click', (e) => { 
      contextMenu.style.display = 'none'; widgetContextMenu.style.display = 'none'; iconContextMenu.style.display = 'none';
      if(!e.target.closest('#taskbar-container') && !e.target.closest('#control-center')) { document.getElementById('main-menu').classList.remove('active'); }
  });

  // Контекстное меню на рабочем столе
  document.addEventListener('contextmenu', (e) => { if (e.target.id === 'desktop' || e.target.id === 'desktop-icons') { e.preventDefault(); showMenuAt(contextMenu, e); } });
  document.addEventListener('touchstart', (e) => { if (e.target.id === 'desktop' || e.target.id === 'desktop-icons') longPressTimer = setTimeout(() => { e.preventDefault(); showMenuAt(contextMenu, e); }, 600); });
  document.addEventListener('touchend', () => clearTimeout(longPressTimer));
  document.addEventListener('touchmove', () => clearTimeout(longPressTimer));

  /**
   * Создать новую папку на рабочем столе
   */
  window.createNewFolder = () => { const name = prompt("Имя новой папки:"); if (!name) return; window.VFS.folders['df_' + Date.now()] = { name: name }; window.VFS.saveFolders(); renderDesktop(); }

  /**
   * Создать ярлык URL на рабочем столе
   */
  window.createUrlShortcut = () => { 
      const name = prompt("Имя ярлыка:"); if(!name) return; const url = prompt("Введите URL:", "https://"); if(!url) return; 
      window.VFS.apps['url_'+Date.now()] = { name, icon: '🌐', type: 'url', url }; window.VFS.saveApps(); renderDesktop(); 
  }

  /**
   * Открыть папку на рабочем столе в отдельном окне
   * @param {string} fId - ID папки
   * @param {string} name - имя папки
   */
  window.openDeskFolder = (fId, name) => { 
      let winId = 'win-folder-' + fId; let w = document.getElementById(winId);
      if(!w) {
          w = document.createElement('div'); w.id = winId; w.className = `window ${window.VFS.config.theme.openAnim}`;
          w.style.cssText = "width:300px; height:350px; top:20%; left:20%; display:flex;";
          w.innerHTML = `<div class="win-header"><span id="title-${winId}">${name}</span><div class="win-controls"><button class="ctrl-btn" onclick="minimizeWindow('${winId}')">_</button><button class="ctrl-btn" onclick="maximizeWindow('${winId}')">□</button><button class="ctrl-btn" style="background:var(--danger)" onclick="closeWindow('${winId}')">✕</button></div></div><div class="win-content" style="padding:0; background:rgba(0,0,0,0.2);"><div id="content-${winId}" class="folder-grid"></div></div>`;
          document.body.appendChild(w); initDrag(w); initResize(w); applySavedSize(w);
          const focusMe = () => { w.style.zIndex = ++highestZ; }; w.addEventListener('mousedown', focusMe, {capture: true}); w.addEventListener('touchstart', focusMe, {passive: true, capture: true});
      }
      const content = document.getElementById(`content-${winId}`); content.innerHTML = ''; const myApps = window.VFS.apps;
      for(let id in myApps) {
          if(myApps[id].deskFolderId === fId) {
             const appIcon = document.createElement('div'); appIcon.className = 'desk-icon'; appIcon.style.position = 'relative';
             appIcon.innerHTML = `<div class="desk-icon-img">${myApps[id].icon}</div><div class="desk-icon-text">${myApps[id].name}</div>`;
             appIcon.onclick = () => { if(myApps[id].type === 'url') window.open(myApps[id].url, '_blank'); else runApp(id, myApps[id]); };
             content.appendChild(appIcon);
          }
      }
      w.style.display = 'flex'; w.style.zIndex = ++highestZ; registerWindow(winId, '📁', name);
  }

  /**
   * Открыть менеджер приложений
   */
  window.openAppManager = async () => {
      const mgrCont = document.getElementById('app-manager-list'); mgrCont.innerHTML = '';
      document.getElementById('mgr-title').innerText = window.VFS.currentUser === 'Admin' ? 'Менеджер (Глобальный)' : 'Менеджер Приложений';
      let appsToRender = [];
      if (window.VFS.currentUser === 'Admin') {
          const allKeys = await window.idb.keys();
          for(let key of allKeys) {
              if(key.startsWith('apps_')) {
                  let owner = key.replace('apps_', ''); let ownerApps = await window.idb.get(key) || {};
                  for(let id in ownerApps) appsToRender.push({ id, owner, app: ownerApps[id] });
              }
          }
      } else {
          for(let id in window.VFS.apps) appsToRender.push({ id, owner: window.VFS.currentUser, app: window.VFS.apps[id] });
      }

      appsToRender.forEach(item => {
          const typeTag = item.app.type === 'url' ? '🌐 Ярлык' : '📦 Прил.';
          const ownerTag = window.VFS.currentUser === 'Admin' ? `<small style="color:var(--accent)"> [${item.owner}]</small>` : '';
          mgrCont.innerHTML += `<div class="list-item"><div>${item.app.icon} <b>${item.app.name}</b> ${ownerTag} <br><small style="opacity:0.5">${typeTag}</small></div><div style="display:flex; gap:5px;">${item.app.type !== 'url' ? `<button class="btn" style="width:auto; padding:5px; margin:0; background:#f39c12" onclick="openAppEditor('${item.id}', '${item.owner}')">✏️ Редакт.</button>` : ''}<button class="btn" style="width:auto; padding:5px 10px; margin:0; background:var(--danger)" onclick="removeApp('${item.id}', '${item.owner}')">🗑</button></div></div>`;
      });
      openWin('win-app-manager');
  }

  /**
   * Удалить приложение
   * @param {string} id - ID приложения
   * @param {string} owner - владелец
   */
  window.removeApp = async (id, owner) => { 
      if(!confirm(`Удалить приложение?`)) return;
      if (owner === window.VFS.currentUser) { delete window.VFS.apps[id]; window.VFS.saveApps(); } 
      else { const targetApps = await window.idb.get(`apps_${owner}`) || {}; delete targetApps[id]; await window.idb.set(`apps_${owner}`, targetApps); }
      openAppManager(); renderDesktop(); notify("Удалено");
  };

  /**
   * Открыть редактор приложения
   * @param {string} id - ID приложения
   * @param {string} owner - владелец
   */
  window.openAppEditor = async (id, owner) => {
      let apps = (owner === window.VFS.currentUser) ? window.VFS.apps : (await window.idb.get(`apps_${owner}`) || {});
      if(!apps[id]) return;
      document.getElementById('edit-id').value = id; document.getElementById('edit-owner').value = owner;
      document.getElementById('edit-icon').value = apps[id].icon; document.getElementById('edit-name').value = apps[id].name;
      document.getElementById('edit-code').value = apps[id].code;
      openWin('win-app-editor');
  }

  /**
   * Сохранить отредактированное приложение
   */
  window.saveEditedApp = async () => {
      const id = document.getElementById('edit-id').value; const owner = document.getElementById('edit-owner').value;
      if (owner === window.VFS.currentUser) {
          window.VFS.apps[id].icon = document.getElementById('edit-icon').value; window.VFS.apps[id].name = document.getElementById('edit-name').value;
          window.VFS.apps[id].code = document.getElementById('edit-code').value; window.VFS.saveApps();
      } else {
          const apps = await window.idb.get(`apps_${owner}`) || {};
          if(apps[id]) { apps[id].icon = document.getElementById('edit-icon').value; apps[id].name = document.getElementById('edit-name').value; apps[id].code = document.getElementById('edit-code').value; await window.idb.set(`apps_${owner}`, apps); }
      }
      notify("Приложение сохранено!", "success"); document.getElementById('win-app-editor').style.display = 'none';
      renderDesktop(); openAppManager();
  }

  // Загрузка приложения через input
  document.getElementById('app-upload').onchange = (e) => {
      const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
      reader.onload = (ev) => { const name = file.name.replace(/\.[^/.]+$/, ""); window.VFS.apps['app_'+Date.now()] = { name, icon: '🚀', type: 'internal', code: ev.target.result, deskFolderId: null }; window.VFS.saveApps(); renderDesktop(); openAppManager(); notify(`Приложение ${name} установлено!`, "success"); };
      reader.readAsText(file); e.target.value = ''; 
  };

  /**
   * Переключение вкладок файлового менеджера
   * @param {string} tab - имя вкладки
   * @param {HTMLElement} el - элемент вкладки
   */
  window.switchFMTab = (tab, el) => { document.querySelectorAll('.fm-tab').forEach(t => t.classList.remove('active')); el.classList.add('active'); currentFMTab = tab; currentFMPath = '/'; renderFM(); }

  /**
   * Отрисовать файловый менеджер согласно текущей вкладке и пути
   */
  window.renderFM = async () => {
      const grid = document.getElementById('fm-grid'); const ctrl = document.getElementById('fm-controls');
      grid.innerHTML = ''; ctrl.innerHTML = '';

      if(currentFMTab === 'docs') {
          ctrl.innerHTML = `${currentFMPath !== '/' ? `<button class="btn" style="width:auto; padding:8px 15px; margin:0;" onclick="fmGoUp()">⬅ Назад</button>` : ''}<button class="btn" style="width:auto; padding:8px 15px; margin:0;" onclick="createNewFile()">📄 Файл</button><button class="btn" style="width:auto; padding:8px 15px; margin:0;" onclick="fmCreateFolder()">📁 Папка</button><span style="align-self:center; margin-left:10px; opacity:0.7">Корневая ${currentFMPath}</span>`;
          let items = [];
          for (let path in window.VFS.files) {
              if (path === currentFMPath) continue;
              if (path.startsWith(currentFMPath)) {
                  let rel = path.slice(currentFMPath.length);
                  if (window.VFS.files[path].type === 'dir') { if (rel.indexOf('/') === rel.length - 1) items.push({name: rel.slice(0, -1), isDir: true}); } 
                  else { if (rel.indexOf('/') === -1) items.push({name: rel, isDir: false}); }
              }
          }
          items.sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name));

          for (let item of items) {
              const icon = document.createElement('div'); icon.className = 'desk-icon'; icon.style.position = 'relative';
              let isDir = item.isDir; let file = item.name;
              icon.innerHTML = `<div class="desk-icon-img" style="font-size:26px; border-radius:8px;">${isDir ? '📁' : '📄'}</div><div class="desk-icon-text" style="color:var(--text);">${file}</div>`;
              icon.draggable = true; icon.ondragstart = e => e.dataTransfer.setData('text/plain', file);

              if(isDir) {
                  icon.ondragover = e => e.preventDefault();
                  icon.ondrop = e => {
                      e.preventDefault(); let dragFileName = e.dataTransfer.getData('text/plain');
                      if(dragFileName && dragFileName !== file) {
                          let isDragDir = window.VFS.files[currentFMPath + dragFileName + '/'] !== undefined;
                          let oldPrefix = currentFMPath + dragFileName + (isDragDir ? '/' : ''); let targetPrefix = currentFMPath + file + '/';
                          for (let k in window.VFS.files) { if (k.startsWith(oldPrefix)) { let newK = targetPrefix + dragFileName + (isDragDir ? '/' : '') + k.slice(oldPrefix.length); window.VFS.files[newK] = window.VFS.files[k]; delete window.VFS.files[k]; } }
                          window.VFS.saveFiles(); renderFM(); notify("Перемещено", "success");
                      }
                  }
                  icon.onclick = () => { currentFMPath += file + '/'; renderFM(); };
              } else icon.onclick = () => openNotepad(file, currentFMPath);

              icon.oncontextmenu = e => {
                  e.preventDefault(); e.stopPropagation(); let cm = document.getElementById('icon-context-menu');
                  cm.innerHTML = `${!isDir ? `<div class="cm-item" onclick="openNotepad('${file}', '${currentFMPath}')">🚀 Открыть</div>` : `<div class="cm-item" onclick="currentFMPath += '${file}/'; renderFM();">🚀 Открыть</div>`}${!isDir ? `<div class="cm-item" onclick="downloadFile('${file}')">⬇ Скачать</div>` : ''}<div class="cm-item" style="color:var(--danger)" onclick="deleteFile('${file}', ${isDir})">🗑 Удалить</div>`;
                  showMenuAt(cm, e);
              };
              grid.appendChild(icon);
          }

      } else if (currentFMTab === 'system') {
          ctrl.innerHTML = `<span style="opacity:0.7">Установленные приложения</span>`;
          for(let id in window.VFS.apps) { const icon = document.createElement('div'); icon.className = 'desk-icon'; icon.style.position = 'relative'; icon.innerHTML = `<div class="desk-icon-img">${window.VFS.apps[id].icon}</div><div class="desk-icon-text">${window.VFS.apps[id].name}</div>`; icon.onclick = () => openAppEditor(id, window.VFS.currentUser); grid.appendChild(icon); }
      } else if (currentFMTab === 'desktop') {
          ctrl.innerHTML = `<span style="opacity:0.7">Ярлыки и папки рабочего стола</span>`;
          for(let fId in window.VFS.folders) { const icon = document.createElement('div'); icon.className = 'desk-icon'; icon.style.position = 'relative'; icon.innerHTML = `<div class="desk-icon-img">📁</div><div class="desk-icon-text">${window.VFS.folders[fId].name}</div>`; icon.onclick = () => openDeskFolder(fId, window.VFS.folders[fId].name); grid.appendChild(icon); }
          for(let id in window.VFS.apps) { if(!window.VFS.apps[id].deskFolderId) { const icon = document.createElement('div'); icon.className = 'desk-icon'; icon.style.position = 'relative'; icon.innerHTML = `<div class="desk-icon-img">${window.VFS.apps[id].icon}</div><div class="desk-icon-text">${window.VFS.apps[id].name}</div>`; icon.onclick = () => { if(window.VFS.apps[id].type === 'url') window.open(window.VFS.apps[id].url, '_blank'); else runApp(id, window.VFS.apps[id]); }; grid.appendChild(icon); } }
      } else if (currentFMTab === 'backup') {
          ctrl.innerHTML = `<button class="btn" style="width:auto; padding:8px 15px; margin:0; background:#2ecc71;" onclick="downloadBackup()">⬇ Скачать бэкап ОС (JSON)</button><button class="btn" style="width:auto; padding:8px 15px; margin:0;" onclick="document.getElementById('backup-upload').click()">⬆ Загрузить бэкап</button>`;
          grid.innerHTML = `<div style="color:var(--text); opacity:0.8; padding:10px;">Файл бэкапа содержит настройки ОС, все установленные приложения и личные файлы благодаря переходу на единую базу данных IndexedDB.</div>`;
      }
  };

  /**
   * Перейти на уровень выше в файловом менеджере
   */
  window.fmGoUp = () => { let parts = currentFMPath.split('/').filter(p => p); parts.pop(); currentFMPath = parts.length > 0 ? '/' + parts.join('/') + '/' : '/'; renderFM(); }
  
  /**
   * Создать новую папку в текущем каталоге ФМ
   */
  window.fmCreateFolder = () => { const name = prompt("Имя папки:"); if(!name) return; const safeName = name.replace(/\//g, ''); const newPath = currentFMPath + safeName + '/'; window.VFS.files[newPath] = { type: 'dir' }; window.VFS.saveFiles(); renderFM(); }
  
  /**
   * Скачать файл из ФМ
   * @param {string} fileName 
   */
  window.downloadFile = (fileName) => { const fullPath = currentFMPath + fileName; if (window.VFS.files[fullPath]) { const blob = new Blob([window.VFS.files[fullPath].content || ''], {type: 'text/plain'}); let a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click(); } else notify("Ошибка скачивания: Файл не найден", "error"); }
  
  /**
   * Скачать полный бэкап системы (все данные IndexedDB)
   */
  window.downloadBackup = async () => {
      const allKeys = await window.idb.keys(); const backupData = {};
      for(let key of allKeys) { backupData[key] = await window.idb.get(key); }
      const blob = new Blob([JSON.stringify(backupData)], {type: 'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'websaos_system_backup.json'; a.click();
  }

  // Загрузка бэкапа из файла
  document.getElementById('backup-upload').onchange = (e) => {
      const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
      reader.onload = async (ev) => { try { let data = JSON.parse(ev.target.result); for(let k in data) await window.idb.set(k, data[k]); notify("Бэкап системы успешно восстановлен! Перезагрузка...", "success"); setTimeout(()=>location.reload(), 2000); } catch(err) { notify("Ошибка файла бэкапа", "error"); } };
      reader.readAsText(file); e.target.value = '';
  }

  /**
   * Создать новый текстовый файл в текущем каталоге ФМ
   */
  window.createNewFile = () => { const name = prompt("Введите имя файла:"); if(!name) return; const safeName = name.replace(/\//g, ''); const fname = safeName.endsWith('.txt') ? safeName : safeName + '.txt'; const newPath = currentFMPath + fname; window.VFS.files[newPath] = { type: 'file', content: '' }; window.VFS.saveFiles(); renderFM(); notify("Файл создан", "success"); }
  
  /**
   * Удалить файл или папку в ФМ
   * @param {string} name 
   * @param {boolean} isDir 
   */
  window.deleteFile = (name, isDir) => { if(!confirm(`Удалить ${name}?`)) return; const pathToDelete = currentFMPath + name + (isDir ? '/' : ''); for (let k in window.VFS.files) { if (k.startsWith(pathToDelete)) delete window.VFS.files[k]; } window.VFS.saveFiles(); renderFM(); notify("Удалено"); document.getElementById('icon-context-menu').style.display = 'none'; }

  /**
   * Открыть блокнот для редактирования файла
   * @param {string} fileName - имя файла (если новый, то пусто)
   * @param {string} path - путь к файлу
   */
  window.openNotepad = (fileName = "", path = "") => {
      let content = '';
      if (fileName) { const fullPath = (path || currentFMPath) + fileName; if (window.VFS.files[fullPath]) content = window.VFS.files[fullPath].content || ''; }
      document.getElementById('icon-context-menu').style.display = 'none';
      document.getElementById('np-title').innerText = fileName ? `Блокнот - ${fileName}` : 'Блокнот (Новый файл)';
      document.getElementById('np-filename').value = fileName; document.getElementById('np-filename').dataset.path = path || currentFMPath;
      document.getElementById('np-text').value = content; openWin('win-notepad');
  }

  /**
   * Сохранить содержимое блокнота в файл
   */
  window.saveNotepad = () => {
      let fileName = document.getElementById('np-filename').value.trim();
      if(!fileName) { fileName = prompt("Укажите имя для сохранения файла:"); if(!fileName) return; fileName = fileName.replace(/\//g, ''); fileName = fileName.endsWith('.txt') ? fileName : fileName + '.txt'; document.getElementById('np-filename').value = fileName; document.getElementById('np-title').innerText = `Блокнот - ${fileName}`; }
      let path = document.getElementById('np-filename').dataset.path || currentFMPath; const fullPath = path + fileName;
      if (!window.VFS.files[fullPath]) window.VFS.files[fullPath] = { type: 'file', content: '' };
      window.VFS.files[fullPath].content = document.getElementById('np-text').value; window.VFS.saveFiles();
      notify("Файл успешно сохранен", "success"); if(currentFMTab === 'docs') renderFM(); 
  }

  /**
   * Выполнить команду в терминале (ввод с клавиатуры)
   * @param {HTMLInputElement} el - поле ввода
   */
  window.runTermCmd = (el) => {
      const val = el.value.trim(); if(!val) return; const out = document.getElementById('term-output');
      out.innerHTML += `<div class="term-line"><span style="color:#2ecc71;">root@os:~$</span> <span style="color:#fff;">${val}</span></div>`;
      el.value = ''; let response = '';
      if(val === 'clear') { out.innerHTML = ''; return; } else if(val === 'help') { response = "Для изменения CSS переменных: --имя_переменной = значение\nВыполнение JS (API ОС): просто введите код."; } 
      else {
          let cssMatch = val.match(/^(--[a-zA-Z0-9_-]+)\s*=\s*(.*)$/);
          if(cssMatch) { changeCssVar(cssMatch[1], cssMatch[2]); response = `[OK] CSS-переменная ${cssMatch[1]} установлена в ${cssMatch[2]}`; } 
          else { try { let res = eval(val); if(val.includes('VFS.config.') || val.includes('dockSettings') || val.includes('VFS.files')) saveProfile(); response = res !== undefined ? String(res) : '[OK] Команда выполнена'; } catch(e) { response = `<span style="color:#f44;">Ошибка: ${e.message}</span>`; } }
      }
      out.innerHTML += `<div class="term-line" style="color:#aaa; margin-bottom: 8px;">${response}</div>`; out.scrollTop = out.scrollHeight;
  };

  /**
   * Зарегистрировать окно в виджете окон
   * @param {string} id 
   * @param {string} icon 
   * @param {string} title 
   */
  function registerWindow(id, icon, title) {
      if(!windowInstances.find(w => w.id === id)) { windowInstances.push({ id, icon, title, state: 'open' }); renderWindowWidget(); }
      let winObj = windowInstances.find(w => w.id === id); if(winObj) winObj.state = 'open'; renderWindowWidget();
  }

  /**
   * Свернуть окно
   * @param {string} id 
   */
  window.minimizeWindow = (id) => { const w = document.getElementById(id); if(!w) return; w.style.display = 'none'; let winObj = windowInstances.find(x => x.id === id); if(winObj) winObj.state = 'minimized'; renderWindowWidget(); }

  /**
   * Развернуть окно на весь экран (максимизировать)
   * @param {string} id 
   */
  window.maximizeWindow = (id) => { const w = document.getElementById(id); if(!w) return; w.classList.toggle('fullscreen'); w.style.zIndex = ++highestZ; if(w.classList.contains('fullscreen')) { w.style.left = '0'; w.style.top = '0'; w.style.width = '100vw'; w.style.height = '100vh'; } }

  /**
   * Закрыть окно
   * @param {string} id 
   * @param {boolean} skipConfirm - пропустить подтверждение
   */
  window.closeWindow = (id, skipConfirm = false) => {
      if(!skipConfirm && window.VFS.config.dockSettings.confirm) { if(!confirm("Уверены, что хотите закрыть это окно?")) return; }
      const w = document.getElementById(id); if(w) { if(w.id.startsWith('run-') || w.id.startsWith('win-folder-')) w.remove(); else w.style.display = 'none'; }
      windowInstances = windowInstances.filter(win => win.id !== id); renderWindowWidget();
  }

  /**
   * Переключить состояние окна (развернуть/свернуть)
   * @param {string} id 
   */
  window.toggleWindowState = (id) => {
      const w = document.getElementById(id); let winObj = windowInstances.find(x => x.id === id); if(!w || !winObj) return;
      if(winObj.state === 'minimized') { w.style.display = 'flex'; w.style.zIndex = ++highestZ; winObj.state = 'open'; } else { w.style.display = 'none'; winObj.state = 'minimized'; }
      renderWindowWidget();
  }

  /**
   * Отрисовать виджет окон (док)
   */
  window.renderWindowWidget = () => {
      const cont = document.getElementById('ww-icons-container'); cont.innerHTML = '';
      windowInstances.forEach((win, index) => {
          const iconEl = document.createElement('div'); iconEl.className = `ww-icon ${win.state === 'minimized' ? 'minimized' : ''}`;
          iconEl.innerHTML = `${win.icon} ${win.state === 'open' ? '<div class="ww-indicator"></div>' : ''}`;
          iconEl.title = win.title; iconEl.draggable = true; iconEl.onclick = () => toggleWindowState(win.id);
          const openCtx = (e) => { e.preventDefault(); e.stopPropagation(); document.getElementById('wcm-max').onclick = () => { maximizeWindow(win.id); widgetContextMenu.style.display='none'; }; document.getElementById('wcm-close').onclick = () => { closeWindow(win.id); widgetContextMenu.style.display='none'; }; showMenuAt(widgetContextMenu, e); };
          iconEl.oncontextmenu = openCtx; let pressTimer; iconEl.ontouchstart = (e) => { pressTimer = setTimeout(() => openCtx(e), 600); }; iconEl.ontouchend = iconEl.ontouchcancel = () => clearTimeout(pressTimer);
          iconEl.ondragstart = (e) => { e.dataTransfer.setData('text/plain', index); iconEl.classList.add('dragging'); }; iconEl.ondragend = () => { iconEl.classList.remove('dragging'); }; iconEl.ondragover = (e) => { e.preventDefault(); };
          iconEl.ondrop = (e) => { e.preventDefault(); const fromIdx = parseInt(e.dataTransfer.getData('text/plain')); const toIdx = index; if(fromIdx !== toIdx) { const moved = windowInstances.splice(fromIdx, 1)[0]; windowInstances.splice(toIdx, 0, moved); renderWindowWidget(); } };
          cont.appendChild(iconEl);
      });
  }

  /**
   * Преобразовать hex в rgb строку
   * @param {string} hex 
   * @returns {string}
   */
  function hexToRgb(hex) { let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '22, 31, 41'; }

  /**
   * Обновить настройки дока (виджета окон)
   */
  window.updateWWSettings = () => {
      const bgHex = document.getElementById('ww-set-bg').value; const op = document.getElementById('ww-set-op').value;
      const border = document.getElementById('ww-set-border').value; const confirm = document.getElementById('ww-set-confirm').checked;
      window.VFS.config.dockSettings = { bg: bgHex, op: op, border: border, confirm: confirm };
      document.getElementById('lbl-ww-op').innerText = op; saveProfile(); applyWWSettingsUI();
  }

  /**
   * Применить UI настроек дока
   */
  function applyWWSettingsUI() {
      const s = window.VFS.config.dockSettings; const rgb = hexToRgb(s.bg);
      document.documentElement.style.setProperty('--ww-bg', `rgba(${rgb}, ${s.op})`); document.documentElement.style.setProperty('--ww-border', s.border);
      const dock = document.getElementById('windows-widget');
      if(window.VFS.config.dockPos && window.VFS.config.dockPos.x) { dock.style.left = window.VFS.config.dockPos.x; dock.style.top = window.VFS.config.dockPos.y; dock.style.transform = 'none'; } 
      else { dock.style.left = '50%'; dock.style.top = '20px'; dock.style.transform = 'translateX(-50%)'; }
      if(document.getElementById('ww-set-bg')) { document.getElementById('ww-set-bg').value = s.bg; document.getElementById('ww-set-op').value = s.op; document.getElementById('lbl-ww-op').innerText = s.op; document.getElementById('ww-set-border').value = s.border; document.getElementById('ww-set-confirm').checked = s.confirm; }
  }

  /**
   * Инициализация перетаскивания дока
   * @param {HTMLElement} w - элемент виджета
   */
  function initDockDrag(w) {
      const handle = w.querySelector('.ww-drag-handle');
      handle.onmousedown = handle.ontouchstart = e => {
          let sX = (e.clientX||e.touches[0].clientX) - w.offsetLeft, sY = (e.clientY||e.touches[0].clientY) - w.offsetTop;
          document.onmousemove = document.ontouchmove = ev => { w.style.left = (ev.clientX||ev.touches[0].clientX) - sX + 'px'; w.style.top = (ev.clientY||ev.touches[0].clientY) - sY + 'px'; w.style.transform = 'none'; };
          document.onmouseup = document.ontouchend = () => { document.onmousemove = document.ontouchmove = null; window.VFS.config.dockPos = { x: w.style.left, y: w.style.top }; saveProfile(); };
      };
  }

  /**
   * Действие для контекстного меню иконки рабочего стола
   * @param {string} action 
   * @param {string} id 
   * @param {string|null} folderId 
   */
  window.desktopIconAction = (action, id, folderId = null) => {
      document.getElementById('icon-context-menu').style.display = 'none';
      if(action === 'open') { if(window.VFS.apps[id].type === 'url') window.open(window.VFS.apps[id].url, '_blank'); else runApp(id, window.VFS.apps[id]); } 
      else if (action === 'delete') { removeApp(id, window.VFS.currentUser); } 
      else if (action === 'move') { window.VFS.apps[id].deskFolderId = folderId; window.VFS.saveApps(); notify(folderId ? "Перемещено в папку" : "Перемещено на рабочий стол", "success"); renderDesktop(); }
  };

  /**
   * Показать контекстное меню для иконки рабочего стола
   * @param {Event} e 
   * @param {string} id 
   * @param {object} app 
   */
  const showIconContextMenu = (e, id, app) => {
      e.preventDefault(); e.stopPropagation(); const menu = document.getElementById('icon-context-menu');
      let html = `<div class="cm-item" onclick="desktopIconAction('open', '${id}')">🚀 Открыть</div><div class="cm-item" style="color:var(--danger)" onclick="desktopIconAction('delete', '${id}')">🗑 Удалить</div><hr style="border-color:rgba(128,128,128,0.2); margin: 5px 0;"><div style="padding: 5px 15px; font-size:10px; opacity:0.6;">Переместить в:</div>`;
      let hasFolders = false; for(let fId in window.VFS.folders) { if (app.deskFolderId !== fId) { hasFolders = true; html += `<div class="cm-item" onclick="desktopIconAction('move', '${id}', '${fId}')">📁 ${window.VFS.folders[fId].name}</div>`; } }
      if(app.deskFolderId) { html += `<div class="cm-item" onclick="desktopIconAction('move', '${id}', null)">🖥 На рабочий стол</div>`; } else if(!hasFolders) { html += `<div style="padding: 5px 15px; font-size:10px; opacity:0.6;">(Нет других папок)</div>`; }
      menu.innerHTML = html; showMenuAt(menu, e);
  };

  /**
   * Сделать иконку рабочего стола перетаскиваемой, восстановить позицию
   * @param {HTMLElement} icon 
   * @param {string} id 
   * @param {boolean} isFolder 
   */
  function makeIconDraggable(icon, id, isFolder = false) {
      if(window.VFS.config.iconPos && window.VFS.config.iconPos[id]) { icon.style.left = window.VFS.config.iconPos[id].x + 'px'; icon.style.top = window.VFS.config.iconPos[id].y + 'px'; }
      icon.onmousedown = icon.ontouchstart = (e) => {
          if(e.button === 2 || e.target.closest('[title]')) return;
          let sX = (e.clientX||e.touches[0].clientX) - icon.offsetLeft; let sY = (e.clientY||e.touches[0].clientY) - icon.offsetTop; let dragged = false;
          let moveHandler = (ev) => { dragged = true; icon.classList.add('dragging'); icon.style.left = (ev.clientX||ev.touches[0].clientX) - sX + 'px'; icon.style.top = (ev.clientY||ev.touches[0].clientY) - sY + 'px'; };
          let upHandler = () => { document.removeEventListener('mousemove', moveHandler); document.removeEventListener('touchmove', moveHandler); document.removeEventListener('mouseup', upHandler); document.removeEventListener('touchend', upHandler); icon.classList.remove('dragging'); if(dragged) { window.VFS.config.iconPos[id] = {x: parseInt(icon.style.left), y: parseInt(icon.style.top)}; saveProfile(); } };
          document.addEventListener('mousemove', moveHandler); document.addEventListener('touchmove', moveHandler); document.addEventListener('mouseup', upHandler); document.addEventListener('touchend', upHandler);
      }
  }

  /**
   * Отрисовать рабочий стол (иконки приложений и папок)
   */
  window.renderDesktop = () => {
    const deskCont = document.getElementById('desktop-icons'); deskCont.innerHTML = ''; 
    for(let fId in window.VFS.folders) {
        const folderIcon = document.createElement('div'); folderIcon.className = 'desk-icon';
        folderIcon.innerHTML = `<div onclick="renameDesktopFolder('${fId}', event)" title="Переименовать" style="position:absolute; top:-5px; left:-5px; width:20px; height:20px; background:#f39c12; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer; z-index:5;">✏️</div><div onclick="deleteDesktopFolder('${fId}', event)" title="Удалить" style="position:absolute; top:-5px; left:18px; width:20px; height:20px; background:var(--danger); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer; z-index:5;">🗑</div><div class="desk-icon-img">📁</div><div class="desk-icon-text">${window.VFS.folders[fId].name}</div>`;
        folderIcon.onclick = (e) => { if(e.target.classList.contains('desk-icon-img') || e.target.classList.contains('desk-icon-text') || e.target.classList.contains('desk-icon')) openDeskFolder(fId, window.VFS.folders[fId].name); }
        makeIconDraggable(folderIcon, fId, true); deskCont.appendChild(folderIcon);
    }
    for(let id in window.VFS.apps) {
      if (!window.VFS.apps[id].deskFolderId) {
          const appIcon = document.createElement('div'); appIcon.className = 'desk-icon';
          appIcon.innerHTML = `<div class="desk-icon-img">${window.VFS.apps[id].icon}</div><div class="desk-icon-text">${window.VFS.apps[id].name}</div>`;
          appIcon.oncontextmenu = (e) => showIconContextMenu(e, id, window.VFS.apps[id]);
          let pressTimer; appIcon.ontouchstart = (e) => { pressTimer = setTimeout(() => showIconContextMenu(e, id, window.VFS.apps[id]), 600); }; appIcon.ontouchend = appIcon.ontouchcancel = () => clearTimeout(pressTimer);
          appIcon.onclick = (e) => { if(document.getElementById('icon-context-menu').style.display !== 'flex') { if (window.VFS.apps[id].type === 'url') window.open(window.VFS.apps[id].url, '_blank'); else runApp(id, window.VFS.apps[id]); } };
          makeIconDraggable(appIcon, id); deskCont.appendChild(appIcon);
      }
    }
  };

  /**
   * Запустить приложение (в iframe)
   * @param {string} id 
   * @param {object} app 
   */
  window.runApp = (id, app) => { 
      let w = document.getElementById('run-'+id); 
      if(!w){ 
          w = document.createElement('div'); w.id = 'run-'+id; w.className = `window ${window.VFS.config.theme.openAnim}`; 
          w.style.cssText = "width:80%;height:60%;top:20%;left:10%;display:flex;"; 
          w.innerHTML = `<div class="win-header"><span>${app.icon} ${app.name}</span><div class="win-controls"><button class="ctrl-btn" onclick="minimizeWindow('run-${id}')">_</button><button class="ctrl-btn" onclick="maximizeWindow('run-${id}')">□</button><button class="ctrl-btn" style="background:var(--danger);" onclick="closeWindow('run-${id}')">✕</button></div></div><div class="win-content" style="padding:0; position:relative;"><iframe id="frame-${id}" style="width:100%;height:100%;border:none;background:#fff;" sandbox="allow-scripts allow-same-origin"></iframe></div>`; 
          document.body.appendChild(w); document.getElementById('frame-'+id).srcdoc = app.code;
          initDrag(w); initResize(w); applySavedSize(w);
          const focusMe = () => { w.style.zIndex = ++highestZ; }; w.addEventListener('mousedown', focusMe, {capture: true}); w.addEventListener('touchstart', focusMe, {passive: true, capture: true});
      } 
      w.className = `window ${window.VFS.config.theme.openAnim}`; w.style.display = 'flex'; w.style.zIndex = ++highestZ; 
      document.getElementById('main-menu').classList.remove('active'); registerWindow(w.id, app.icon, app.name);
  }

  /**
   * Применить сохранённый размер окна
   * @param {HTMLElement} w 
   */
  window.applySavedSize = (w) => { if(window.VFS.config.winSizes && window.VFS.config.winSizes[w.id]) { w.style.width = window.VFS.config.winSizes[w.id].w; w.style.height = window.VFS.config.winSizes[w.id].h; } }

  /**
   * Открыть стандартное окно по ID (Настройки, Терминал и т.д.)
   * @param {string} id 
   */
  window.openWin = id => { 
      const w=document.getElementById(id); w.className = `window ${window.VFS.config.theme.openAnim}`; applySavedSize(w); 
      w.style.display='flex'; w.style.zIndex=++highestZ; document.getElementById('main-menu').classList.remove('active'); 
      let icon = '⚙️', title = 'Окно';
      if(id === 'win-app-manager') { icon = '📦'; title = 'Менеджер'; } if(id === 'win-app-editor') { icon = '✏️'; title = 'Редактор'; }
      if(id === 'win-settings') { icon = '⚙️'; title = 'Настройки ОС'; } if(id === 'win-ww-settings') { icon = '🎛'; title = 'Настройки дока'; }
      if(id === 'win-terminal') { icon = '🔲'; title = 'Терминал'; setTimeout(()=>document.getElementById('term-input').focus(), 100); }
      if(id === 'win-file-manager') { icon = '📁'; title = 'Файлы'; renderFM(); } if(id === 'win-notepad') { icon = '📝'; title = document.getElementById('np-title').innerText || 'Блокнот'; }
      registerWindow(id, icon, title);
  };

  /**
   * Загрузить настройки виджета
   * @param {string} wId 
   */
  window.loadWidgetSettings = (wId) => { let state = window.VFS.config; if (!state.widgets) return; if (!state.widgets[wId]) state.widgets[wId] = { visible: true, top: false }; document.getElementById('widget-visible').checked = state.widgets[wId].visible; document.getElementById('widget-top').checked = state.widgets[wId].top; };
  
  /**
   * Обновить настройки виджета
   */
  window.updateWidgetSettings = () => { const wId = document.getElementById('sel-widget').value; const visible = document.getElementById('widget-visible').checked; const top = document.getElementById('widget-top').checked; window.VFS.config.widgets[wId] = { visible, top }; saveProfile(); applyWidgetSettingsToDOM(); };
  
  /**
   * Применить настройки видимости виджетов
   */
  window.applyWidgetSettingsToDOM = () => { let state = window.VFS.config; if (!state.widgets) return; for (let wId in state.widgets) { const el = document.getElementById(wId); if (el) { el.style.display = state.widgets[wId].visible ? ((wId === 'windows-widget' || wId === 'clock-widget' || wId === 'storage-widget') ? 'flex' : 'block') : 'none'; el.style.zIndex = state.widgets[wId].top ? '9999999' : '50'; } } };

  // ========== ОБНОВЛЕННАЯ ФУНКЦИЯ ПРИМЕНЕНИЯ ТЕМЫ ==========
  /**
   * Применить готовый пресет темы (меняет CSS-класс, иконку Пуск, фон, переменные и настройки)
   * @param {string} themeId - идентификатор темы из window.Themes
   */
  window.applyThemePreset = (themeId) => {
      if (!themeId || !window.Themes || !window.Themes[themeId]) return;
      const theme = window.Themes[themeId];

      // 1. Применяем структурный CSS-класс
      document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
      if(theme.cssClass) {
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
          changeCssVar(key, theme.vars[key]);
          if(key === '--win-opacity' && document.getElementById('cc-opacity')) {
              document.getElementById('cc-opacity').value = theme.vars[key];
              document.getElementById('lbl-op').innerText = theme.vars[key];
          }
          if(key === '--glass-blur' && document.getElementById('cc-glass')) {
              let v = parseInt(theme.vars[key]);
              document.getElementById('cc-glass').value = v;
              document.getElementById('lbl-gbl').innerText = theme.vars[key];
          }
          if(key === '--win-border' && document.getElementById('cc-border')) document.getElementById('cc-border').value = theme.vars[key];
          if(key === '--accent' && document.getElementById('cc-accent')) document.getElementById('cc-accent').value = theme.vars[key];
      }

      // 5. Меняем положение элементов управления
      if (theme.settings) {
          if (theme.settings.winCtrlPos) {
              document.getElementById('sel-win-ctrl-pos').value = theme.settings.winCtrlPos;
              changeWinCtrlPos(theme.settings.winCtrlPos);
          }
          if (theme.settings.taskbarPos) {
              document.getElementById('sel-taskbar-pos').value = theme.settings.taskbarPos;
              changeTaskbarPos(theme.settings.taskbarPos);
          }
          if (theme.settings.isLightMode !== undefined) {
              document.getElementById('cc-theme-mode').checked = theme.settings.isLightMode;
              toggleLightMode(theme.settings.isLightMode);
          }
      }
      
      loadRadiiUI(); 
      saveProfile();
      notify(`Тема "${theme.name}" применена!`, "success");
  };

  // Ниже идут вспомогательные функции для настроек и интерфейса

  /**
   * Изменить положение кнопок управления окном (слева/справа)
   * @param {string} val - 'left' или 'right'
   */
  window.changeWinCtrlPos = (val) => { window.VFS.config.theme.winCtrlPos = val; document.body.setAttribute('data-ctrl-pos', val); saveProfile(); };
  
  /**
   * Изменить положение панели задач (горизонтально/вертикально)
   * @param {string} val 
   */
  window.changeTaskbarPos = (val) => { window.VFS.config.theme.taskbarPos = val; document.body.setAttribute('data-taskbar-pos', val); saveProfile(); };
  
  /**
   * Обновить настройку прилипания окон
   */
  window.updateSnapping = () => { window.VFS.config.theme.snapWindows = document.getElementById('cc-snap-windows').checked; saveProfile(); };
  
  /**
   * Изменить CSS-переменную и сохранить в конфиг
   * @param {string} variable 
   * @param {string} value 
   * @param {string} labelId - опционально ID элемента для отображения значения
   */
  window.changeCssVar = (variable, value, labelId) => { document.documentElement.style.setProperty(variable, value); if(labelId) document.getElementById(labelId).innerText = value.replace('px', ''); window.VFS.config.theme[variable] = value; saveProfile(); }
  
  /**
   * Переключить светлую/тёмную тему
   * @param {boolean} isLight 
   */
  window.toggleLightMode = (isLight) => { changeCssVar('--win-bg-rgb', isLight ? '240, 245, 250' : '22, 31, 41'); changeCssVar('--text', isLight ? '#1a1a1a' : '#e6eef8'); window.VFS.config.theme['isLightMode'] = isLight; saveProfile(); }
  
  /**
   * Изменить анимацию открытия или перемещения окон
   * @param {string} type - 'open' или 'move'
   * @param {string} val - имя анимации
   */
  window.changeAnim = (type, val) => { if(type === 'open') window.VFS.config.theme.openAnim = val; if(type === 'move') window.VFS.config.theme.moveAnim = val; saveProfile(); }

  /**
   * Обновить радиусы скругления для выбранного элемента
   */
  window.updateRadii = () => { const target = document.getElementById('sel-radius-target').value; const val = `${document.getElementById('r-tl').value}px ${document.getElementById('r-tr').value}px ${document.getElementById('r-br').value}px ${document.getElementById('r-bl').value}px`; changeCssVar(target, val); }
  
  /**
   * Загрузить значения радиусов в UI
   */
  window.loadRadiiUI = () => { const target = document.getElementById('sel-radius-target').value; let val = window.VFS.config.theme[target] || defaultVars[target]; let parts = val.replace(/px/g, '').split(' '); if(parts.length === 4) { document.getElementById('r-tl').value = parts[0]; document.getElementById('r-tr').value = parts[1]; document.getElementById('r-br').value = parts[2]; document.getElementById('r-bl').value = parts[3]; } }

  /**
   * Применить все настройки из конфига к DOM (фоны, переменные, анимации)
   */
  function applySettings() {
    let state = window.VFS.config; document.getElementById('desktop').style.backgroundImage = state.bgValue ? `url(${state.bgValue})` : 'none';
    if(state.theme) {
        for(let key in state.theme) {
            if(['isLightMode', 'openAnim', 'moveAnim', 'winCtrlPos', 'taskbarPos', 'snapWindows'].includes(key)) continue;
            document.documentElement.style.setProperty(key, state.theme[key]);
            if(document.getElementById('cc-border') && key==='--win-border') document.getElementById('cc-border').value = state.theme[key];
            if(document.getElementById('cc-accent') && key==='--accent') document.getElementById('cc-accent').value = state.theme[key];
            if(key === '--win-opacity') { document.getElementById('cc-opacity').value = state.theme[key]; document.getElementById('lbl-op').innerText = state.theme[key]; }
            if(key === '--glass-blur') { document.getElementById('cc-glass').value = parseInt(state.theme[key]); document.getElementById('lbl-gbl').innerText = state.theme[key]; }
            if(key === '--blur') { document.getElementById('cc-bg-blur').value = parseInt(state.theme[key]); document.getElementById('lbl-bl').innerText = state.theme[key]; }
            if(key === '--shadow-op') { document.getElementById('cc-shadow').value = state.theme[key]; document.getElementById('lbl-shd').innerText = state.theme[key]; }
        }
        document.getElementById('cc-theme-mode').checked = state.theme['isLightMode'] || false; document.getElementById('cc-snap-windows').checked = state.theme.snapWindows !== false;
        document.getElementById('sel-anim-open').value = state.theme.openAnim || 'anim-fade'; document.getElementById('sel-anim-move').value = state.theme.moveAnim || 'move-none';
        document.getElementById('sel-win-ctrl-pos').value = state.theme.winCtrlPos || 'right'; document.body.setAttribute('data-ctrl-pos', state.theme.winCtrlPos || 'right');
        document.getElementById('sel-taskbar-pos').value = state.theme.taskbarPos || 'horizontal'; document.body.setAttribute('data-taskbar-pos', state.theme.taskbarPos || 'horizontal');
    } 
  }

  /**
   * Применить позицию виджета часов из конфига и запустить таймер
   */
  function applyWidgetState() { const w = document.getElementById('clock-widget'); w.style.left = window.VFS.config.widgetPos.x + 'px'; w.style.top = window.VFS.config.widgetPos.y + 'px'; tickClock(); }
  
  /**
   * Обновить время на виджете часов
   */
  function tickClock() { const now = new Date(); document.getElementById('clock-time').innerText = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0'); document.getElementById('clock-date').innerText = now.toLocaleDateString('ru'); }
  
  /**
   * Инициализировать перетаскивание виджета часов
   * @param {HTMLElement} w 
   */
  function initWidgetDrag(w) { w.onmousedown = w.ontouchstart = e => { let sX = (e.clientX||e.touches[0].clientX) - w.offsetLeft, sY = (e.clientY||e.touches[0].clientY) - w.offsetTop; document.onmousemove = document.ontouchmove = ev => { w.style.left = (ev.clientX||ev.touches[0].clientX) - sX + 'px'; w.style.top = (ev.clientY||ev.touches[0].clientY) - sY + 'px'; }; document.onmouseup = document.ontouchend = () => { document.onmousemove = document.ontouchmove = null; window.VFS.config.widgetPos = {x: parseInt(w.style.left), y: parseInt(w.style.top)}; saveProfile(); }; }; }

  /**
   * Инициализировать перетаскивание окна (с эффектами и прилипанием)
   * @param {HTMLElement} w - окно
   */
  function initDrag(w) { 
      const h = w.querySelector('.win-header'); if(!h) return; 
      h.onmousedown = h.ontouchstart = e => { 
          if(e.target.tagName === 'BUTTON' || e.target.closest('.win-controls') || e.target.tagName === 'INPUT') return; 
          w.style.zIndex = ++highestZ; w.classList.remove('fullscreen');
          let startX = e.clientX||e.touches[0].clientX, startY = e.clientY||e.touches[0].clientY; 

          if (w.dataset.snapped === 'true') {
              w.dataset.snapped = 'false'; w.classList.remove('snapped');
              if(w.dataset.preSnapW) w.style.width = w.dataset.preSnapW; if(w.dataset.preSnapH) w.style.height = w.dataset.preSnapH;
              w.style.left = (startX - (w.offsetWidth / 2)) + 'px';
          }
          let offX = startX - w.offsetLeft, offY = startY - w.offsetTop; 
          if (w.dataset.snapped !== 'true') { w.dataset.preSnapW = w.style.width || w.offsetWidth + 'px'; w.dataset.preSnapH = w.style.height || w.offsetHeight + 'px'; }

          let anim = window.VFS.config.theme.moveAnim || 'move-none'; const hl = document.getElementById('snap-highlight'); const snapOn = window.VFS.config.theme.snapWindows !== false; let snapZone = ''; 
          
          const iframe = w.querySelector('iframe'); if(iframe) iframe.style.pointerEvents = 'none';
          if(anim === 'move-scale') w.style.transform = `scale(0.95)`; else if(anim === 'move-ghost') w.style.opacity = '0.6';

          document.onmousemove = document.ontouchmove = ev => { 
              let currX = ev.clientX||ev.touches[0].clientX, currY = ev.clientY||ev.touches[0].clientY; 
              let dx = currX - startX, dy = currY - startY; startX = currX; startY = currY;

              w.style.left = Math.max(0, Math.min(window.innerWidth - 50, currX - offX)) + 'px'; 
              w.style.top = Math.max(0, Math.min(window.innerHeight - 50, currY - offY)) + 'px'; 
              let ww = window.innerWidth, wh = window.innerHeight, edge = 20;

              if (snapOn) {
                  snapZone = ''; hl.style.display = 'block';
                  if(currX < edge && currY < edge) { snapZone = 'tl'; hl.style.left='0'; hl.style.top='0'; hl.style.width='50vw'; hl.style.height='50vh'; }
                  else if(currX > ww-edge && currY < edge) { snapZone = 'tr'; hl.style.left='50vw'; hl.style.top='0'; hl.style.width='50vw'; hl.style.height='50vh'; }
                  else if(currX < edge && currY > wh-edge) { snapZone = 'bl'; hl.style.left='0'; hl.style.top='50vh'; hl.style.width='50vw'; hl.style.height='50vh'; }
                  else if(currX > ww-edge && currY > wh-edge) { snapZone = 'br'; hl.style.left='50vw'; hl.style.top='50vh'; hl.style.width='50vw'; hl.style.height='50vh'; }
                  else if(currY < 10) { snapZone = 'top'; hl.style.left='0'; hl.style.top='0'; hl.style.width='100vw'; hl.style.height='50vh'; }
                  else if(currY > wh-10) { snapZone = 'bottom'; hl.style.left='0'; hl.style.top='50vh'; hl.style.width='100vw'; hl.style.height='50vh'; }
                  else if(currX < 10) { snapZone = 'left'; hl.style.left='0'; hl.style.top='0'; hl.style.width='50vw'; hl.style.height='100vh'; }
                  else if(currX > ww-10) { snapZone = 'right'; hl.style.left='50vw'; hl.style.top='0'; hl.style.width='50vw'; hl.style.height='100vh'; }
                  else { hl.style.display='none'; }
              }
              if(anim === 'move-tilt') w.style.transform = `rotate(${dx > 0 ? 2 : -2}deg)`; else if(anim === 'move-cloth') w.style.transform = `skewX(${-dx * 0.5}deg) skewY(${-dy * 0.5}deg)`;
          }; 
          document.onmouseup = document.ontouchend = () => { 
              document.onmousemove = document.ontouchmove = null; document.onmouseup = document.ontouchend = null; 
              w.style.transform = 'none'; w.style.opacity = '1'; hl.style.display = 'none';
              if(iframe) iframe.style.pointerEvents = 'auto';
              if(snapOn && snapZone) {
                  w.dataset.snapped = 'true'; w.classList.add('snapped');
                  if(snapZone === 'tl') { w.style.left='0'; w.style.top='0'; w.style.width='50vw'; w.style.height='50vh'; }
                  else if(snapZone === 'tr') { w.style.left='50vw'; w.style.top='0'; w.style.width='50vw'; w.style.height='50vh'; }
                  else if(snapZone === 'bl') { w.style.left='0'; w.style.top='50vh'; w.style.width='50vw'; w.style.height='50vh'; }
                  else if(snapZone === 'br') { w.style.left='50vw'; w.style.top='50vh'; w.style.width='50vw'; w.style.height='50vh'; }
                  else if(snapZone === 'top') { w.style.left='0'; w.style.top='0'; w.style.width='100vw'; w.style.height='50vh'; }
                  else if(snapZone === 'bottom') { w.style.left='0'; w.style.top='50vh'; w.style.width='100vw'; w.style.height='50vh'; }
                  else if(snapZone === 'left') { w.style.left='0'; w.style.top='0'; w.style.width='50vw'; w.style.height='100vh'; }
                  else if(snapZone === 'right') { w.style.left='50vw'; w.style.top='0'; w.style.width='50vw'; w.style.height='100vh'; }
              }
          }; 
      }; 
  }

  /**
   * Инициализировать перетаскивание Центра управления
   */
  function initControlCenterDrag() {
      const cc = document.getElementById('control-center'); const ccHeader = cc.querySelector('.cc-header');
      if (window.VFS.config.ccPos) { cc.style.left = window.VFS.config.ccPos.left; cc.style.top = window.VFS.config.ccPos.top; cc.style.right = 'auto'; cc.style.bottom = 'auto'; } 
      else { cc.style.right = '20px'; cc.style.bottom = '90px'; }
      const focusCC = () => { cc.style.zIndex = ++highestZ; }; cc.addEventListener('mousedown', focusCC, {capture: true}); cc.addEventListener('touchstart', focusCC, {passive: true, capture: true});

      ccHeader.onmousedown = ccHeader.ontouchstart = (e) => {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('.win-controls')) return;
          cc.style.zIndex = ++highestZ; let sX = (e.clientX || e.touches[0].clientX); let sY = (e.clientY || e.touches[0].clientY);
          let startLeft = cc.offsetLeft; let startTop = cc.offsetTop;
          document.onmousemove = document.ontouchmove = (ev) => {
              if(cc.classList.contains('fullscreen')) return;
              let currX = (ev.clientX || ev.touches[0].clientX); let currY = (ev.clientY || ev.touches[0].clientY);
              cc.style.left = Math.max(0, Math.min(window.innerWidth - cc.offsetWidth, startLeft + (currX - sX))) + 'px'; 
              cc.style.top = Math.max(0, Math.min(window.innerHeight - cc.offsetHeight, startTop + (currY - sY))) + 'px';
              cc.style.right = 'auto'; cc.style.bottom = 'auto'; 
          };
          document.onmouseup = document.ontouchend = () => { document.onmousemove = document.ontouchmove = null; document.onmouseup = document.ontouchend = null; window.VFS.config.ccPos = { left: cc.style.left, top: cc.style.top }; saveProfile(); };
      };
  }

  /**
   * Инициализировать изменение размера окна (ресайз)
   * @param {HTMLElement} w 
   */
  function initResize(w) { 
      let r = w.querySelector('.resize-handle'); if(!r) { r = document.createElement('div'); r.className = 'resize-handle'; w.appendChild(r); } 
      r.onmousedown = r.ontouchstart = e => { 
          e.stopPropagation(); e.preventDefault(); w.style.zIndex = ++highestZ; 
          let sW = w.offsetWidth, sH = w.offsetHeight, sX = e.clientX||e.touches[0].clientX, sY = e.clientY||e.touches[0].clientY; 
          const iframe = w.querySelector('iframe'); if(iframe) iframe.style.pointerEvents = 'none';

          document.onmousemove = document.ontouchmove = ev => { 
              if(w.classList.contains('fullscreen')) return; 
              w.style.width = Math.max(250, sW + ((ev.clientX||ev.touches[0].clientX) - sX)) + 'px'; 
              w.style.height = Math.max(150, sH + ((ev.clientY||ev.touches[0].clientY) - sY)) + 'px'; 
          }; 
          document.onmouseup = document.ontouchend = () => { 
              document.onmousemove = document.ontouchmove = null; document.onmouseup = document.ontouchend = null; 
              if(iframe) iframe.style.pointerEvents = 'auto';
              if(!window.VFS.config.winSizes) window.VFS.config.winSizes = {}; window.VFS.config.winSizes[w.id] = { w: w.style.width, h: w.style.height }; saveProfile();
          }; 
      }; 
  }

  /**
   * Полный сброс системы (очистка IndexedDB и localStorage)
   */
  window.fullReset = async () => { if(confirm("ВНИМАНИЕ! Вы удалите профили, системные приложения и настройки. Уверены?")) { await window.idb.clear(); localStorage.clear(); location.reload(); } };
  
  /**
   * Переключение видимости Центра управления
   * @param {Event} e 
   */
  window.toggleControlCenter = (e) => { 
      if(e) e.stopPropagation(); const cc = document.getElementById('control-center'); 
      if (cc.style.display === 'flex' && !cc.classList.contains('cc-closing')) { cc.classList.add('cc-closing'); setTimeout(() => { cc.style.display = 'none'; cc.classList.remove('cc-closing'); }, 300); } 
      else { cc.classList.remove('cc-closing'); cc.style.display = 'flex'; cc.style.zIndex = ++highestZ; }
  }
  
  // Загрузка обоев через input
  document.getElementById('file-upload').onchange = e => { const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>{ window.VFS.config.bgValue=ev.target.result; saveProfile(); applySettings(); notify("Обои установлены", "success"); }; r.readAsDataURL(f); e.target.value=''; };

})();