// core/terminal.js - терминал WebSAOS
// ===================================
// Этот модуль отвечает за:
// - Выполнение команд в терминале
// - Поддержку двух режимов:
//   1. Изменение CSS-переменных: --имя = значение
//   2. Выполнение произвольного JavaScript кода (eval)
// - Команды clear и help

/**
 * Выполнить команду в терминале (ввод с клавиатуры)
 * @param {HTMLInputElement} el - поле ввода
 */
window.runTermCmd = (el) => {
    const val = el.value.trim();
    if (!val) return;
    const out = document.getElementById('term-output');
    
    // Выводим команду с промптом
    out.innerHTML += `<div class="term-line"><span style="color:#2ecc71;">root@os:~$</span> <span style="color:#fff;">${val}</span></div>`;
    el.value = '';
    let response = '';
    
    // === Встроенные команды ===
    if (val === 'clear') {
        out.innerHTML = '';
        return;
    } else if (val === 'help') {
        response = `Для изменения CSS переменных: --имя_переменной = значение
Выполнение JS (API ОС): просто введите код.

Примеры:
  --accent = #ff0000
  window.VFS.currentUser
  notify('Привет!', 'success')`;
    } else {
        // === Изменение CSS-переменной ===
        let cssMatch = val.match(/^(--[a-zA-Z0-9_-]+)\s*=\s*(.*)$/);
        if (cssMatch) {
            window.changeCssVar(cssMatch[1], cssMatch[2]);
            response = `[OK] CSS-переменная ${cssMatch[1]} установлена в ${cssMatch[2]}`;
        }
        // === Выполнение произвольного JS ===
        else {
            try {
                let res = eval(val);
                // Если код менял конфиг — сохраняем
                if (val.includes('VFS.config.') || val.includes('dockSettings') || val.includes('VFS.files')) {
                    window.saveProfile();
                }
                response = res !== undefined ? String(res) : '[OK] Команда выполнена';
            } catch (e) {
                response = `<span style="color:#f44;">Ошибка: ${e.message}</span>`;
            }
        }
    }
    
    out.innerHTML += `<div class="term-line" style="color:#aaa; margin-bottom: 8px;">${response}</div>`;
    out.scrollTop = out.scrollHeight;
};