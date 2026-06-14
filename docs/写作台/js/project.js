// ============================================================
// 功能B：项目管理 + 写作面板
// ============================================================

const Project = {

  _progress: null,

  init() {
    this._progress = Storage.loadCasesProgress();
  },

  // ---- 案件列表 ----

  getCases() { return CASES; },

  getCase(caseId) {
    return CASES.find(c => c.id === caseId);
  },

  /** 获取某个案件下所有章节 */
  getChapters(caseId) {
    const c = this.getCase(caseId);
    return c ? c.chapters : [];
  },

  getChapter(caseId, chapterId) {
    const chs = this.getChapters(caseId);
    return chs.find(ch => ch.id === chapterId);
  },

  /** 获取当前选中的案件和章节 */
  getCurrentCaseId() { return Storage.getCurrentCase(); },
  getCurrentChapterId() { return Storage.getCurrentChapter(); },

  // ---- 进度 ----

  isCaseStarted(caseId) {
    return this._progress[caseId]?.started || false;
  },

  isCaseCompleted(caseId) {
    return this._progress[caseId]?.completed || false;
  },

  markCaseStarted(caseId) {
    if (!this._progress[caseId]) this._progress[caseId] = {};
    this._progress[caseId].started = true;
    Storage.saveCasesProgress(this._progress);
  },

  markCaseCompleted(caseId) {
    if (!this._progress[caseId]) this._progress[caseId] = {};
    this._progress[caseId].completed = true;
    Storage.saveCasesProgress(this._progress);
  },

  toggleCaseCompleted(caseId) {
    this._progress[caseId].completed = !this._progress[caseId].completed;
    Storage.saveCasesProgress(this._progress);
    return this._progress[caseId].completed;
  },

  /** 计算全局进度 */
  getOverallProgress() {
    const total = CASES.length;
    let completed = 0;
    CASES.forEach(c => {
      if (this._progress[c.id]?.completed) completed++;
    });
    return { completed, total, percent: total > 0 ? Math.round(completed / total * 100) : 0 };
  },

  // ---- 章节内容 ----

  loadContent(chapterId) {
    return Storage.loadChapter(chapterId);
  },

  saveContent(chapterId, content) {
    Storage.saveChapter(chapterId, content);
  },

  /** 获取当前章节模板文本 */
  getTemplate(caseId, chapterId) {
    const ch = this.getChapter(caseId, chapterId);
    return ch ? ch.template : '';
  },

  // ---- 获取下一章 ----

  getNextChapter(caseId, currentChapterId) {
    const chs = this.getChapters(caseId);
    const idx = chs.findIndex(ch => ch.id === currentChapterId);
    if (idx >= 0 && idx < chs.length - 1) {
      return chs[idx + 1];
    }
    return null;
  },

  getPrevChapter(caseId, currentChapterId) {
    const chs = this.getChapters(caseId);
    const idx = chs.findIndex(ch => ch.id === currentChapterId);
    if (idx > 0) {
      return chs[idx - 1];
    }
    return null;
  },

  // ---- 角色 ----

  getCharacters() { return Storage.loadCharacters(); },

  getCharacter(charId) {
    const chars = this.getCharacters();
    return chars.find(c => c.id === charId);
  },

  saveCharacter(charData) {
    const chars = this.getCharacters();
    const idx = chars.findIndex(c => c.id === charData.id);
    if (idx >= 0) {
      chars[idx] = charData;
    } else {
      chars.push(charData);
    }
    Storage.saveCharacters(chars);
  },

  deleteCharacter(charId) {
    const chars = this.getCharacters().filter(c => c.id !== charId);
    Storage.saveCharacters(chars);
  },

  /** 生成新角色ID */
  newCharId() {
    const chars = this.getCharacters();
    let max = 0;
    chars.forEach(c => {
      const m = c.id.match(/^char(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1]));
    });
    return 'char' + (max + 1);
  },

  // ---- 能力列表 ----

  getAbilities() { return ABILITIES; },

  /** 主角当前已解锁的能力 */
  getUnlockedAbilities() {
    const unlocked = [];
    for (const c of CASES) {
      if (this._progress[c.id]?.completed) {
        // 根据案件解锁对应能力
        const idx = CASES.indexOf(c);
        if (idx < ABILITIES.length) {
          unlocked.push(ABILITIES[idx]);
        }
      }
    }
    return unlocked;
  },

  // ---- 统计 ----

  /** 获取某个章节的字数 */
  getWordCount(chapterId) {
    const content = Storage.loadChapter(chapterId);
    // 中文字数统计（去除标点和空白）
    const cleaned = content.replace(/[\s\n\r，。！？；：、""''「」『』【】《》（）—…\.\,\!\?\;\:\"\'\(\)\[\]\{\}]/g, '');
    return cleaned.length;
  },

  /** 获取某案件总字数 */
  getCaseWordCount(caseId) {
    const chs = this.getChapters(caseId);
    let total = 0;
    chs.forEach(ch => {
      total += this.getWordCount(ch.id);
    });
    return total;
  },

  /** 全局总字数 */
  getTotalWordCount() {
    let total = 0;
    CASES.forEach(c => {
      total += this.getCaseWordCount(c.id);
    });
    return total;
  },
};
