// main.js - точка входа WebSAOS 2.0 (Modular Edition)
// ================================================
// Этот файл загружается последним в index.html и:
// 1. Настраивает PWA (manifest + service worker)
// 2. Импортирует все модули ядра (каждый регистрирует свои функции в window)
// 3. Запускает ОС после загрузки DOM

// ============ PWA SETUP ============
(function setupPWA() {
    const manifest = {
        name: "WebSAOS 2.0",
        short_name: "WebSAOS",
        display: "standalone",
        start_url: ".",
        background_color: "#000000",
        theme_color: "#2b8cff",
        icons: [{
            src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💻</text></svg>",
            sizes: "192x192",
            type: "image/svg+xml"
        }]
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);

    if ('serviceWorker' in navigator) {
        const swBlob = new Blob(
            ["self.addEventListener('fetch', function(event) {});"],
            { type: 'application/javascript' }
        );
        navigator.serviceWorker.register(URL.createObjectURL(swBlob))
            .catch(e => console.log('SW Reg failed', e));
    }
})();

// ============ ИМПОРТ МОДУЛЕЙ ЯДРА ============
// Каждый модуль при импорте регистрирует свои функции в window.*
// (для совместимости с onclick в HTML)

// Базовое состояние и утилиты
import './core/state.js';
import './core/utils.js';

// Авторизация и пользователи
import './core/auth.js';

// Рабочий стол, иконки, папки
import './core/desktop.js';

// Окна: drag, resize, snap, minimize, maximize
import './core/window-manager.js';

// Файловый менеджер, блокнот, бэкапы
import './core/file-manager.js';

// Темы, CSS-переменные, анимации
import './core/themes.js';

// Виджеты: часы, док, центр управления
import './core/widgets.js';

// Терминал
import './core/terminal.js';

// Менеджер приложений и редактор
import './core/apps.js';

// ============ ЗАПУСК ОС ============
window.addEventListener('load', async () => {
    // 1. Инициализируем IndexedDB и загружаем список пользователей
    await window.VFS.loadSystem();
    
    // 2. Рендерим сетку пользователей на экране входа
    window.renderUsersGrid();
    
    // 3. Обновляем круговую диаграмму хранилища
    window.updateStorageChart();
    
    // 4. Запускаем таймер часов (обновление каждую секунду)
    setInterval(window.tickClock, 1000);
    
    console.log('🚀 WebSAOS 2.0 запущена');
});