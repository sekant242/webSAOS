window.ModManager = {
    init() { 
        this.loadFromStorage(); this.renderList(); 
        document.getElementById('btn-install-mod').addEventListener('click', () => this.installFromTextarea()); 
    },
    loadFromStorage() { 
        try { const savedMods = JSON.parse(localStorage.getItem('bg_custom_mods') || '[]'); savedMods.forEach(code => this.addMod(code, false)); } catch(e) {} 
    },
    saveToStorage() { 
        try { 
            const mods = window.GAMES.filter(g => g._isMod).map(g => g._modCode);
            localStorage.setItem('bg_custom_mods', JSON.stringify(mods)); 
        } catch(e) { alert("Ошибка сохранения!"); } 
    },
    renderList() {
        const listEl = document.getElementById('mod-list'); listEl.innerHTML = ''; let hasMods = false;
        window.GAMES.forEach((game, index) => {
            if (game._isMod) { 
                hasMods = true; 
                listEl.innerHTML += `<div class="mod-item"><span>${this.escapeHtml(game.name)}</span><button class="btn-delete" onclick="window.ModManager.deleteMod(${index})">X</button></div>`; 
            }
        });
        if (!hasMods) listEl.innerHTML = '<div style="font-size: 10px; color: #555; text-align: center; margin-top:5px;">Модов нет</div>';
    },
    escapeHtml(str) { return str.replace(/[&<>]/g, function(m) { if(m === '&') return '&amp;'; if(m === '<') return '&lt;'; if(m === '>') return '&gt;'; return m;}); },
    addMod(code, saveAndAlert = true) {
        try {
            const newGame = new Function('return ' + code)();
            if(newGame && typeof newGame.init === 'function') {
                // проверка, не перезаписывает ли мод системную игру
                const existingSystem = window.GAMES.find(g => g.name === newGame.name && !g._isMod);
                if (existingSystem) {
                    if (saveAndAlert) alert(`Мод с именем "${newGame.name}" уже существует как системная игра. Переименуйте мод.`);
                    return;
                }
                newGame._isMod = true; newGame._modCode = code;
                newGame.name = newGame.name || "Мод " + window.GAMES.length;
                newGame.hasHD = newGame.hasHD !== undefined ? newGame.hasHD : true;
                if(!newGame.update) newGame.update = function(){}; if(!newGame.draw) newGame.draw = function(){}; if(!newGame.input) newGame.input = function(){};
                window.GAMES.push(newGame);
                if (saveAndAlert) { this.saveToStorage(); alert(`Мод установлен!`); }
                this.renderList(); document.getElementById('mod-code').value = '';
            } else if(saveAndAlert) alert("Ошибка: нет метода init.");
        } catch(e) { if(saveAndAlert) alert("Ошибка кода:\n" + e.message); }
    },
    installFromTextarea() { const code = document.getElementById('mod-code').value.trim(); if (code) this.addMod(code); },
    deleteMod(index) { 
        const game = window.GAMES[index];
        if (game && game._isMod) {
            if (confirm('Удалить мод?')) { 
                window.GAMES.splice(index, 1); 
                if (App.menuGame >= window.GAMES.length) App.menuGame = 0; 
                this.saveToStorage(); this.renderList(); 
                // обновляем меню, если оно активно
                if (App.state === 'MENU') App.loadReplayForMenu();
            }
        } else {
            alert("Нельзя удалить системную игру!");
        }
    }
};