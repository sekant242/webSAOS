// core/state.js - глобальное состояние WebSAOS
// =============================================
// Этот модуль хранит все переменные, которые используются
// в разных частях ОС. Раньше они были локальными внутри IIFE в core.js,
// теперь они доступны глобально через window.State.

window.State = {
    // ============ ОКНА ============
    // Максимальный z-index для фокусировки окон
    highestZ: 1000,
    
    // Массив открытых окон (для виджета Dock)
    // Структура: { id, icon, title, state: 'open' | 'minimized' }
    windowInstances: [],
    
    // ============ ФАЙЛОВЫЙ МЕНЕДЖЕР ============
    // Текущая вкладка: 'docs' | 'system' | 'desktop' | 'backup'
    currentFMTab: 'docs',
    
    // Текущий путь в ФМ (например: '/', '/Documents/', '/Games/')
    currentFMPath: '/',
    
    // ============ ХРАНИЛИЩЕ ============
    // Статистика использования места (в байтах)
    rawStorageUsed: 0,
    rawStorageQuota: 0,
    
    // ============ РАБОЧИЙ СТОЛ ============
    // ID текущей открытой папки на рабочем столе (или null)
    currentOpenDeskFolder: null,
    
    // ============ CSS-ПЕРЕМЕННЫЕ ПО УМОЛЧАНИЮ ============
    // Используются при сбросе темы и инициализации нового пользователя
    defaultVars: {
        '--accent': '#2b8cff',
        '--win-bg-rgb': '22, 31, 41',
        '--text': '#e6eef8',
        '--win-border': '#444444',
        '--win-opacity': '0.85',
        '--glass-blur': '15px',
        '--blur': '0px',
        '--shadow-op': '0.5',
        '--win-radius': '16px 16px 16px 16px',
        '--btn-radius': '10px 10px 10px 10px',
        '--menu-radius': '16px 16px 16px 16px',
        '--icon-size': '54px',
        '--text-size': '11px',
        '--ww-bg': 'rgba(22, 31, 41, 0.8)',
        '--ww-border': '#444444'
    }
};

// ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============
// Добавляем методы прямо в State для удобства

/**
 * Увеличить z-index и вернуть новое значение
 * Используется при фокусировке окна
 */
window.State.nextZ = function() {
    return ++this.highestZ;
};

/**
 * Найти окно в windowInstances по ID
 * @param {string} id
 * @returns {Object|undefined}
 */
window.State.findWindow = function(id) {
    return this.windowInstances.find(w => w.id === id);
};

/**
 * Зарегистрировать новое окно в списке
 * @param {string} id
 * @param {string} icon
 * @param {string} title
 */
window.State.registerWindow = function(id, icon, title) {
    if (!this.findWindow(id)) {
        this.windowInstances.push({ id, icon, title, state: 'open' });
    } else {
        this.findWindow(id).state = 'open';
    }
};

/**
 * Удалить окно из списка
 * @param {string} id
 */
window.State.unregisterWindow = function(id) {
    this.windowInstances = this.windowInstances.filter(w => w.id !== id);
};