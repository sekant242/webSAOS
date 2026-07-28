// core/utils.js - общие утилиты WebSAOS
// =====================================
// Здесь собраны функции, которые не относятся к конкретной
// подсистеме (окна, рабочий стол, темы), а нужны везде:
// уведомления, конвертеры, меню, работа с хранилищем.

// ============ УВЕДОМЛЕНИЯ ============

/**
 * Показать всплывающее уведомление (toast)
 * @param {string} msg - текст уведомления
 * @param {string} type - тип: 'info' | 'success' | 'error'
 */
window.notify = (msg, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// ============ КОНТЕКСТНЫЕ МЕНЮ ============

/**
 * Показать контекстное меню в указанной позиции (по событию)
 * Автоматически корректирует позицию, чтобы меню не вылезало за экран.
 * @param {HTMLElement} menu - элемент меню
 * @param {Event} e - событие мыши или касания
 */
window.showMenuAt = (menu, e) => {
    menu.style.display = 'flex';
    let x = e.clientX || (e.touches ? e.touches[0].clientX : 0);
    let y = e.clientY || (e.touches ? e.touches[0].clientY : 0);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) x = window.innerWidth - rect.width - 10;
    if (rect.bottom > window.innerHeight) y = window.innerHeight - rect.height - 10;
    
    menu.style.left = Math.max(10, x) + 'px';
    menu.style.top = Math.max(10, y) + 'px';
};

// ============ ХРАНИЛИЩЕ ============

/**
 * Обновить круговую диаграмму использования хранилища
 * Использует navigator.storage.estimate() для получения данных
 */
window.updateStorageChart = async () => {
    if (navigator.storage && navigator.storage.estimate) {
        try {
            const est = await navigator.storage.estimate();
            window.State.rawStorageUsed = est.usage || 0;
            window.State.rawStorageQuota = est.quota || 0;
            const percent = Math.min(
                Math.round((window.State.rawStorageUsed / window.State.rawStorageQuota) * 100),
                100
            );
            document.getElementById('storage-circle')?.setAttribute('stroke-dasharray', `${percent}, 100`);
            const textEl = document.getElementById('storage-text');
            if (textEl) textEl.innerText = `${percent}%`;
        } catch (e) {
            // Игнорируем ошибки (например, в приватном режиме)
        }
    }
};

/**
 * Показать детальную информацию о хранилище через уведомление
 */
window.showStorageInfo = () => {
    if (window.State.rawStorageQuota > 0) {
        const usedMB = (window.State.rawStorageUsed / 1024 / 1024).toFixed(2);
        const quotaGB = (window.State.rawStorageQuota / 1024 / 1024 / 1024).toFixed(2);
        window.notify(`Занято: ${usedMB} MB из ${quotaGB} GB`, 'info');
    } else {
        window.notify('Информация о хранилище недоступна', 'error');
    }
};

// ============ КОНВЕРТЕРЫ ============

/**
 * Преобразовать HEX цвет в RGB строку (для rgba())
 * @param {string} hex - цвет в формате #RRGGBB
 * @returns {string} - строка вида "R, G, B"
 */
window.hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '22, 31, 41';
};

// ============ СОХРАНЕНИЕ ПРОФИЛЯ ============

/**
 * Сохранить текущий профиль пользователя (конфиг в IndexedDB)
 * Вызывается после любого изменения настроек
 */
window.saveProfile = () => {
    window.VFS.saveConfig();
};