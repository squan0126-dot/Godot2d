// ============================================================
// 小说工作台 —— 主控制器（写作台风格）
// ============================================================

// ===== 全局数据 =====
let DB = {
  project: { name:'未命名作品', author:'', genre:'', desc:'', targetWords:0, status:'构思中' },
  chapters: [],
  characters: [],
  relations: [],
  locations: [],
  plots: { columns:['第一幕·起','第二幕·承','第三幕·转','第四幕·合'], cards:[] },
  hooks: [],
  reversals: [],
  timeline: [],
  materials: [],
};

// ===== 存储 =====
const Store = {
  KEYS: {
    project:'ns_project', chapters:'ns_chapters', characters:'ns_characters',
    relations:'ns_relations', locations:'ns_locations', plots:'ns_plots',
    hooks:'ns_hooks', reversals:'ns_reversals', timeline:'ns_timeline',
    materials:'ns_materials', currentChapter:'ns_current_chapter',
    ollamaUrl:'ns_ollama_url', ollamaModel:'ns_ollama_model', aiHistory:'ns_ai_history',
  },
  load(key) {
    try { const r = localStorage.getItem(this.KEYS[key]); return r ? JSON.parse(r) : null; } catch(e) { return null; }
  },
  save(key, val) {
    try { localStorage.setItem(this.KEYS[key], JSON.stringify(val)); } catch(e) {}
  },
  loadAll() {
    Object.keys(DB).forEach(k => { const v = this.load(k); if (v !== null) DB[k] = v; });
  },

  // 从 data/*.json 文件加载旧数据（通过 fetch，适用于本地服务器模式）
  async loadFromFiles() {
    const fileMap = {
      project: 'data/project.json',
      characters: 'data/characters.json',
      relations: 'data/relations.json',
      locations: 'data/locations.json',
      hooks: 'data/hooks.json',
      timeline: 'data/timeline.json',
      chapters: 'data/chapters.json',
      materials: 'data/materials.json',
      settings: 'data/settings.json',
    };
    const results = {};
    await Promise.all(Object.entries(fileMap).map(async ([key, path]) => {
      try {
        const resp = await fetch(path);
        if (resp.ok) results[key] = await resp.json();
      } catch(e) {}
    }));
    return results;
  },
  saveAll() {
    Object.keys(DB).forEach(k => this.save(k, DB[k]));
  },
  exportAll() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ns_')) data[k] = localStorage.getItem(k);
    }
    return JSON.stringify(data, null, 2);
  },
  importAll(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      Object.entries(data).forEach(([k,v]) => { if (k.startsWith('ns_')) localStorage.setItem(k,v); });
      return true;
    } catch(e) { return false; }
  },
  getOllamaUrl() { return localStorage.getItem(this.KEYS.ollamaUrl) || 'http://localhost:11434'; },
  setOllamaUrl(v) { localStorage.setItem(this.KEYS.ollamaUrl, v); },
  getOllamaModel() { return localStorage.getItem(this.KEYS.ollamaModel) || 'qwen2.5:7b'; },
  setOllamaModel(v) { localStorage.setItem(this.KEYS.ollamaModel, v); },
  getCurrentChapter() { return localStorage.getItem(this.KEYS.currentChapter) || ''; },
  setCurrentChapter(id) { localStorage.setItem(this.KEYS.currentChapter, id); },
  loadAIHistory() { try { const r = localStorage.getItem(this.KEYS.aiHistory); return r ? JSON.parse(r) : []; } catch(e) { return []; } },
  saveAIHistory(h) { localStorage.setItem(this.KEYS.aiHistory, JSON.stringify(h.slice(-100))); },
  clearAIHistory() { localStorage.removeItem(this.KEYS.aiHistory); },
};

// ===== 工具函数 =====
const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2,5);
const esc = str => { const d = document.createElement('div'); d.textContent = str||''; return d.innerHTML; };

// ===== 主应用 =====
const App = {
  _currentChapterId: null,
  _unsaved: false,
  _autoSaveTimer: null,
  _leftTab: 'chapters',
  _rightTab: 'tools',
  _charEditMode: false,
  _editingId: null,
  _toolView: 'dashboard', // dashboard | chars | relations | locations | plots | hooks | reversals | timeline | materials | analytics

  init() {
    Store.loadAll();
    this._currentChapterId = Store.getCurrentChapter();

    // 如果 localStorage 里没有数据，尝试从 data/*.json 迁移旧数据
    const isEmpty = !DB.characters.length && !DB.chapters.length;
    if (isEmpty) {
      Store.loadFromFiles().then(files => {
        if (Object.keys(files).length) {
          this._migrateOldData(files);
          Store.saveAll();
          this._renderAll();
          this._updateProjectName();
          this._updateStatus();
          this._toast('✅ 已从旧数据文件迁移数据');
        } else {
          this._renderAll();
          this._updateProjectName();
          this._updateStatus();
          this._toast('✅ 工作台已就绪');
        }
      });
    } else {
      this._renderAll();
      this._updateProjectName();
      this._updateStatus();
      this._toast('✅ 数据已加载');
    }

    this._bindEvents();
    this._startAutoSave();
  },

  // 旧数据字段适配
  _migrateOldData(files) {
    // ---- project ----
    if (files.project && typeof files.project === 'object' && !Array.isArray(files.project)) {
      DB.project = {
        name: files.project.name || '未命名作品',
        author: files.project.author || '',
        genre: files.project.genre || '',
        desc: files.project.desc || '',
        targetWords: files.project.targetWords || 0,
        status: files.project.status || '构思中',
      };
    }

    // ---- characters ----
    // 旧字段：role(身份), desc(简介), tags(逗号字符串), notes(备注), color
    // 新字段：title(身份), summary(简介), tags(数组), details(对象), color
    if (Array.isArray(files.characters)) {
      DB.characters = files.characters.map(c => {
        const tags = Array.isArray(c.tags)
          ? c.tags
          : (c.tags || '').split(/[，,]/).map(t => t.trim()).filter(Boolean);
        const details = {};
        if (c.notes) details['备注'] = c.notes;
        return {
          id: c.id || genId(),
          name: c.name || '',
          title: c.title || c.role || '',
          status: c.status || 'alive',
          color: c.color || '#6366f1',
          tags,
          summary: c.summary || c.desc || '',
          details: c.details && typeof c.details === 'object' ? c.details : details,
        };
      });
    }

    // ---- relations ----
    // 旧字段：from/to/label/type/desc
    // 新字段：charA/charB/type/custom/desc
    if (Array.isArray(files.relations)) {
      DB.relations = files.relations.map(r => ({
        id: r.id || genId(),
        charA: r.charA || r.from || '',
        charB: r.charB || r.to || '',
        type: r.type || r.label || '自定义',
        custom: r.custom || r.label || '',
        desc: r.desc || '',
      }));
    }

    // ---- locations ----
    // 旧字段：name/type/desc/notes
    // 新字段：name/type/region/mood/desc
    if (Array.isArray(files.locations)) {
      DB.locations = files.locations.map(l => ({
        id: l.id || genId(),
        name: l.name || '',
        type: l.type || '城市',
        region: l.region || '',
        mood: l.mood || '宁静',
        desc: l.desc || '',
      }));
    }

    // ---- chapters ----
    // 旧字段基本一致，多了 target/locs，缺 wordCount
    if (Array.isArray(files.chapters)) {
      DB.chapters = files.chapters.map(c => ({
        id: c.id || genId(),
        title: c.title || '',
        status: c.status || 'draft',
        mood: c.mood || '',
        chars: c.chars || '',
        summary: c.summary || '',
        outline: c.outline || '',
        content: c.content || '',
        wordCount: c.wordCount || (c.content ? c.content.replace(/[\s\n\r，。！？；：、""''「」『』【】《》（）—…\.\,\!\?\;\:\"\'\(\)\[\]\{\}]/g, '').length : 0),
      }));
    }

    // ---- hooks ----
    // 旧字段：title/type/status/desc/plant/resolve/notes
    // 新字段：title/type/status/desc/plant/harvest/priority
    if (Array.isArray(files.hooks)) {
      DB.hooks = files.hooks.map(h => ({
        id: h.id || genId(),
        title: h.title || '',
        type: h.type === '钩子' ? '开篇钩子' : h.type === '伏笔' ? '伏笔' : (h.type || '悬念'),
        status: h.status || 'open',
        desc: h.desc || '',
        plant: h.plant || '',
        harvest: h.harvest || h.resolve || '',
        priority: h.priority || '中',
      }));
    }

    // ---- reversals ----
    if (Array.isArray(files.reversals)) {
      DB.reversals = files.reversals.map(r => ({
        id: r.id || genId(),
        title: r.title || '',
        type: r.type || '事实反转',
        content: r.content || r.desc || '',
        foreshadow: r.foreshadow || '',
        chapter: r.chapter || '',
        chars: r.chars || '',
      }));
    }

    // ---- timeline ----
    // 旧字段：importance(high/medium/low) → 新字段：level(major/normal/minor)
    if (Array.isArray(files.timeline)) {
      const levelMap = { high: 'major', medium: 'normal', low: 'minor' };
      DB.timeline = files.timeline.map(t => ({
        id: t.id || genId(),
        time: t.time || t.date || '',
        title: t.title || '',
        level: levelMap[t.importance] || t.level || 'normal',
        desc: t.desc || '',
        chars: t.chars || '',
      }));
    }

    // ---- materials ----
    if (Array.isArray(files.materials)) {
      DB.materials = files.materials.map(m => ({
        id: m.id || genId(),
        type: m.type || '笔记',
        tags: m.tags || '',
        content: m.content || '',
        source: m.source || '',
      }));
    }

    // ---- plots（从 settings 里读 plotColumns）----
    if (files.settings) {
      const cols = files.settings.plotColumns || files.settings.columns;
      if (Array.isArray(cols) && cols.length) {
        DB.plots.columns = cols;
      }
    }
    // 旧 plots 数据（column 字段是列索引数字）
    if (Array.isArray(files.plots)) {
      DB.plots.cards = files.plots.map(p => ({
        id: p.id || genId(),
        title: p.title || '',
        col: typeof p.column === 'number' ? (DB.plots.columns[p.column] || DB.plots.columns[0]) : (p.col || DB.plots.columns[0]),
        desc: p.desc || '',
        mood: p.mood || '',
        chars: p.chars || '',
      }));
    }
  },

  _renderAll() {
    this._renderLeftPanel();
    this._renderEditor();
    this._renderRightPanel();
  },

  // ===== 左侧面板 =====
  _renderLeftPanel() {
    this._renderChapterList();
    this._renderOutlinePanel();
    this._renderCharList();
    this._switchLeftTab(this._leftTab);
  },

  _renderChapterList() {
    const container = document.getElementById('chapterList');
    container.innerHTML = '';

    // 进度条
    const done = DB.chapters.filter(c => c.status === 'done').length;
    const total = DB.chapters.length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    bar.innerHTML = `<div class="progress-fill" style="width:${pct}%"></div>`;
    container.appendChild(bar);

    // 新建章节按钮
    const addBtn = document.createElement('div');
    addBtn.style.cssText = 'padding:4px 0 8px;';
    addBtn.innerHTML = `<button class="btn btn-sm btn-primary" style="width:100%" id="btnAddChapter">＋ 新建章节</button>`;
    addBtn.querySelector('#btnAddChapter').addEventListener('click', () => this._openChapterModal(null));
    container.appendChild(addBtn);

    if (!DB.chapters.length) {
      const empty = document.createElement('div');
      empty.className = 'template-empty';
      empty.textContent = '还没有章节，点击上方新建';
      container.appendChild(empty);
      return;
    }

    const statusLabels = { draft:'草稿', writing:'写作中', done:'已完成', revision:'修改中' };
    const statusCls = { draft:'', writing:'tag-accent', done:'tag-green', revision:'tag-yellow' };

    DB.chapters.forEach((ch, i) => {
      const isActive = ch.id === this._currentChapterId;
      const wc = this._getWordCount(ch.id);

      const item = document.createElement('div');
      item.className = 'case-item';

      const header = document.createElement('div');
      header.className = `case-header${isActive ? ' active' : ''}`;
      header.innerHTML = `
        <span class="case-arrow${isActive ? ' expanded' : ''}">▶</span>
        <span class="case-title" style="font-size:12px">第${i+1}章 ${esc(ch.title)}</span>
        ${wc > 0 ? `<span style="font-size:10px;color:var(--text-muted)">${wc}字</span>` : ''}
        <span class="tag ${statusCls[ch.status]||''}" style="font-size:9px">${statusLabels[ch.status]||'草稿'}</span>
      `;
      header.addEventListener('click', () => this._selectChapter(ch.id));

      // 展开子项（摘要+操作）
      const sub = document.createElement('div');
      sub.className = `case-chapters${isActive ? ' open' : ''}`;
      sub.innerHTML = `
        ${ch.summary ? `<div style="font-size:11px;color:var(--text-muted);padding:4px 8px;line-height:1.5">${esc(ch.summary.substring(0,80))}${ch.summary.length>80?'...':''}</div>` : ''}
        <div style="display:flex;gap:4px;padding:4px 8px">
          <button class="btn btn-sm" data-action="edit" data-id="${ch.id}">✎ 编辑</button>
          <button class="btn btn-sm" style="color:var(--red)" data-action="del" data-id="${ch.id}">✕</button>
        </div>
      `;
      sub.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (btn.dataset.action === 'edit') this._openChapterModal(btn.dataset.id);
          else if (btn.dataset.action === 'del') this._deleteChapter(btn.dataset.id);
        });
      });

      item.appendChild(header);
      item.appendChild(sub);
      container.appendChild(item);
    });
  },

  _renderOutlinePanel() {
    const container = document.getElementById('outlinePanel');
    // 显示当前章节大纲
    const ch = DB.chapters.find(c => c.id === this._currentChapterId);
    if (!ch) {
      container.innerHTML = '<div class="template-empty">请先选择一个章节</div>';
      return;
    }
    const outline = ch.outline || '';
    const chars = ch.chars || '';
    container.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:8px">
        第${DB.chapters.indexOf(ch)+1}章 · ${esc(ch.title)}
      </div>
      ${outline ? `<div class="template-box">${esc(outline)}</div>` : '<div class="template-empty">暂无大纲</div>'}
      ${chars ? `<div style="margin-top:8px;font-size:11px;color:var(--text-dim)">👥 ${esc(chars)}</div>` : ''}
      <div style="margin-top:12px">
        <button class="btn btn-sm" style="width:100%" id="btnEditOutline">✎ 编辑大纲</button>
      </div>
    `;
    container.querySelector('#btnEditOutline')?.addEventListener('click', () => this._openChapterModal(ch.id));
  },

  _renderCharList() {
    const container = document.getElementById('charList');
    container.innerHTML = '';

    const toolbar = document.createElement('div');
    toolbar.className = 'char-toolbar';
    toolbar.innerHTML = `
      <button class="btn btn-sm ${this._charEditMode ? 'btn-primary' : ''}" id="btnToggleCharEdit">
        ${this._charEditMode ? '✓ 完成' : '✎ 编辑'}
      </button>
      ${this._charEditMode ? '<button class="btn btn-sm btn-primary" id="btnAddChar">＋ 新增</button>' : ''}
    `;
    toolbar.querySelector('#btnToggleCharEdit').addEventListener('click', () => {
      this._charEditMode = !this._charEditMode;
      this._renderCharList();
    });
    if (this._charEditMode) {
      toolbar.querySelector('#btnAddChar')?.addEventListener('click', () => this._openCharModal(null));
    }
    container.appendChild(toolbar);

    if (!DB.characters.length) {
      const empty = document.createElement('div');
      empty.className = 'template-empty';
      empty.textContent = '暂无人物';
      container.appendChild(empty);
      return;
    }

    const statusMap = { alive:['存活','char-status-alive'], dead:['已故','char-status-dead'], soul:['残魂','char-status-soul'], unknown:['下落不明','char-status-unknown'] };

    DB.characters.forEach(ch => {
      const card = document.createElement('div');
      card.className = 'char-card';
      const [statusLabel, statusClass] = statusMap[ch.status] || [];
      const tags = Array.isArray(ch.tags) ? ch.tags : (ch.tags||'').split(/[，,]/).filter(Boolean);
      const details = typeof ch.details === 'object' ? ch.details : {};
      const detailsHtml = Object.entries(details).map(([k,v]) => {
        const val = Array.isArray(v) ? v.join('；') : v;
        return `<div class="char-detail-item"><span class="char-detail-label">${esc(k)}：</span>${esc(val)}</div>`;
      }).join('');
      const hasDetails = Object.keys(details).length > 0 || ch.summary;

      card.innerHTML = `
        ${this._charEditMode ? `<div class="char-actions">
          <button class="btn btn-sm" data-action="edit" data-id="${ch.id}">✎</button>
          <button class="btn btn-sm char-btn-del" data-action="del" data-id="${ch.id}">✕</button>
        </div>` : ''}
        <div class="char-name">${esc(ch.name)}</div>
        <div class="char-title-row">${esc(ch.title||'')}${statusLabel ? `<span class="char-status-badge ${statusClass}">${statusLabel}</span>` : ''}</div>
        ${tags.length ? `<div class="char-tags">${tags.map(t=>`<span class="char-tag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${ch.summary ? `<div class="char-summary">${esc(ch.summary)}</div>` : ''}
        ${hasDetails ? `<div class="char-details">${detailsHtml}</div><div class="char-expand-hint">▼ 点击展开</div>` : ''}
      `;

      if (!this._charEditMode) {
        card.addEventListener('click', () => {
          card.classList.toggle('expanded');
          const hint = card.querySelector('.char-expand-hint');
          if (hint) hint.textContent = card.classList.contains('expanded') ? '▲ 收起' : '▼ 点击展开';
        });
      } else {
        card.querySelectorAll('[data-action]').forEach(btn => {
          btn.addEventListener('click', e => {
            e.stopPropagation();
            if (btn.dataset.action === 'edit') this._openCharModal(btn.dataset.id);
            else if (btn.dataset.action === 'del') {
              if (confirm('确定删除该人物？')) {
                DB.characters = DB.characters.filter(c => c.id !== btn.dataset.id);
                Store.save('characters', DB.characters);
                this._renderCharList();
                this._toast('人物已删除');
              }
            }
          });
        });
      }
      container.appendChild(card);
    });
  },

  _switchLeftTab(tab) {
    this._leftTab = tab;
    document.querySelectorAll('#left-panel .panel-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('chaptersContent').classList.toggle('hidden', tab !== 'chapters');
    document.getElementById('outlineContent').classList.toggle('hidden', tab !== 'outline');
    document.getElementById('charsContent').classList.toggle('hidden', tab !== 'chars');
    if (tab === 'outline') this._renderOutlinePanel();
  },

  // ===== 编辑器 =====
  _renderEditor() {
    const ch = DB.chapters.find(c => c.id === this._currentChapterId);
    const titleEl = document.getElementById('editorTitle');
    if (!ch) { titleEl.textContent = '请从左侧选择章节开始写作'; return; }
    const i = DB.chapters.indexOf(ch);
    titleEl.textContent = `第${i+1}章 · ${ch.title}`;
  },

  _selectChapter(chapterId) {
    this._saveCurrent();
    this._currentChapterId = chapterId;
    Store.setCurrentChapter(chapterId);
    const ch = DB.chapters.find(c => c.id === chapterId);
    document.getElementById('editor').value = ch?.content || '';
    this._unsaved = false;
    this._renderLeftPanel();
    this._renderEditor();
    this._updateStatus();
    document.getElementById('editor').focus();
  },

  _saveCurrent() {
    if (!this._currentChapterId) return;
    const ch = DB.chapters.find(c => c.id === this._currentChapterId);
    if (!ch) return;
    ch.content = document.getElementById('editor').value;
    ch.wordCount = this._getWordCount(this._currentChapterId);
    Store.save('chapters', DB.chapters);
    this._unsaved = false;
    this._updateStatus();
  },

  _getWordCount(chapterId) {
    const ch = DB.chapters.find(c => c.id === chapterId);
    if (!ch || !ch.content) return 0;
    return ch.content.replace(/[\s\n\r，。！？；：、""''「」『』【】《》（）—…\.\,\!\?\;\:\"\'\(\)\[\]\{\}]/g, '').length;
  },

  _goNext() {
    const idx = DB.chapters.findIndex(c => c.id === this._currentChapterId);
    if (idx >= 0 && idx < DB.chapters.length - 1) this._selectChapter(DB.chapters[idx+1].id);
    else this._toast('已是最后一章');
  },

  _goPrev() {
    const idx = DB.chapters.findIndex(c => c.id === this._currentChapterId);
    if (idx > 0) this._selectChapter(DB.chapters[idx-1].id);
    else this._toast('已是第一章');
  },

  // ===== 右侧面板 =====
  _renderRightPanel() {
    this._renderToolsPanel();
    this._switchRightTab(this._rightTab);
  },

  _renderToolsPanel() {
    const container = document.getElementById('toolsPanel');
    const views = {
      dashboard: () => this._renderDashboard(container),
      chars: () => this._renderCharsView(container),
      relations: () => this._renderRelationsView(container),
      locations: () => this._renderLocationsView(container),
      plots: () => this._renderPlotsView(container),
      hooks: () => this._renderHooksView(container),
      reversals: () => this._renderReversalsView(container),
      timeline: () => this._renderTimelineView(container),
      materials: () => this._renderMaterialsView(container),
      analytics: () => this._renderAnalyticsView(container),
    };
    views[this._toolView]?.();
  },

  _switchRightTab(tab) {
    this._rightTab = tab;
    document.querySelectorAll('#right-panel .right-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('toolsContent').classList.toggle('hidden', tab !== 'tools');
    document.getElementById('checkerContent').classList.toggle('hidden', tab !== 'checker');
    document.getElementById('aiContent').classList.toggle('hidden', tab !== 'ai');
    if (tab === 'checker') this._runChecker();
    if (tab === 'ai') this._renderAIChat();
  },

  _switchToolView(view) {
    this._toolView = view;
    this._switchRightTab('tools');
    this._renderToolsPanel();
  },

  // ===== 工具箱各视图 =====

  _toolNav(current) {
    const items = [
      ['dashboard','🏠','总览'],['chars','👥','人物'],['relations','🕸️','关系'],
      ['locations','📍','地点'],['plots','📋','情节'],['hooks','🪝','钩子'],
      ['reversals','🔄','反转'],['timeline','📅','时间线'],['materials','🗂️','素材'],
      ['analytics','📊','分析'],
    ];
    return `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)">
      ${items.map(([v,icon,label]) => `
        <button class="btn btn-sm ${v===current?'btn-primary':''}" onclick="App._switchToolView('${v}')" style="padding:2px 6px;font-size:10px">${icon} ${label}</button>
      `).join('')}
    </div>`;
  },

  _renderDashboard(container) {
    const totalWords = DB.chapters.reduce((s,c) => s + (c.wordCount||0), 0);
    const doneChapters = DB.chapters.filter(c => c.status === 'done').length;
    const openHooks = DB.hooks.filter(h => h.status === 'open').length;
    container.innerHTML = this._toolNav('dashboard') + `
      <div class="stat-grid" style="grid-template-columns:1fr 1fr">
        <div class="stat-card"><div class="stat-value">${DB.characters.length}</div><div class="stat-label">👥 人物</div></div>
        <div class="stat-card"><div class="stat-value">${DB.chapters.length}</div><div class="stat-label">📑 章节</div></div>
        <div class="stat-card"><div class="stat-value">${doneChapters}/${DB.chapters.length}</div><div class="stat-label">✅ 已完成</div></div>
        <div class="stat-card"><div class="stat-value">${openHooks}</div><div class="stat-label">🪝 待解答</div></div>
        <div class="stat-card" style="grid-column:1/-1"><div class="stat-value" style="font-size:18px">${totalWords.toLocaleString()}</div><div class="stat-label">✍️ 总字数</div></div>
      </div>
      <div style="font-size:12px;color:var(--text-dim);margin-top:8px">
        <div style="margin-bottom:6px;font-weight:600;color:var(--accent)">📖 ${esc(DB.project.name)}</div>
        ${DB.project.genre ? `<div>类型：${esc(DB.project.genre)}</div>` : ''}
        ${DB.project.status ? `<div>状态：${esc(DB.project.status)}</div>` : ''}
        ${DB.project.targetWords ? `<div>目标：${DB.project.targetWords.toLocaleString()} 字</div>` : ''}
      </div>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
        <button class="btn btn-sm" style="width:100%;margin-bottom:4px" onclick="App._reloadFromFiles()">🔄 从 data/ 文件重新加载数据</button>
        <div style="font-size:10px;color:var(--text-muted);text-align:center">首次使用或数据丢失时点击</div>
      </div>
    `;
  },

  // 手动触发从文件加载
  _reloadFromFiles() {
    Store.loadFromFiles().then(files => {
      if (!Object.keys(files).length) {
        this._toast('❌ 未找到 data/ 目录下的数据文件（需要本地服务器）');
        return;
      }
      this._migrateOldData(files);
      Store.saveAll();
      this._currentChapterId = Store.getCurrentChapter();
      this._renderAll();
      this._updateProjectName();
      this._updateStatus();
      this._toast('✅ 数据已从文件重新加载');
    });
  },

  _renderCharsView(container) {
    container.innerHTML = this._toolNav('chars') + `
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="btn btn-sm btn-primary" style="flex:1" onclick="App._openCharModal(null)">＋ 新建人物</button>
      </div>
      <div id="chars-view-list"></div>
    `;
    const list = container.querySelector('#chars-view-list');
    if (!DB.characters.length) {
      list.innerHTML = '<div class="template-empty">还没有人物</div>';
      return;
    }
    const statusMap = { alive:['存活','char-status-alive'], dead:['已故','char-status-dead'], soul:['残魂','char-status-soul'], unknown:['下落不明','char-status-unknown'] };
    DB.characters.forEach(ch => {
      const [statusLabel, statusClass] = statusMap[ch.status] || [];
      const tags = Array.isArray(ch.tags) ? ch.tags : (ch.tags||'').split(/[，,]/).filter(Boolean);
      const details = typeof ch.details === 'object' ? ch.details : {};
      const detailsHtml = Object.entries(details).map(([k,v]) => {
        const val = Array.isArray(v) ? v.join('；') : v;
        return `<div class="char-detail-item"><span class="char-detail-label">${esc(k)}：</span>${esc(val)}</div>`;
      }).join('');
      const card = document.createElement('div');
      card.className = 'char-card';
      card.innerHTML = `
        <div class="char-actions">
          <button class="btn btn-sm" data-action="edit" data-id="${ch.id}">✎</button>
          <button class="btn btn-sm char-btn-del" data-action="del" data-id="${ch.id}">✕</button>
        </div>
        <div class="char-name">${esc(ch.name)}</div>
        <div class="char-title-row">${esc(ch.title||'')}${statusLabel ? `<span class="char-status-badge ${statusClass}">${statusLabel}</span>` : ''}</div>
        ${tags.length ? `<div class="char-tags">${tags.map(t=>`<span class="char-tag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${ch.summary ? `<div class="char-summary">${esc(ch.summary)}</div>` : ''}
        ${Object.keys(details).length ? `<div class="char-details">${detailsHtml}</div><div class="char-expand-hint">▼ 点击展开</div>` : ''}
      `;
      card.addEventListener('click', e => {
        if (e.target.dataset.action) return;
        card.classList.toggle('expanded');
        const hint = card.querySelector('.char-expand-hint');
        if (hint) hint.textContent = card.classList.contains('expanded') ? '▲ 收起' : '▼ 点击展开';
      });
      card.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (btn.dataset.action === 'edit') this._openCharModal(btn.dataset.id);
          else if (btn.dataset.action === 'del') {
            if (confirm('确定删除？')) {
              DB.characters = DB.characters.filter(c => c.id !== btn.dataset.id);
              Store.save('characters', DB.characters);
              this._renderToolsPanel();
              this._renderCharList();
              this._toast('人物已删除');
            }
          }
        });
      });
      list.appendChild(card);
    });
  },

  _renderRelationsView(container) {
    container.innerHTML = this._toolNav('relations') + `
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="btn btn-sm btn-primary" style="flex:1" onclick="App._openRelModal()">＋ 添加关系</button>
      </div>
      <div id="rel-view-list"></div>
    `;
    const list = container.querySelector('#rel-view-list');
    if (!DB.relations.length) { list.innerHTML = '<div class="template-empty">还没有关系</div>'; return; }
    DB.relations.forEach(r => {
      const cA = DB.characters.find(c => c.id === r.charA);
      const cB = DB.characters.find(c => c.id === r.charB);
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div class="list-item-actions">
          <button class="btn btn-sm btn-danger" data-id="${r.id}">✕</button>
        </div>
        <div class="list-item-title">
          <span>${esc(cA?.name||'?')}</span>
          <span style="color:var(--accent)">—${esc(r.type==='自定义'?r.custom||r.type:r.type)}—</span>
          <span>${esc(cB?.name||'?')}</span>
        </div>
        ${r.desc ? `<div class="list-item-desc">${esc(r.desc)}</div>` : ''}
      `;
      item.querySelector('[data-id]').addEventListener('click', e => {
        e.stopPropagation();
        if (confirm('确定删除？')) {
          DB.relations = DB.relations.filter(x => x.id !== r.id);
          Store.save('relations', DB.relations);
          this._renderToolsPanel();
          this._toast('关系已删除');
        }
      });
      list.appendChild(item);
    });
  },

  _renderLocationsView(container) {
    container.innerHTML = this._toolNav('locations') + `
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="btn btn-sm btn-primary" style="flex:1" onclick="App._openLocModal(null)">＋ 新建地点</button>
      </div>
      <div id="loc-view-list"></div>
    `;
    const list = container.querySelector('#loc-view-list');
    if (!DB.locations.length) { list.innerHTML = '<div class="template-empty">还没有地点</div>'; return; }
    DB.locations.forEach(l => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div class="list-item-actions">
          <button class="btn btn-sm" data-action="edit" data-id="${l.id}">✎</button>
          <button class="btn btn-sm btn-danger" data-action="del" data-id="${l.id}">✕</button>
        </div>
        <div class="list-item-title">📍 ${esc(l.name)}</div>
        <div class="list-item-footer">
          ${l.type ? `<span class="tag">${esc(l.type)}</span>` : ''}
          ${l.mood ? `<span class="tag tag-accent">${esc(l.mood)}</span>` : ''}
          ${l.region ? `<span class="tag">${esc(l.region)}</span>` : ''}
        </div>
        ${l.desc ? `<div class="list-item-desc" style="margin-top:4px">${esc(l.desc.substring(0,80))}${l.desc.length>80?'...':''}</div>` : ''}
      `;
      item.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (btn.dataset.action === 'edit') this._openLocModal(btn.dataset.id);
          else if (btn.dataset.action === 'del') {
            if (confirm('确定删除？')) {
              DB.locations = DB.locations.filter(x => x.id !== btn.dataset.id);
              Store.save('locations', DB.locations);
              this._renderToolsPanel();
              this._toast('地点已删除');
            }
          }
        });
      });
      list.appendChild(item);
    });
  },

  _renderPlotsView(container) {
    container.innerHTML = this._toolNav('plots') + `
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="btn btn-sm btn-primary" style="flex:1" onclick="App._openPlotModal(null)">＋ 新建情节</button>
        <button class="btn btn-sm" onclick="App._addPlotColumn()">＋ 列</button>
      </div>
      <div style="overflow-x:auto;padding-bottom:4px">
        <div style="display:flex;gap:8px;min-width:max-content" id="plots-board"></div>
      </div>
    `;
    const board = container.querySelector('#plots-board');
    const columns = DB.plots.columns || [];
    const cards = DB.plots.cards || [];
    columns.forEach(col => {
      const colCards = cards.filter(c => c.col === col);
      const colEl = document.createElement('div');
      colEl.style.cssText = 'min-width:200px;max-width:220px;';
      colEl.innerHTML = `
        <div style="font-size:11px;font-weight:600;color:var(--accent);padding:6px 8px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between">
          <span>${esc(col)}</span><span style="color:var(--text-muted)">${colCards.length}</span>
        </div>
        <div style="padding:4px">
          ${colCards.map(c => `
            <div class="plot-card" onclick="App._openPlotModal('${c.id}')">
              <div class="plot-card-title">${esc(c.title)}</div>
              ${c.desc ? `<div class="plot-card-desc">${esc(c.desc)}</div>` : ''}
              <div class="plot-card-meta">
                ${c.mood ? `<span class="tag" style="font-size:9px">${esc(c.mood)}</span>` : ''}
                ${c.chars ? `<span class="tag tag-accent" style="font-size:9px">${esc(c.chars)}</span>` : ''}
              </div>
            </div>
          `).join('')}
          ${!colCards.length ? '<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:12px">空</div>' : ''}
        </div>
      `;
      board.appendChild(colEl);
    });
  },

  _renderHooksView(container) {
    container.innerHTML = this._toolNav('hooks') + `
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="btn btn-sm btn-primary" style="flex:1" onclick="App._openHookModal(null)">＋ 新建钩子</button>
      </div>
      <div id="hooks-view-list"></div>
    `;
    const list = container.querySelector('#hooks-view-list');
    if (!DB.hooks.length) { list.innerHTML = '<div class="template-empty">还没有钩子/伏笔</div>'; return; }
    const statusMap = { open:['未解答','tag-yellow'], closed:['已解答','tag-green'], intentional:['留白','tag-purple'] };
    const typeIcons = { 开篇钩子:'🎣', 悬念:'❓', 伏笔:'🌱', 反转铺垫:'⚡', 章末钩子:'🔚' };
    DB.hooks.forEach(h => {
      const [statusLabel, statusCls] = statusMap[h.status] || statusMap.open;
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div class="list-item-actions">
          <button class="btn btn-sm" data-action="edit" data-id="${h.id}">✎</button>
          <button class="btn btn-sm btn-danger" data-action="del" data-id="${h.id}">✕</button>
        </div>
        <div class="list-item-title">${typeIcons[h.type]||'🪝'} ${esc(h.title)}</div>
        <div class="list-item-footer">
          <span class="tag ${statusCls}">${statusLabel}</span>
          ${h.priority ? `<span class="tag">${esc(h.priority)}</span>` : ''}
          ${h.plant ? `<span class="tag tag-accent" style="font-size:9px">埋：${esc(h.plant)}</span>` : ''}
          ${h.harvest ? `<span class="tag tag-green" style="font-size:9px">收：${esc(h.harvest)}</span>` : ''}
        </div>
        ${h.desc ? `<div class="list-item-desc" style="margin-top:4px">${esc(h.desc.substring(0,80))}${h.desc.length>80?'...':''}</div>` : ''}
      `;
      item.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (btn.dataset.action === 'edit') this._openHookModal(btn.dataset.id);
          else if (btn.dataset.action === 'del') {
            if (confirm('确定删除？')) {
              DB.hooks = DB.hooks.filter(x => x.id !== btn.dataset.id);
              Store.save('hooks', DB.hooks);
              this._renderToolsPanel();
              this._toast('钩子已删除');
            }
          }
        });
      });
      list.appendChild(item);
    });
  },

  _renderReversalsView(container) {
    container.innerHTML = this._toolNav('reversals') + `
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="btn btn-sm btn-primary" style="flex:1" onclick="App._openReversalModal(null)">＋ 新建反转</button>
      </div>
      <div id="reversals-view-list"></div>
    `;
    const list = container.querySelector('#reversals-view-list');
    if (!DB.reversals.length) { list.innerHTML = '<div class="template-empty">还没有反转设计</div>'; return; }
    DB.reversals.forEach(r => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div class="list-item-actions">
          <button class="btn btn-sm" data-action="edit" data-id="${r.id}">✎</button>
          <button class="btn btn-sm btn-danger" data-action="del" data-id="${r.id}">✕</button>
        </div>
        <div class="list-item-title">🔄 ${esc(r.title)}</div>
        <div class="list-item-footer">
          ${r.type ? `<span class="tag tag-purple">${esc(r.type)}</span>` : ''}
          ${r.chapter ? `<span class="tag tag-accent">${esc(r.chapter)}</span>` : ''}
        </div>
        ${r.content ? `<div class="list-item-desc" style="margin-top:4px">${esc(r.content.substring(0,80))}${r.content.length>80?'...':''}</div>` : ''}
      `;
      item.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (btn.dataset.action === 'edit') this._openReversalModal(btn.dataset.id);
          else if (btn.dataset.action === 'del') {
            if (confirm('确定删除？')) {
              DB.reversals = DB.reversals.filter(x => x.id !== btn.dataset.id);
              Store.save('reversals', DB.reversals);
              this._renderToolsPanel();
              this._toast('反转已删除');
            }
          }
        });
      });
      list.appendChild(item);
    });
  },

  _renderTimelineView(container) {
    container.innerHTML = this._toolNav('timeline') + `
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="btn btn-sm btn-primary" style="flex:1" onclick="App._openTimelineModal(null)">＋ 添加事件</button>
      </div>
      <div class="timeline-list" id="timeline-view-list"></div>
    `;
    const list = container.querySelector('#timeline-view-list');
    if (!DB.timeline.length) { list.innerHTML = '<div class="template-empty">还没有时间线事件</div>'; return; }
    DB.timeline.forEach(t => {
      const item = document.createElement('div');
      item.className = `timeline-item${t.level==='major'?' major':''}`;
      item.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="timeline-date">${esc(t.time||'')}</div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm" data-action="edit" data-id="${t.id}" style="padding:1px 5px;font-size:10px">✎</button>
            <button class="btn btn-sm btn-danger" data-action="del" data-id="${t.id}" style="padding:1px 5px;font-size:10px">✕</button>
          </div>
        </div>
        <div class="timeline-title">${esc(t.title)}</div>
        ${t.desc ? `<div class="timeline-desc">${esc(t.desc.substring(0,80))}${t.desc.length>80?'...':''}</div>` : ''}
        ${t.chars ? `<div style="margin-top:4px"><span class="tag tag-accent" style="font-size:9px">${esc(t.chars)}</span></div>` : ''}
      `;
      item.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (btn.dataset.action === 'edit') this._openTimelineModal(btn.dataset.id);
          else if (btn.dataset.action === 'del') {
            if (confirm('确定删除？')) {
              DB.timeline = DB.timeline.filter(x => x.id !== btn.dataset.id);
              Store.save('timeline', DB.timeline);
              this._renderToolsPanel();
              this._toast('事件已删除');
            }
          }
        });
      });
      list.appendChild(item);
    });
  },

  _renderMaterialsView(container) {
    container.innerHTML = this._toolNav('materials') + `
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="btn btn-sm btn-primary" style="flex:1" onclick="App._openMaterialModal(null)">＋ 添加素材</button>
      </div>
      <div id="materials-view-list"></div>
    `;
    const list = container.querySelector('#materials-view-list');
    if (!DB.materials.length) { list.innerHTML = '<div class="template-empty">还没有素材</div>'; return; }
    const typeIcons = { 灵感:'💡', 金句:'✨', 意象:'🎨', 参考:'📚', 笔记:'📝', 对话:'💬' };
    DB.materials.forEach(m => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div class="list-item-actions">
          <button class="btn btn-sm" data-action="edit" data-id="${m.id}">✎</button>
          <button class="btn btn-sm btn-danger" data-action="del" data-id="${m.id}">✕</button>
        </div>
        <div class="list-item-title">${typeIcons[m.type]||'📄'} <span style="font-size:10px;color:var(--text-muted)">${esc(m.type)}</span></div>
        <div class="list-item-desc">${esc(m.content.substring(0,100))}${m.content.length>100?'...':''}</div>
        ${m.tags ? `<div class="list-item-footer"><span class="tag" style="font-size:9px">${esc(m.tags)}</span></div>` : ''}
      `;
      item.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (btn.dataset.action === 'edit') this._openMaterialModal(btn.dataset.id);
          else if (btn.dataset.action === 'del') {
            if (confirm('确定删除？')) {
              DB.materials = DB.materials.filter(x => x.id !== btn.dataset.id);
              Store.save('materials', DB.materials);
              this._renderToolsPanel();
              this._toast('素材已删除');
            }
          }
        });
      });
      list.appendChild(item);
    });
  },

  _renderAnalyticsView(container) {
    const totalWords = DB.chapters.reduce((s,c) => s + (c.wordCount||0), 0);
    const chapterWords = DB.chapters.map((c,i) => ({ label:`${i+1}`, value:c.wordCount||0 }));
    const maxWords = Math.max(...chapterWords.map(c => c.value), 1);
    container.innerHTML = this._toolNav('analytics') + `
      <div class="chart-container">
        <div class="chart-title">📊 各章字数</div>
        ${chapterWords.length ? `
          <div class="bar-chart">
            ${chapterWords.map(c => `<div class="bar" style="height:${Math.max(4,c.value/maxWords*100)}%" title="第${c.label}章: ${c.value}字"><div class="bar-label">${c.label}</div></div>`).join('')}
          </div>
        ` : '<div style="color:var(--text-muted);font-size:12px">暂无数据</div>'}
      </div>
      <div class="chart-container">
        <div class="chart-title">📈 创作概况</div>
        <div style="font-size:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>总字数：<strong style="color:var(--accent)">${totalWords.toLocaleString()}</strong></div>
          <div>总章节：<strong style="color:var(--accent)">${DB.chapters.length}</strong></div>
          <div>人物数：<strong style="color:var(--accent)">${DB.characters.length}</strong></div>
          <div>关系数：<strong style="color:var(--accent)">${DB.relations.length}</strong></div>
          <div>情节卡：<strong style="color:var(--accent)">${DB.plots.cards?.length||0}</strong></div>
          <div>钩子数：<strong style="color:var(--accent)">${DB.hooks.length}</strong></div>
        </div>
      </div>
      <div class="chart-container">
        <div class="chart-title">🪝 钩子状态</div>
        <div style="font-size:12px;display:flex;gap:12px">
          <span style="color:var(--yellow)">● 未解答 ${DB.hooks.filter(h=>h.status==='open').length}</span>
          <span style="color:var(--green)">● 已解答 ${DB.hooks.filter(h=>h.status==='closed').length}</span>
          <span style="color:var(--purple)">● 留白 ${DB.hooks.filter(h=>h.status==='intentional').length}</span>
        </div>
      </div>
    `;
  },

  // ===== 风格检查 =====
  _runChecker() {
    const container = document.getElementById('checkerResults');
    const text = document.getElementById('editor').value;
    if (!text.trim()) {
      container.innerHTML = '<div class="check-empty">编辑区为空，<br>请先写一些内容再检查。</div>';
      this._updateCheckerBadge(0);
      return;
    }
    const results = this._checkStyle(text);
    this._updateCheckerBadge(results.filter(r => r.severity === 'error').length);
    if (!results.length) {
      container.innerHTML = '<div class="check-empty" style="color:var(--green)">✓ 未发现风格问题</div>';
      return;
    }
    const summary = { error:0, warn:0, info:0 };
    results.forEach(r => summary[r.severity] = (summary[r.severity]||0) + 1);
    let html = `<div class="check-summary">
      <span class="check-summary-item"><span class="check-summary-dot error"></span>错误 ${summary.error}</span>
      <span class="check-summary-item"><span class="check-summary-dot warn"></span>警告 ${summary.warn}</span>
      <span class="check-summary-item"><span class="check-summary-dot info"></span>提示 ${summary.info}</span>
    </div>`;
    results.forEach(r => {
      const cls = r.severity === 'error' ? 'sev-error' : r.severity === 'warn' ? 'sev-warn' : 'sev-info';
      const label = r.severity === 'error' ? '错误' : r.severity === 'warn' ? '警告' : '提示';
      html += `<div class="check-result-item ${cls}" data-line="${r.line}">
        <div class="check-result-line">第${r.line+1}行 · <span class="check-result-type ${r.severity}-tag">${label}</span>${esc(r.type)}</div>
        <div class="check-result-msg">${esc(r.message)}</div>
      </div>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('.check-result-item[data-line]').forEach(el => {
      el.addEventListener('click', () => {
        const lineNum = parseInt(el.dataset.line);
        const editor = document.getElementById('editor');
        const lines = editor.value.split('\n');
        let pos = 0;
        for (let i = 0; i < Math.min(lineNum, lines.length); i++) pos += lines[i].length + 1;
        editor.focus();
        editor.setSelectionRange(pos, pos);
        editor.scrollTop = Math.max(0, lineNum * 32 - 100);
      });
    });
  },

  _checkStyle(text) {
    const results = [];
    const lines = text.split('\n');
    const bannedWords = [
      { word:'恐怖', level:'error', msg:'禁用词"恐怖"，请替换为具体感官细节' },
      { word:'可怕', level:'error', msg:'禁用词"可怕"，请替换为具体感官细节' },
      { word:'毛骨悚然', level:'error', msg:'禁用词"毛骨悚然"，请替换为具体感官细节' },
      { word:'泪流满面', level:'error', msg:'禁用煽情词，用白描替代' },
      { word:'心如刀割', level:'error', msg:'禁用煽情词，用白描替代' },
      { word:'肝肠寸断', level:'error', msg:'禁用煽情词，用白描替代' },
      { word:'震惊！', level:'error', msg:'禁用网文套路' },
      { word:'这怎么可能！', level:'error', msg:'禁用网文套路' },
      { word:'竟然', level:'warn', msg:'慎用"竟然"，本段已出现多次' },
      { word:'居然', level:'warn', msg:'慎用"居然"，本段已出现多次' },
      { word:'这就是', level:'warn', msg:'疑似解释性旁白，请删除或改为角色视角' },
      { word:'众所周知', level:'warn', msg:'疑似解释性旁白' },
    ];
    lines.forEach((line, i) => {
      bannedWords.forEach(rule => {
        if (line.includes(rule.word)) {
          results.push({ line:i, severity:rule.level, type:'禁用词', message:rule.msg });
        }
      });
      // 检查段落过长
      if (line.length > 200) {
        results.push({ line:i, severity:'warn', type:'段落', message:`本段超过200字（${line.length}字），建议拆分` });
      }
      // 检查连续感叹号
      if (/！{3,}/.test(line)) {
        results.push({ line:i, severity:'warn', type:'标点', message:'连续感叹号过多，建议精简' });
      }
    });
    return results;
  },

  _updateCheckerBadge(count) {
    const badge = document.getElementById('checkerBadge');
    if (count > 0) { badge.textContent = count; badge.style.display = 'inline'; }
    else badge.style.display = 'none';
  },

  // ===== AI 助手 =====
  _renderAIChat() {
    const container = document.getElementById('aiMessages');
    const history = Store.loadAIHistory();
    container.innerHTML = '';
    if (!history.length) {
      container.innerHTML = `<div class="ai-msg system-msg">AI 续写助手已就绪。<br>选中编辑区文本后点击预设标签，或直接输入指令。</div>`;
    }
    history.slice(-10).forEach(msg => {
      const div = document.createElement('div');
      div.className = `ai-msg ${msg.role}`;
      div.textContent = msg.content.substring(0, 500) + (msg.content.length > 500 ? '...' : '');
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
    const presetsContainer = document.getElementById('aiPresets');
    presetsContainer.innerHTML = '';
    const presets = [
      { label:'续写', prompt:'请根据上下文续写下一段，保持风格一致' },
      { label:'改写', prompt:'请改写这段文字，使其更加生动' },
      { label:'扩写', prompt:'请扩写这段内容，增加细节描写' },
      { label:'对话', prompt:'请为这段场景补充人物对话' },
      { label:'环境', prompt:'请为这段场景增加环境描写' },
    ];
    presets.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'ai-preset-btn';
      btn.textContent = p.label;
      btn.addEventListener('click', () => this._aiPreset(p));
      presetsContainer.appendChild(btn);
    });
    document.getElementById('ollamaUrl').value = Store.getOllamaUrl();
    document.getElementById('ollamaModel').value = Store.getOllamaModel();
  },

  _aiPreset(preset) {
    const editor = document.getElementById('editor');
    const start = editor.selectionStart, end = editor.selectionEnd;
    const context = start !== end ? editor.value.substring(start, end) : editor.value.substring(0, Math.min(editor.value.length, 500));
    if (!context.trim()) { this._toast('请先写一些内容'); return; }
    this._sendAI(`【${preset.label}】\n${context}`, preset.prompt + '\n\n' + context);
  },

  _sendAIMessage() {
    const input = document.getElementById('aiInput');
    const userText = input.value.trim();
    if (!userText) return;
    const editor = document.getElementById('editor');
    const start = editor.selectionStart, end = editor.selectionEnd;
    const context = start !== end ? editor.value.substring(start, end) : editor.value.substring(0, Math.min(editor.value.length, 800));
    const fullPrompt = context ? `【上下文】\n${context}\n\n【指令】\n${userText}` : userText;
    input.value = '';
    this._sendAI(userText, fullPrompt);
  },

  _sendAI(displayText, prompt) {
    this._addAIMsg('user', displayText);
    this._addAIMsg('assistant', '...');
    const url = Store.getOllamaUrl();
    const model = Store.getOllamaModel();
    const history = Store.loadAIHistory();
    history.push({ role:'user', content:displayText });
    let fullText = '';
    const msgs = document.getElementById('aiMessages').children;
    const lastMsg = msgs[msgs.length - 1];
    fetch(`${url}/api/generate`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ model, prompt, stream:true }),
      signal:(this._aiAbortCtrl = new AbortController()).signal,
    }).then(resp => {
      const reader = resp.body.getReader();
      const read = () => reader.read().then(({ done, value }) => {
        if (done) {
          history.push({ role:'assistant', content:fullText });
          Store.saveAIHistory(history);
          return;
        }
        const text = new TextDecoder().decode(value);
        text.split('\n').filter(Boolean).forEach(line => {
          try { const d = JSON.parse(line); if (d.response) { fullText += d.response; if (lastMsg) { if (lastMsg.textContent === '...') lastMsg.textContent = ''; lastMsg.textContent += d.response; } } } catch(e) {}
        });
        document.getElementById('aiMessages').scrollTop = document.getElementById('aiMessages').scrollHeight;
        read();
      });
      read();
    }).catch(err => {
      if (err.name !== 'AbortError') this._addAIMsg('system-msg', `❌ ${err.message}`);
    });
  },

  _addAIMsg(role, content) {
    const container = document.getElementById('aiMessages');
    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    div.textContent = content;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  },

  _insertAIText() {
    const msgs = document.getElementById('aiMessages').children;
    let lastText = '';
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].classList.contains('assistant') && msgs[i].textContent !== '...') {
        lastText = msgs[i].textContent; break;
      }
    }
    if (!lastText) return;
    const editor = document.getElementById('editor');
    const end = editor.selectionEnd;
    const before = editor.value.substring(0, end);
    const after = editor.value.substring(end);
    const insert = (before.endsWith('\n') || before === '' ? '' : '\n') + lastText + '\n';
    editor.value = before + insert + after;
    editor.setSelectionRange(end + insert.length, end + insert.length);
    editor.focus();
    this._unsaved = true;
    this._updateStatus();
    this._toast('已插入到编辑区 ✓');
  },

  // ===== 模态框 =====

  _openModal(id) { document.getElementById(id).classList.add('active'); },
  _closeModal(id) { document.getElementById(id).classList.remove('active'); this._editingId = null; },

  openProjectModal() {
    document.getElementById('proj-name').value = DB.project.name || '';
    document.getElementById('proj-author').value = DB.project.author || '';
    document.getElementById('proj-genre').value = DB.project.genre || '';
    document.getElementById('proj-desc').value = DB.project.desc || '';
    document.getElementById('proj-target').value = DB.project.targetWords || '';
    document.getElementById('proj-status').value = DB.project.status || '构思中';
    this._openModal('modal-project');
  },

  _saveProject() {
    DB.project.name = document.getElementById('proj-name').value.trim() || '未命名作品';
    DB.project.author = document.getElementById('proj-author').value.trim();
    DB.project.genre = document.getElementById('proj-genre').value.trim();
    DB.project.desc = document.getElementById('proj-desc').value.trim();
    DB.project.targetWords = parseInt(document.getElementById('proj-target').value) || 0;
    DB.project.status = document.getElementById('proj-status').value;
    Store.save('project', DB.project);
    this._updateProjectName();
    this._closeModal('modal-project');
    this._toast('项目信息已保存 ✓');
  },

  _openChapterModal(id) {
    this._editingId = id || null;
    document.getElementById('chapterModalTitle').textContent = id ? '编辑章节' : '新建章节';
    if (id) {
      const ch = DB.chapters.find(c => c.id === id);
      if (!ch) return;
      document.getElementById('ch-title').value = ch.title || '';
      document.getElementById('ch-status').value = ch.status || 'draft';
      document.getElementById('ch-mood').value = ch.mood || '紧张';
      document.getElementById('ch-chars').value = ch.chars || '';
      document.getElementById('ch-summary').value = ch.summary || '';
      document.getElementById('ch-outline').value = ch.outline || '';
    } else {
      ['ch-title','ch-chars','ch-summary','ch-outline'].forEach(f => document.getElementById(f).value = '');
      document.getElementById('ch-status').value = 'draft';
      document.getElementById('ch-mood').value = '紧张';
    }
    this._openModal('modal-chapter');
    setTimeout(() => document.getElementById('ch-title').focus(), 100);
  },

  _saveChapter() {
    const title = document.getElementById('ch-title').value.trim();
    if (!title) { this._toast('请输入章节标题'); return; }
    const cd = {
      title, status:document.getElementById('ch-status').value,
      mood:document.getElementById('ch-mood').value,
      chars:document.getElementById('ch-chars').value.trim(),
      summary:document.getElementById('ch-summary').value.trim(),
      outline:document.getElementById('ch-outline').value.trim(),
    };
    if (this._editingId) {
      const i = DB.chapters.findIndex(c => c.id === this._editingId);
      if (i !== -1) DB.chapters[i] = { ...DB.chapters[i], ...cd };
    } else {
      DB.chapters.push({ id:genId(), ...cd, content:'', wordCount:0 });
    }
    Store.save('chapters', DB.chapters);
    this._closeModal('modal-chapter');
    this._renderChapterList();
    this._updateStatus();
    this._toast(this._editingId ? '章节已更新 ✓' : '章节已创建 ✓');
  },

  _deleteChapter(id) {
    if (!confirm('确定删除该章节？正文内容也会丢失！')) return;
    DB.chapters = DB.chapters.filter(c => c.id !== id);
    if (this._currentChapterId === id) {
      this._currentChapterId = null;
      document.getElementById('editor').value = '';
      document.getElementById('editorTitle').textContent = '请从左侧选择章节开始写作';
    }
    Store.save('chapters', DB.chapters);
    this._renderChapterList();
    this._updateStatus();
    this._toast('章节已删除');
  },

  _openCharModal(id) {
    this._editingId = id || null;
    document.getElementById('charModalTitle').textContent = id ? '编辑人物' : '新建人物';
    if (id) {
      const ch = DB.characters.find(c => c.id === id);
      if (!ch) return;
      document.getElementById('char-name').value = ch.name || '';
      document.getElementById('char-title').value = ch.title || '';
      document.getElementById('char-status').value = ch.status || 'alive';
      const tags = Array.isArray(ch.tags) ? ch.tags : (ch.tags||'').split(/[，,]/).filter(Boolean);
      document.getElementById('char-tags').value = tags.join('，');
      document.getElementById('char-summary').value = ch.summary || '';
      const details = typeof ch.details === 'object' ? ch.details : {};
      document.getElementById('char-details').value = Object.entries(details).map(([k,v]) => `${k}：${Array.isArray(v)?v.join('；'):v}`).join('\n');
    } else {
      ['char-name','char-title','char-tags','char-summary','char-details'].forEach(f => document.getElementById(f).value = '');
      document.getElementById('char-status').value = 'alive';
    }
    this._openModal('modal-char');
    setTimeout(() => document.getElementById('char-name').focus(), 100);
  },

  _saveChar() {
    const name = document.getElementById('char-name').value.trim();
    if (!name) { this._toast('请输入姓名'); return; }
    const detailsText = document.getElementById('char-details').value.trim();
    const details = {};
    if (detailsText) {
      detailsText.split('\n').forEach(line => {
        const idx = line.indexOf('：');
        if (idx > 0) details[line.slice(0,idx).trim()] = line.slice(idx+1).trim();
        else { const idx2 = line.indexOf(':'); if (idx2 > 0) details[line.slice(0,idx2).trim()] = line.slice(idx2+1).trim(); }
      });
    }
    const cd = {
      name, title:document.getElementById('char-title').value.trim(),
      status:document.getElementById('char-status').value,
      tags:document.getElementById('char-tags').value.split(/[，,]/).map(t=>t.trim()).filter(Boolean),
      summary:document.getElementById('char-summary').value.trim(),
      details,
    };
    if (this._editingId) {
      const i = DB.characters.findIndex(c => c.id === this._editingId);
      if (i !== -1) DB.characters[i] = { ...DB.characters[i], ...cd };
    } else {
      DB.characters.push({ id:genId(), ...cd });
    }
    Store.save('characters', DB.characters);
    this._closeModal('modal-char');
    this._renderCharList();
    if (this._toolView === 'chars') this._renderToolsPanel();
    this._toast(this._editingId ? '人物已更新 ✓' : '人物已创建 ✓');
  },

  _openRelModal() {
    if (!DB.characters.length) { this._toast('请先创建人物'); return; }
    const opts = DB.characters.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    document.getElementById('rel-charA').innerHTML = opts;
    document.getElementById('rel-charB').innerHTML = opts;
    if (DB.characters.length > 1) document.getElementById('rel-charB').selectedIndex = 1;
    document.getElementById('rel-type').value = '友情';
    document.getElementById('rel-custom').value = '';
    document.getElementById('rel-desc').value = '';
    this._openModal('modal-rel');
  },

  _saveRel() {
    const cA = document.getElementById('rel-charA').value, cB = document.getElementById('rel-charB').value;
    if (cA === cB) { this._toast('不能选择同一个人物'); return; }
    DB.relations.push({ id:genId(), charA:cA, charB:cB, type:document.getElementById('rel-type').value, custom:document.getElementById('rel-custom').value.trim(), desc:document.getElementById('rel-desc').value.trim() });
    Store.save('relations', DB.relations);
    this._closeModal('modal-rel');
    if (this._toolView === 'relations') this._renderToolsPanel();
    this._toast('关系已添加 ✓');
  },

  _openLocModal(id) {
    this._editingId = id || null;
    document.getElementById('locModalTitle').textContent = id ? '编辑地点' : '新建地点';
    if (id) {
      const l = DB.locations.find(x => x.id === id);
      if (!l) return;
      document.getElementById('loc-name').value = l.name || '';
      document.getElementById('loc-region').value = l.region || '';
      document.getElementById('loc-type').value = l.type || '城市';
      document.getElementById('loc-mood').value = l.mood || '宁静';
      document.getElementById('loc-desc').value = l.desc || '';
    } else {
      ['loc-name','loc-region','loc-desc'].forEach(f => document.getElementById(f).value = '');
      document.getElementById('loc-type').value = '城市';
      document.getElementById('loc-mood').value = '宁静';
    }
    this._openModal('modal-loc');
  },

  _saveLoc() {
    const name = document.getElementById('loc-name').value.trim();
    if (!name) { this._toast('请输入地点名称'); return; }
    const ld = { name, region:document.getElementById('loc-region').value.trim(), type:document.getElementById('loc-type').value, mood:document.getElementById('loc-mood').value, desc:document.getElementById('loc-desc').value.trim() };
    if (this._editingId) {
      const i = DB.locations.findIndex(x => x.id === this._editingId);
      if (i !== -1) DB.locations[i] = { ...DB.locations[i], ...ld };
    } else {
      DB.locations.push({ id:genId(), ...ld });
    }
    Store.save('locations', DB.locations);
    this._closeModal('modal-loc');
    if (this._toolView === 'locations') this._renderToolsPanel();
    this._toast(this._editingId ? '地点已更新 ✓' : '地点已创建 ✓');
  },

  _openPlotModal(id) {
    this._editingId = id || null;
    const colSel = document.createElement('select');
    colSel.id = 'plot-col';
    (DB.plots.columns||[]).forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; colSel.appendChild(o); });
    // 复用hook modal结构，这里直接用prompt简化
    const title = prompt('情节标题：');
    if (!title?.trim()) return;
    const col = prompt('所属阶段（' + (DB.plots.columns||[]).join('/')+' ）：', DB.plots.columns?.[0]||'');
    if (!col) return;
    const desc = prompt('描述（可选）：') || '';
    if (!DB.plots.cards) DB.plots.cards = [];
    if (id) {
      const i = DB.plots.cards.findIndex(x => x.id === id);
      if (i !== -1) DB.plots.cards[i] = { ...DB.plots.cards[i], title:title.trim(), col, desc };
    } else {
      DB.plots.cards.push({ id:genId(), title:title.trim(), col, desc });
    }
    Store.save('plots', DB.plots);
    if (this._toolView === 'plots') this._renderToolsPanel();
    this._toast('情节已保存 ✓');
  },

  _addPlotColumn() {
    const name = prompt('输入新列名称：');
    if (!name?.trim()) return;
    if (!DB.plots.columns) DB.plots.columns = [];
    DB.plots.columns.push(name.trim());
    Store.save('plots', DB.plots);
    if (this._toolView === 'plots') this._renderToolsPanel();
  },

  _openHookModal(id) {
    this._editingId = id || null;
    document.getElementById('hookModalTitle').textContent = id ? '编辑钩子' : '新建钩子/伏笔';
    if (id) {
      const h = DB.hooks.find(x => x.id === id);
      if (!h) return;
      document.getElementById('hook-title').value = h.title || '';
      document.getElementById('hook-type').value = h.type || '悬念';
      document.getElementById('hook-desc').value = h.desc || '';
      document.getElementById('hook-plant').value = h.plant || '';
      document.getElementById('hook-harvest').value = h.harvest || '';
      document.getElementById('hook-status').value = h.status || 'open';
      document.getElementById('hook-priority').value = h.priority || '中';
    } else {
      ['hook-title','hook-desc','hook-plant','hook-harvest'].forEach(f => document.getElementById(f).value = '');
      document.getElementById('hook-type').value = '悬念';
      document.getElementById('hook-status').value = 'open';
      document.getElementById('hook-priority').value = '中';
    }
    this._openModal('modal-hook');
    setTimeout(() => document.getElementById('hook-title').focus(), 100);
  },

  _saveHook() {
    const title = document.getElementById('hook-title').value.trim();
    if (!title) { this._toast('请输入标题'); return; }
    const hd = { title, type:document.getElementById('hook-type').value, desc:document.getElementById('hook-desc').value.trim(), plant:document.getElementById('hook-plant').value.trim(), harvest:document.getElementById('hook-harvest').value.trim(), status:document.getElementById('hook-status').value, priority:document.getElementById('hook-priority').value };
    if (this._editingId) {
      const i = DB.hooks.findIndex(x => x.id === this._editingId);
      if (i !== -1) DB.hooks[i] = { ...DB.hooks[i], ...hd };
    } else {
      DB.hooks.push({ id:genId(), ...hd });
    }
    Store.save('hooks', DB.hooks);
    this._closeModal('modal-hook');
    if (this._toolView === 'hooks') this._renderToolsPanel();
    this._toast(this._editingId ? '钩子已更新 ✓' : '钩子已创建 ✓');
  },

  _openReversalModal(id) {
    this._editingId = id || null;
    document.getElementById('reversalModalTitle').textContent = id ? '编辑反转' : '新建反转';
    if (id) {
      const r = DB.reversals.find(x => x.id === id);
      if (!r) return;
      document.getElementById('rev-title').value = r.title || '';
      document.getElementById('rev-type').value = r.type || '身份反转';
      document.getElementById('rev-content').value = r.content || '';
      document.getElementById('rev-foreshadow').value = r.foreshadow || '';
      document.getElementById('rev-chapter').value = r.chapter || '';
      document.getElementById('rev-chars').value = r.chars || '';
    } else {
      ['rev-title','rev-content','rev-foreshadow','rev-chapter','rev-chars'].forEach(f => document.getElementById(f).value = '');
      document.getElementById('rev-type').value = '身份反转';
    }
    this._openModal('modal-reversal');
    setTimeout(() => document.getElementById('rev-title').focus(), 100);
  },

  _saveReversal() {
    const title = document.getElementById('rev-title').value.trim();
    if (!title) { this._toast('请输入标题'); return; }
    const rd = { title, type:document.getElementById('rev-type').value, content:document.getElementById('rev-content').value.trim(), foreshadow:document.getElementById('rev-foreshadow').value.trim(), chapter:document.getElementById('rev-chapter').value.trim(), chars:document.getElementById('rev-chars').value.trim() };
    if (this._editingId) {
      const i = DB.reversals.findIndex(x => x.id === this._editingId);
      if (i !== -1) DB.reversals[i] = { ...DB.reversals[i], ...rd };
    } else {
      DB.reversals.push({ id:genId(), ...rd });
    }
    Store.save('reversals', DB.reversals);
    this._closeModal('modal-reversal');
    if (this._toolView === 'reversals') this._renderToolsPanel();
    this._toast(this._editingId ? '反转已更新 ✓' : '反转已创建 ✓');
  },

  _openTimelineModal(id) {
    this._editingId = id || null;
    document.getElementById('timelineModalTitle').textContent = id ? '编辑事件' : '添加事件';
    if (id) {
      const t = DB.timeline.find(x => x.id === id);
      if (!t) return;
      document.getElementById('tl-time').value = t.time || '';
      document.getElementById('tl-level').value = t.level || 'normal';
      document.getElementById('tl-title').value = t.title || '';
      document.getElementById('tl-desc').value = t.desc || '';
      document.getElementById('tl-chars').value = t.chars || '';
    } else {
      ['tl-time','tl-title','tl-desc','tl-chars'].forEach(f => document.getElementById(f).value = '');
      document.getElementById('tl-level').value = 'normal';
    }
    this._openModal('modal-timeline');
    setTimeout(() => document.getElementById('tl-time').focus(), 100);
  },

  _saveTimeline() {
    const title = document.getElementById('tl-title').value.trim();
    const time = document.getElementById('tl-time').value.trim();
    if (!title || !time) { this._toast('请填写时间和标题'); return; }
    const td = { time, title, level:document.getElementById('tl-level').value, desc:document.getElementById('tl-desc').value.trim(), chars:document.getElementById('tl-chars').value.trim() };
    if (this._editingId) {
      const i = DB.timeline.findIndex(x => x.id === this._editingId);
      if (i !== -1) DB.timeline[i] = { ...DB.timeline[i], ...td };
    } else {
      DB.timeline.push({ id:genId(), ...td });
    }
    Store.save('timeline', DB.timeline);
    this._closeModal('modal-timeline');
    if (this._toolView === 'timeline') this._renderToolsPanel();
    this._toast(this._editingId ? '事件已更新 ✓' : '事件已添加 ✓');
  },

  _openMaterialModal(id) {
    this._editingId = id || null;
    document.getElementById('materialModalTitle').textContent = id ? '编辑素材' : '添加素材';
    if (id) {
      const m = DB.materials.find(x => x.id === id);
      if (!m) return;
      document.getElementById('mat-type').value = m.type || '灵感';
      document.getElementById('mat-tags').value = m.tags || '';
      document.getElementById('mat-content').value = m.content || '';
      document.getElementById('mat-source').value = m.source || '';
    } else {
      ['mat-tags','mat-content','mat-source'].forEach(f => document.getElementById(f).value = '');
      document.getElementById('mat-type').value = '灵感';
    }
    this._openModal('modal-material');
    setTimeout(() => document.getElementById('mat-content').focus(), 100);
  },

  _saveMaterial() {
    const content = document.getElementById('mat-content').value.trim();
    if (!content) { this._toast('请输入内容'); return; }
    const md = { type:document.getElementById('mat-type').value, tags:document.getElementById('mat-tags').value.trim(), content, source:document.getElementById('mat-source').value.trim() };
    if (this._editingId) {
      const i = DB.materials.findIndex(x => x.id === this._editingId);
      if (i !== -1) DB.materials[i] = { ...DB.materials[i], ...md };
    } else {
      DB.materials.push({ id:genId(), ...md });
    }
    Store.save('materials', DB.materials);
    this._closeModal('modal-material');
    if (this._toolView === 'materials') this._renderToolsPanel();
    this._toast(this._editingId ? '素材已更新 ✓' : '素材已添加 ✓');
  },

  // ===== 事件绑定 =====
  _bindEvents() {
    // 编辑器输入
    document.getElementById('editor').addEventListener('input', () => {
      this._unsaved = true;
      this._updateStatus();
    });

    // 左侧tab
    document.querySelectorAll('#left-panel .panel-tab').forEach(tab => {
      tab.addEventListener('click', () => this._switchLeftTab(tab.dataset.tab));
    });

    // 右侧tab
    document.querySelectorAll('#right-panel .right-tab').forEach(tab => {
      tab.addEventListener('click', () => this._switchRightTab(tab.dataset.tab));
    });

    // 顶栏按钮
    document.getElementById('btnSave').addEventListener('click', () => { this._saveCurrent(); Store.saveAll(); this._toast('已保存 ✓'); });
    document.getElementById('btnPrev').addEventListener('click', () => this._goPrev());
    document.getElementById('btnNext').addEventListener('click', () => this._goNext());
    document.getElementById('btnCheck').addEventListener('click', () => { this._switchRightTab('checker'); this._runChecker(); });

    // 导出/导入
    document.getElementById('btnExport').addEventListener('click', () => {
      const blob = new Blob([Store.exportAll()], { type:'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${DB.project.name||'小说'}_备份_${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      this._toast('数据已导出 ✓');
    });
    document.getElementById('btnImport').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.onchange = e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          if (Store.importAll(ev.target.result)) {
            Store.loadAll(); this._renderAll(); this._updateProjectName();
            this._toast('数据已导入 ✓');
          } else this._toast('导入失败，文件格式有误');
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // 模态框保存按钮
    document.getElementById('btnSaveProject').addEventListener('click', () => this._saveProject());
    document.getElementById('btnSaveChapter').addEventListener('click', () => this._saveChapter());
    document.getElementById('btnSaveChar').addEventListener('click', () => this._saveChar());
    document.getElementById('btnSaveRel').addEventListener('click', () => this._saveRel());
    document.getElementById('btnSaveLoc').addEventListener('click', () => this._saveLoc());
    document.getElementById('btnSaveHook').addEventListener('click', () => this._saveHook());
    document.getElementById('btnSaveReversal').addEventListener('click', () => this._saveReversal());
    document.getElementById('btnSaveTimeline').addEventListener('click', () => this._saveTimeline());
    document.getElementById('btnSaveMaterial').addEventListener('click', () => this._saveMaterial());

    // 模态框关闭
    document.querySelectorAll('.modal-close,.modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        const overlay = btn.closest('.modal-overlay');
        if (overlay) { overlay.classList.remove('active'); this._editingId = null; }
      });
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) { overlay.classList.remove('active'); this._editingId = null; }
      });
    });

    // AI
    document.getElementById('btnAiSend').addEventListener('click', () => this._sendAIMessage());
    document.getElementById('aiInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendAIMessage(); } });
    document.getElementById('btnAiStop').addEventListener('click', () => this._aiAbortCtrl?.abort());
    document.getElementById('btnAiClear').addEventListener('click', () => { Store.clearAIHistory(); this._renderAIChat(); });
    document.getElementById('btnAiInsert').addEventListener('click', () => this._insertAIText());
    document.getElementById('ollamaUrl').addEventListener('change', e => Store.setOllamaUrl(e.target.value));
    document.getElementById('ollamaModel').addEventListener('change', e => Store.setOllamaModel(e.target.value));

    // 快捷键
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
          case 's': e.preventDefault(); this._saveCurrent(); Store.saveAll(); this._toast('已保存 ✓'); break;
          case 'j': e.preventDefault(); this._goNext(); break;
          case 'k': e.preventDefault(); this._goPrev(); break;
          case 'l': e.preventDefault(); this._switchRightTab('checker'); this._runChecker(); break;
          case 'i': e.preventDefault(); this._switchRightTab('ai'); this._renderAIChat(); document.getElementById('aiInput').focus(); break;
        }
      }
    });

    // 离开前保存
    window.addEventListener('beforeunload', () => { if (this._unsaved) this._saveCurrent(); });
  },

  // ===== 自动保存 =====
  _startAutoSave() {
    this._autoSaveTimer = setInterval(() => { if (this._unsaved) this._saveCurrent(); }, 30000);
  },

  // ===== 状态更新 =====
  _updateStatus() {
    const chId = this._currentChapterId;
    const wc = chId ? this._getWordCount(chId) : 0;
    const totalWc = DB.chapters.reduce((s,c) => s + (c.wordCount||0), 0);
    document.getElementById('wordCount').textContent = `本章 ${wc} 字`;
    document.getElementById('statusChapterWc').textContent = `本章 ${wc} 字`;
    document.getElementById('statusTotalWc').textContent = `总计 ${totalWc.toLocaleString()} 字`;
    document.getElementById('saveDot').className = `status-dot ${this._unsaved ? 'unsaved' : 'saved'}`;
  },

  _updateProjectName() {
    document.getElementById('projectName').textContent = `📖 ${DB.project.name || '小说工作台'}`;
    document.title = DB.project.name || '小说工作台';
  },

  // ===== Toast =====
  _toast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
  },
};

// 全局暴露（供HTML内联onclick使用）
window.App = App;
function openProjectModal() { App.openProjectModal(); }

document.addEventListener('DOMContentLoaded', () => App.init());