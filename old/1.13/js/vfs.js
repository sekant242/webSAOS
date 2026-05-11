// --- IndexedDB Wrapper ---
window.idb = {
    db: null,
    init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open("WebSAOS_VFS", 1);
            req.onupgradeneeded = e => {
                if(!e.target.result.objectStoreNames.contains("store")) {
                    e.target.result.createObjectStore("store");
                }
            };
            req.onsuccess = e => { this.db = e.target.result; resolve(); };
            req.onerror = e => reject(e);
        });
    },
    get(key) {
        return new Promise(resolve => {
            const req = this.db.transaction("store").objectStore("store").get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    },
    set(key, val) {
        return new Promise(resolve => {
            const req = this.db.transaction("store", "readwrite").objectStore("store").put(val, key);
            req.onsuccess = () => resolve();
        });
    },
    del(key) {
        return new Promise(resolve => {
            const req = this.db.transaction("store", "readwrite").objectStore("store").delete(key);
            req.onsuccess = () => resolve();
        });
    },
    keys() {
        return new Promise(resolve => {
            const req = this.db.transaction("store").objectStore("store").getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve([]);
        });
    },
    clear() {
        return new Promise(resolve => {
            const req = this.db.transaction("store", "readwrite").objectStore("store").clear();
            req.onsuccess = () => resolve();
        });
    }
};

// --- Virtual File System ---
window.VFS = {
    currentUser: '',
    apps: {}, folders: {}, config: {}, users: {}, files: {},
    async loadSystem() {
        await window.idb.init();
        this.users = await window.idb.get('websaos_users_data') || { 'Admin': { icon: '👑', pass: '' } };
    },
    async saveUsers() { await window.idb.set('websaos_users_data', this.users); },
    async loadUser(user) {
        this.apps = await window.idb.get(`apps_${user}`) || {};
        this.folders = await window.idb.get(`desk_folders_${user}`) || {};
        this.config = await window.idb.get(`websaos_config_${user}`) || {};
        this.files = await window.idb.get(`files_${user}`);
        if (!this.files) {
            this.files = {
                '/': { type: 'dir' },
                '/Справка_терминала.txt': { type: 'file', content: "СПРАВКА ПО ТЕРМИНАЛУ И ОС WebSAOS 1.13\n\nТерминал позволяет выполнять JavaScript код в контексте ОС и менять CSS-переменные системы напрямую.\nСинтаксис для настроек: переменная = значение" }
            };
            await this.saveFiles();
        }
    },
    saveApps() { window.idb.set(`apps_${this.currentUser}`, this.apps); if(window.updateStorageChart) window.updateStorageChart(); },
    saveFolders() { window.idb.set(`desk_folders_${this.currentUser}`, this.folders); },
    saveConfig() { window.idb.set(`websaos_config_${this.currentUser}`, this.config); },
    saveFiles() { window.idb.set(`files_${this.currentUser}`, this.files); if(window.updateStorageChart) window.updateStorageChart(); }
};
