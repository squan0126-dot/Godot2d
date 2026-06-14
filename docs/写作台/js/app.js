// ============================================================
// 主控制器 —— 三栏布局、事件绑定、数据流
// ============================================================

const App = {

  // ---- 状态 ----
  _currentCaseId: null,
  _currentChapterId: null,
  _unsaved: false,
  _autoSaveTimer: null,
  _leftTab: 'cases',   // cases | template | chars
  _rightTab: 'checker', // checker | ai
  _charEditMode: false,

  // ---- 初始化 ----

  init() {
    Project.init();
    AI.init();

    this._currentCaseId = Project.getCurrentCaseId();
    this._currentChapterId = Project.getCurrentChapterId();

    this._renderLeftPanel();
    this._renderEditor();
    this._renderRightPanel();
    this._bindEvents();
    this._startAutoSave();

    // 恢复上次编辑内容
    if (this._currentChapterId) {
      const content = Project.loadContent(this._currentChapterId);
      if (content) {
        document.getElementById('editor').value = content;
        this._updateStatus();
      }
    }

    this._updateStatus();
  },

  // ---- 左侧面板渲染 ----

  _renderLeftPanel() {
    this._renderCaseList();
    this._renderTemplate();
    this._renderCharacterCards();
    this._switchLeftTab(this._leftTab);
  },

  _renderCaseList() {
    const container = document.getElementById('caseList');
    container.innerHTML = '';

    // 进度条
    const prog = Project.getOverallProgress();
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = `<div class="progress-fill" style="width:${prog.percent}%"></div>`;
    container.appendChild(progressBar);

    CASES.forEach(c => {
      const isActive = c.id === this._currentCaseId;
      const isCompleted = Project.isCaseCompleted(c.id);

      const item = document.createElement('div');
      item.className = 'case-item';

      const header = document.createElement('div');
      header.className = `case-header${isActive ? ' active' : ''}${isCompleted ? ' completed' : ''}`;
      header.innerHTML = `
        <span class="case-arrow${isActive ? ' expanded' : ''}">▶</span>
        <span class="case-title">${c.title}</span>
        <span class="case-check${isCompleted ? ' done' : ''}" data-case="${c.id}">${isCompleted ? '✓' : '○'}</span>
      `;
      header.addEventListener('click', (e) => {
        if (e.target.classList.contains('case-check')) {
          // 切换完成状态
          const done = Project.toggleCaseCompleted(c.id);
          e.target.textContent = done ? '✓' : '○';
          e.target.classList.toggle('done', done);
          header.classList.toggle('completed', done);
          this._updateStatus();
          return;
        }
        this._selectCase(c.id);
      });

      const chapters = document.createElement('div');
      chapters.className = `case-chapters${isActive ? ' open' : ''}`;

      c.chapters.forEach(ch => {
        const chItem = document.createElement('div');
        chItem.className = `chapter-item${ch.id === this._currentChapterId ? ' active' : ''}`;
        const wc = Project.getWordCount(ch.id);
        chItem.innerHTML = `
          <span class="chapter-dot"></span>
          <span>${ch.title}</span>
          ${wc > 0 ? `<span class="chapter-wc">${wc}字</span>` : ''}
        `;
        chItem.addEventListener('click', () => this._selectChapter(c.id, ch.id));
        chapters.appendChild(chItem);
      });

      item.appendChild(header);
      item.appendChild(chapters);
      container.appendChild(item);
    });
  },

  _renderTemplate() {
    const container = document.getElementById('templateContent');
    const caseId = this._currentCaseId;
    const chId = this._currentChapterId;

    if (!caseId || !chId) {
      container.innerHTML = '<div class="template-empty">请先选择一个章节</div>';
      return;
    }

    const template = Project.getTemplate(caseId, chId);
    if (template) {
      container.innerHTML = `<div class="template-box">${this._escapeHtml(template)}</div>`;
    } else {
      container.innerHTML = '<div class="template-empty">暂无模板</div>';
    }
  },

  _renderCharacterCards() {
    const container = document.getElementById('charContent');
    container.innerHTML = '';

    // 编辑模式开关
    const toolbar = document.createElement('div');
    toolbar.className = 'char-toolbar';
    toolbar.innerHTML = `
      <button class="btn btn-sm ${this._charEditMode ? 'btn-primary' : ''}" id="btnToggleEdit">
        ${this._charEditMode ? '✓ 完成编辑' : '✎ 编辑'}
      </button>
      ${this._charEditMode ? '<button class="btn btn-sm btn-primary" id="btnAddChar">＋ 新增角色</button>' : ''}
    `;
    toolbar.querySelector('#btnToggleEdit').addEventListener('click', () => {
      this._charEditMode = !this._charEditMode;
      this._renderCharacterCards();
    });
    if (this._charEditMode) {
      toolbar.querySelector('#btnAddChar').addEventListener('click', () => this._openCharEditor(null));
    }
    container.appendChild(toolbar);

    // 角色卡片列表
    const chars = Project.getCharacters();
    if (chars.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'template-empty';
      empty.textContent = '暂无角色，点击"新增角色"添加';
      container.appendChild(empty);
    }

    chars.forEach(ch => {
      const card = document.createElement('div');
      card.className = 'char-card';

      // 编辑模式下加操作按钮
      let actionsHtml = '';
      if (this._charEditMode) {
        actionsHtml = `
          <div class="char-actions">
            <button class="btn btn-sm char-btn-edit" data-id="${ch.id}">✎</button>
            <button class="btn btn-sm char-btn-del" data-id="${ch.id}">✕</button>
          </div>`;
      }

      card.innerHTML = `
        ${actionsHtml}
        <div class="char-name">${this._escapeHtml(ch.name)}</div>
        <div class="char-title">${this._escapeHtml(ch.title)}</div>
        <div class="char-tags">${ch.tags.map(t => `<span class="char-tag">${this._escapeHtml(t)}</span>`).join('')}</div>
        <div class="char-summary">${this._escapeHtml(ch.summary)}</div>
        <div class="char-details">
          ${Object.entries(ch.details).map(([k, v]) => {
            const val = Array.isArray(v) ? v.map(x => this._escapeHtml(x)).join('<br>') : this._escapeHtml(v);
            return `<div class="char-detail-item"><span class="char-detail-label">${this._escapeHtml(k)}：</span>${val}</div>`;
          }).join('')}
        </div>
      `;

      if (!this._charEditMode) {
        card.addEventListener('click', () => card.classList.toggle('expanded'));
      }

      container.appendChild(card);
    });

    // 绑定编辑/删除按钮事件
    if (this._charEditMode) {
      container.querySelectorAll('.char-btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const charId = btn.dataset.id;
          const ch = Project.getCharacter(charId);
          if (ch) this._openCharEditor(ch);
        });
      });
      container.querySelectorAll('.char-btn-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('确定删除该角色？')) {
            Project.deleteCharacter(btn.dataset.id);
            this._renderCharacterCards();
          }
        });
      });
    }
  },

  /** 打开角色编辑弹窗 */
  _openCharEditor(charData) {
    const isNew = !charData;
    const ch = charData || {
      id: Project.newCharId(),
      name: '',
      title: '',
      tags: [],
      summary: '',
      details: {},
    };

    // 把details转成文本
    let detailsText = '';
    if (ch.details && typeof ch.details === 'object') {
      detailsText = Object.entries(ch.details).map(([k, v]) => {
        const val = Array.isArray(v) ? v.join('；') : v;
        return `${k}：${val}`;
      }).join('\n');
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <span>${isNew ? '新增角色' : '编辑角色'}</span>
          <button class="btn btn-icon modal-close">✕</button>
        </div>
        <div class="modal-body">
          <label>名称</label>
          <input type="text" id="editCharName" value="${this._escapeHtml(ch.name)}" placeholder="角色名">

          <label>身份</label>
          <input type="text" id="editCharTitle" value="${this._escapeHtml(ch.title)}" placeholder="如：主角 / 穿越者">

          <label>标签（逗号分隔）</label>
          <input type="text" id="editCharTags" value="${ch.tags.join('，')}" placeholder="如：28岁，前会计，理性有底线">

          <label>简介</label>
          <textarea id="editCharSummary" rows="3" placeholder="一两句话概括角色">${this._escapeHtml(ch.summary)}</textarea>

          <label>详细信息（每行一条，"键：值"格式）</label>
          <textarea id="editCharDetails" rows="6" placeholder="性格：理性有底线&#10;能力：通幽、驱神&#10;装备：青布道袍、剑">${this._escapeHtml(detailsText)}</textarea>
        </div>
        <div class="modal-footer">
          <button class="btn modal-cancel">取消</button>
          <button class="btn btn-primary" id="btnSaveChar">保存</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('.modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#btnSaveChar').addEventListener('click', () => {
      const name = overlay.querySelector('#editCharName').value.trim();
      if (!name) { this._toast('名称不能为空'); return; }

      const detailsTextVal = overlay.querySelector('#editCharDetails').value.trim();
      const details = {};
      if (detailsTextVal) {
        detailsTextVal.split('\n').forEach(line => {
          const idx = line.indexOf('：');
          if (idx === -1) {
            const idx2 = line.indexOf(':');
            if (idx2 > 0) {
              details[line.substring(0, idx2).trim()] = line.substring(idx2 + 1).trim();
            }
          } else {
            details[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
          }
        });
      }

      const saved = {
        id: ch.id,
        name: name,
        title: overlay.querySelector('#editCharTitle').value.trim(),
        tags: overlay.querySelector('#editCharTags').value.split(/[，,]/).map(t => t.trim()).filter(Boolean),
        summary: overlay.querySelector('#editCharSummary').value.trim(),
        details: details,
      };

      Project.saveCharacter(saved);
      close();
      this._renderCharacterCards();
      this._toast(isNew ? '角色已添加 ✓' : '角色已更新 ✓');
    });

    // 聚焦第一个输入框
    setTimeout(() => overlay.querySelector('#editCharName').focus(), 100);
  },

  _switchLeftTab(tab) {
    this._leftTab = tab;
    document.querySelectorAll('#left-panel .panel-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.getElementById('caseContent').classList.toggle('hidden', tab !== 'cases');
    document.getElementById('templateContent').classList.toggle('hidden', tab !== 'template');
    document.getElementById('charContent').classList.toggle('hidden', tab !== 'chars');

    if (tab === 'template') this._renderTemplate();
  },

  // ---- 编辑器 ----

  _renderEditor() {
    const caseId = this._currentCaseId;
    const chId = this._currentChapterId;
    const titleEl = document.getElementById('editorTitle');

    if (!caseId || !chId) {
      titleEl.textContent = '请选择一个章节';
      return;
    }

    const c = Project.getCase(caseId);
    const ch = Project.getChapter(caseId, chId);
    if (c && ch) {
      titleEl.textContent = `${c.title} · ${ch.title}`;
    }
  },

  // ---- 右侧面板 ----

  _renderRightPanel() {
    this._switchRightTab(this._rightTab);
  },

  _switchRightTab(tab) {
    this._rightTab = tab;
    document.querySelectorAll('#right-panel .right-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.getElementById('checkerContent').classList.toggle('hidden', tab !== 'checker');
    document.getElementById('aiContent').classList.toggle('hidden', tab !== 'ai');

    if (tab === 'checker') this._runChecker();
  },

  // ---- 切换案件/章节 ----

  _selectCase(caseId) {
    // 保存当前内容
    this._saveCurrent();
    this._currentCaseId = caseId;
    Storage.setCurrentCase(caseId);
    Project.markCaseStarted(caseId);

    // 默认选第一章
    const chs = Project.getChapters(caseId);
    if (chs.length > 0) {
      this._selectChapter(caseId, chs[0].id, true);
    }

    this._renderLeftPanel();
    this._renderEditor();
    this._updateStatus();
  },

  _selectChapter(caseId, chapterId, silent) {
    if (!silent) this._saveCurrent();

    this._currentCaseId = caseId;
    this._currentChapterId = chapterId;
    Storage.setCurrentCase(caseId);
    Storage.setCurrentChapter(chapterId);

    // 加载内容
    const content = Project.loadContent(chapterId);
    document.getElementById('editor').value = content || '';

    this._renderLeftPanel();
    this._renderEditor();
    this._renderTemplate();
    this._updateStatus();
    this._unsaved = false;

    // 自动聚焦编辑器
    document.getElementById('editor').focus();
  },

  _saveCurrent() {
    if (!this._currentChapterId) return;
    const content = document.getElementById('editor').value;
    Project.saveContent(this._currentChapterId, content);
    this._unsaved = false;
    this._updateStatus();
  },

  // ---- 导航 ----

  _goNextChapter() {
    const next = Project.getNextChapter(this._currentCaseId, this._currentChapterId);
    if (next) {
      this._selectChapter(this._currentCaseId, next.id);
    } else {
      this._toast('已是最后一章');
    }
  },

  _goPrevChapter() {
    const prev = Project.getPrevChapter(this._currentCaseId, this._currentChapterId);
    if (prev) {
      this._selectChapter(this._currentCaseId, prev.id);
    } else {
      this._toast('已是第一章');
    }
  },

  // ---- 风格检查 ----

  _runChecker() {
    const container = document.getElementById('checkerResults');
    const text = document.getElementById('editor').value;

    if (!text.trim()) {
      container.innerHTML = '<div class="check-empty">编辑区为空，<br>请先写一些内容再检查。</div>';
      this._updateCheckerBadge(0);
      return;
    }

    const results = Checker.run(text);
    const summary = Checker.summary(results);

    // 更新徽章
    this._updateCheckerBadge(results.filter(r => r.severity === 'error').length);

    // 摘要
    let html = '';
    if (results.length === 0) {
      html += '<div class="check-empty" style="color:#a6e3a1;">✓ 未发现风格问题</div>';
    } else {
      html += `<div class="check-summary">`;
      html += `<span class="check-summary-item"><span class="check-summary-dot error"></span> 错误 ${summary.error}</span>`;
      html += `<span class="check-summary-item"><span class="check-summary-dot warn"></span> 警告 ${summary.warn}</span>`;
      html += `<span class="check-summary-item"><span class="check-summary-dot info"></span> 提示 ${summary.info}</span>`;
      html += `</div>`;

      results.forEach(r => {
        const cls = Checker.severityClass(r.severity);
        const label = Checker.severityLabel(r.severity);
        html += `
          <div class="check-result-item ${cls}" data-line="${r.line}">
            <div class="check-result-line">第${r.line + 1}行 · <span class="check-result-type ${r.severity}-tag">${label}</span>${r.type}</div>
            <div class="check-result-msg">${r.message}</div>
          </div>`;
      });
    }

    container.innerHTML = html;

    // 点击结果项跳转到对应行
    container.querySelectorAll('.check-result-item[data-line]').forEach(el => {
      el.addEventListener('click', () => {
        const lineNum = parseInt(el.dataset.line);
        const editor = document.getElementById('editor');
        const lines = editor.value.split('\n');
        let pos = 0;
        for (let i = 0; i < Math.min(lineNum, lines.length); i++) {
          pos += lines[i].length + 1;
        }
        editor.focus();
        editor.setSelectionRange(pos, pos);
        // 滚动到可见位置
        const lineHeight = 32; // 约16px * 2行高
        editor.scrollTop = Math.max(0, lineNum * lineHeight - 100);
      });
    });
  },

  _updateCheckerBadge(count) {
    const badge = document.getElementById('checkerBadge');
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  },

  // ---- AI 面板 ----

  _renderAIChat() {
    const container = document.getElementById('aiMessages');
    const history = AI.getHistory();
    const text = document.getElementById('editor').value;

    container.innerHTML = '';

    if (history.length === 0) {
      container.innerHTML = `
        <div class="ai-msg system-msg">
          AI 续写助手已就绪。<br>
          在编辑区选中一段文本，或直接在下方输入框中描述需求。<br><br>
          快捷键预设：点击下方标签快速发送指令。
        </div>`;
    }

    // 显示最近对话
    const recent = history.slice(-10);
    recent.forEach(msg => {
      const div = document.createElement('div');
      div.className = `ai-msg ${msg.role}`;
      div.textContent = msg.content.substring(0, 500) + (msg.content.length > 500 ? '...' : '');
      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;

    // 预设按钮
    const presetsContainer = document.getElementById('aiPresets');
    presetsContainer.innerHTML = '';
    AI.PRESETS.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'ai-preset-btn';
      btn.textContent = p.label;
      btn.addEventListener('click', () => this._aiPreset(p));
      presetsContainer.appendChild(btn);
    });

    // 恢复设置
    document.getElementById('ollamaUrl').value = Storage.getOllamaUrl();
    document.getElementById('ollamaModel').value = Storage.getOllamaModel();
  },

  _aiPreset(preset) {
    const text = document.getElementById('editor').value;
    const selection = this._getEditorSelection();

    const context = selection || text.substring(0, Math.min(text.length, 500));

    if (!context.trim()) {
      this._toast('请先写一些内容');
      return;
    }

    this._addAIMessage('user', `【${preset.label}】\n${context}`);
    this._addAIMessage('assistant', '...');

    AI.rewrite(context, preset.prompt,
      (chunk) => {
        // 流式更新最后一条消息
        const msgs = document.getElementById('aiMessages').children;
        const last = msgs[msgs.length - 1];
        if (last && last.classList.contains('assistant')) {
          if (last.textContent === '...') last.textContent = '';
          last.textContent += chunk;
        }
        document.getElementById('aiMessages').scrollTop = document.getElementById('aiMessages').scrollHeight;
      },
      (fullText) => {
        // 完成
        const msgs = document.getElementById('aiMessages').children;
        const last = msgs[msgs.length - 1];
        if (last && last.classList.contains('assistant')) {
          last.textContent = fullText;
        }
      },
      (err) => {
        this._addAIMessage('system-msg', `❌ ${err}`);
      }
    );
  },

  _sendAIMessage() {
    const input = document.getElementById('aiInput');
    const userText = input.value.trim();
    if (!userText) return;

    const editorText = document.getElementById('editor').value;
    const selection = this._getEditorSelection();
    const context = selection || editorText.substring(0, Math.min(editorText.length, 800));

    const fullPrompt = context
      ? `【上下文】\n${context}\n\n【指令】\n${userText}`
      : userText;

    this._addAIMessage('user', userText);
    input.value = '';

    this._addAIMessage('assistant', '...');

    AI.generate(fullPrompt, {},
      (chunk) => {
        const msgs = document.getElementById('aiMessages').children;
        const last = msgs[msgs.length - 1];
        if (last && last.classList.contains('assistant')) {
          if (last.textContent === '...') last.textContent = '';
          last.textContent += chunk;
        }
        document.getElementById('aiMessages').scrollTop = document.getElementById('aiMessages').scrollHeight;
      },
      (fullText) => {
        const msgs = document.getElementById('aiMessages').children;
        const last = msgs[msgs.length - 1];
        if (last && last.classList.contains('assistant')) {
          last.textContent = fullText;
        }
      },
      (err) => {
        this._addAIMessage('system-msg', `❌ ${err}`);
      }
    );
  },

  _addAIMessage(role, content) {
    const container = document.getElementById('aiMessages');
    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    div.textContent = content;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  },

  _getEditorSelection() {
    const editor = document.getElementById('editor');
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    if (start !== end) {
      return editor.value.substring(start, end);
    }
    return null;
  },

  _insertAIText(text) {
    const editor = document.getElementById('editor');
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const before = editor.value.substring(0, end);
    const after = editor.value.substring(end);
    const insertText = (before.endsWith('\n') || before === '' ? '' : '\n') + text + '\n';
    editor.value = before + insertText + after;
    const newPos = end + insertText.length;
    editor.setSelectionRange(newPos, newPos);
    editor.focus();
    this._unsaved = true;
    this._updateStatus();
  },

  // ---- 事件绑定 ----

  _bindEvents() {
    // 编辑器输入
    const editor = document.getElementById('editor');
    editor.addEventListener('input', () => {
      this._unsaved = true;
      this._updateStatus();
    });

    // 左侧面板tab切换
    document.querySelectorAll('#left-panel .panel-tab').forEach(tab => {
      tab.addEventListener('click', () => this._switchLeftTab(tab.dataset.tab));
    });

    // 右侧面板tab切换
    document.querySelectorAll('#right-panel .right-tab').forEach(tab => {
      tab.addEventListener('click', () => this._switchRightTab(tab.dataset.tab));
    });

    // 保存按钮
    document.getElementById('btnSave').addEventListener('click', () => {
      this._saveCurrent();
      this._toast('已保存 ✓');
    });

    // 上一章/下一章
    document.getElementById('btnPrev').addEventListener('click', () => this._goPrevChapter());
    document.getElementById('btnNext').addEventListener('click', () => this._goNextChapter());

    // 刷新检查
    document.getElementById('btnCheck').addEventListener('click', () => {
      this._switchRightTab('checker');
      this._runChecker();
    });

    // AI发送
    document.getElementById('btnAiSend').addEventListener('click', () => this._sendAIMessage());
    document.getElementById('aiInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._sendAIMessage();
      }
    });

    // AI停止
    document.getElementById('btnAiStop').addEventListener('click', () => AI.abort());

    // AI清空历史
    document.getElementById('btnAiClear').addEventListener('click', () => {
      AI.clearHistory();
      this._renderAIChat();
    });

    // AI插入
    document.getElementById('btnAiInsert').addEventListener('click', () => {
      const msgs = document.getElementById('aiMessages').children;
      // 找最后一条assistant消息
      let lastText = '';
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].classList.contains('assistant') && msgs[i].textContent !== '...') {
          lastText = msgs[i].textContent;
          break;
        }
      }
      if (lastText) {
        this._insertAIText(lastText);
        this._toast('已插入到编辑区 ✓');
      }
    });

    // AI设置保存
    document.getElementById('ollamaUrl').addEventListener('change', (e) => {
      Storage.setOllamaUrl(e.target.value);
    });
    document.getElementById('ollamaModel').addEventListener('change', (e) => {
      Storage.setOllamaModel(e.target.value);
    });

    // 导出/导入
    document.getElementById('btnExport').addEventListener('click', () => {
      const data = Storage.exportAll();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `乱世行_备份_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this._toast('数据已导出 ✓');
    });

    document.getElementById('btnImport').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const ok = Storage.importAll(ev.target.result);
          if (ok) {
            this._toast('数据已导入 ✓ 刷新页面生效');
          } else {
            this._toast('导入失败，文件格式有误');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // 快捷键
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            this._saveCurrent();
            this._toast('已保存 ✓');
            break;
          case 'j':
            e.preventDefault();
            this._goNextChapter();
            break;
          case 'k':
            e.preventDefault();
            this._goPrevChapter();
            break;
          case 'l':
            e.preventDefault();
            this._switchRightTab('checker');
            this._runChecker();
            break;
          case 'i':
            e.preventDefault();
            this._switchRightTab('ai');
            this._renderAIChat();
            document.getElementById('aiInput').focus();
            break;
        }
      }
    });

    // 离开页面提醒
    window.addEventListener('beforeunload', (e) => {
      if (this._unsaved) {
        this._saveCurrent();
      }
    });
  },

  // ---- 自动保存 ----

  _startAutoSave() {
    this._autoSaveTimer = setInterval(() => {
      if (this._unsaved) {
        this._saveCurrent();
      }
    }, 30000); // 30秒
  },

  // ---- 状态更新 ----

  _updateStatus() {
    const chId = this._currentChapterId;
    const wc = chId ? Project.getWordCount(chId) : 0;
    const caseWc = this._currentCaseId ? Project.getCaseWordCount(this._currentCaseId) : 0;
    const totalWc = Project.getTotalWordCount();

    document.getElementById('wordCount').textContent = `本章 ${wc} 字`;
    document.getElementById('statusCaseWc').textContent = `本案 ${caseWc} 字`;
    document.getElementById('statusTotalWc').textContent = `总计 ${totalWc} 字`;

    const dot = document.getElementById('saveDot');
    dot.className = `status-dot ${this._unsaved ? 'unsaved' : 'saved'}`;
  },

  // ---- Toast ----

  _toast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
  },

  // ---- 工具 ----

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};

// ---- 启动 ----
document.addEventListener('DOMContentLoaded', () => App.init());
