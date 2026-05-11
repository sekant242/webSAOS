window.GameService = {
    data: { leaderboards: {}, timeSpent: {} },

    async init() {
        const user = window.VFS.currentUser;
        if (!user) return;
        this.data = await window.idb.get(`websaos_games_${user}`) || { leaderboards: {}, timeSpent: {} };
        console.log("🎮 Игровой сервис запущен.");
    },

    async save() {
        const user = window.VFS.currentUser;
        if (user) await window.idb.set(`websaos_games_${user}`, this.data);
    },

    async submitScore(gameId, score) {
        if (!this.data.leaderboards[gameId]) this.data.leaderboards[gameId] = [];
        this.data.leaderboards[gameId].push({ date: new Date().toLocaleString(), score: Number(score) });
        this.data.leaderboards[gameId].sort((a, b) => b.score - a.score);
        this.data.leaderboards[gameId] = this.data.leaderboards[gameId].slice(0, 10);
        await this.save();
    },

    async logTime(gameId, seconds) {
        if (!this.data.timeSpent[gameId]) this.data.timeSpent[gameId] = 0;
        this.data.timeSpent[gameId] += Number(seconds);
        await this.save();
    },

    getLeaderboard(gameId) { return this.data.leaderboards[gameId] || []; },
    getTimeSpentMinutes(gameId) {
        const sec = this.data.timeSpent[gameId] || 0;
        return Math.floor(sec / 60);
    }
};
