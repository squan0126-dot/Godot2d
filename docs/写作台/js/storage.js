// ============================================================
// 本地存储模块 —— localStorage 封装
// ============================================================

const Storage = {
  KEYS: {
    cases: 'wrt_cases',
    currentCase: 'wrt_current_case',
    currentChapter: 'wrt_current_chapter',
    chapterContent: 'wrt_ch_',    // + chapterId
    ollamaUrl: 'wrt_ollama_url',
    ollamaModel: 'wrt_ollama_model',
    aiHistory: 'wrt_ai_history',
  },

  // ---- 案件进度 ----

  loadCasesProgress() {
    try {
      const raw = localStorage.getItem(this.KEYS.cases);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    // 初始化默认进度
    const defaults = {};
    CASES.forEach(c => {
      defaults[c.id] = { started: false, completed: false };
    });
    return defaults;
  },

  saveCasesProgress(progress) {
    localStorage.setItem(this.KEYS.cases, JSON.stringify(progress));
  },

  // ---- 当前选中 ----

  getCurrentCase() {
    return localStorage.getItem(this.KEYS.currentCase) || CASES[0].id;
  },

  setCurrentCase(caseId) {
    localStorage.setItem(this.KEYS.currentCase, caseId);
  },

  getCurrentChapter() {
    return localStorage.getItem(this.KEYS.currentChapter) || '';
  },

  setCurrentChapter(chapterId) {
    localStorage.setItem(this.KEYS.currentChapter, chapterId);
  },

  // ---- 章节正文 ----

  loadChapter(chapterId) {
    try {
      const raw = localStorage.getItem(this.KEYS.chapterContent + chapterId);
      return raw || '';
    } catch (e) {
      return '';
    }
  },

  saveChapter(chapterId, content) {
    localStorage.setItem(this.KEYS.chapterContent + chapterId, content);
  },

  // ---- AI 设置 ----

  getOllamaUrl() {
    return localStorage.getItem(this.KEYS.ollamaUrl) || 'http://localhost:11434';
  },

  setOllamaUrl(url) {
    localStorage.setItem(this.KEYS.ollamaUrl, url);
  },

  getOllamaModel() {
    return localStorage.getItem(this.KEYS.ollamaModel) || 'qwen2.5:7b';
  },

  setOllamaModel(model) {
    localStorage.setItem(this.KEYS.ollamaModel, model);
  },

  // ---- 角色编辑 ----

  loadCharacters() {
    try {
      const raw = localStorage.getItem('wrt_characters');
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    // 首次使用，写入默认数据
    const defaults = JSON.parse(JSON.stringify(DEFAULT_CHARACTERS));
    this.saveCharacters(defaults);
    return defaults;
  },

  saveCharacters(chars) {
    localStorage.setItem('wrt_characters', JSON.stringify(chars));
  },

  // ---- AI 对话历史 ----

  loadAIHistory() {
    try {
      const raw = localStorage.getItem(this.KEYS.aiHistory);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  saveAIHistory(history) {
    // 只保留最近100条
    const trimmed = history.slice(-100);
    localStorage.setItem(this.KEYS.aiHistory, JSON.stringify(trimmed));
  },

  clearAIHistory() {
    localStorage.removeItem(this.KEYS.aiHistory);
  },

  // ---- 导出全部数据 ----

  exportAll() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('wrt_')) {
        data[key] = localStorage.getItem(key);
      }
    }
    return JSON.stringify(data, null, 2);
  },

  importAll(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      Object.entries(data).forEach(([k, v]) => {
        if (k.startsWith('wrt_')) {
          localStorage.setItem(k, v);
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  },
};
