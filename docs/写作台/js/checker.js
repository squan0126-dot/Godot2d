// ============================================================
// 功能A：风格检查器
// ============================================================

const Checker = {

  /**
   * 对全文执行所有检查，返回结果数组
   * @param {string} text - 全文
   * @returns {Array<{line, col, endCol, message, severity, type}>}
   */
  run(text) {
    const results = [];
    const paragraphs = this._splitParagraphs(text);
    const lines = text.split('\n');

    // 1. 禁用词检测（全文字符串匹配）
    this._checkBannedWords(text, results);

    // 2. 网文套路词检测
    this._checkClichés(text, results);

    // 3. 每段频率检查（竟然/居然）
    this._checkFrequency(paragraphs, results);

    // 4. 段首句长度检查
    this._checkOpening(lines, paragraphs, results);

    // 5. 动作句长度检查（超过15字的短句）
    this._checkActionSentences(paragraphs, results);

    // 6. 连续内心独白检查
    this._checkInnerMonologue(paragraphs, results);

    // 7. 形容词堆砌检查（的的的）
    this._checkAdjectiveStacking(paragraphs, results);

    // 8. 煽情词汇提示
    this._checkSentiment(text, results);

    // 9. 解释性旁白检测
    this._checkExplanatory(text, results);

    // 按行号排序
    results.sort((a, b) => a.line - b.line || a.col - b.col);

    return results;
  },

  /**
   * 将文本按段落分割（空行分隔），返回 {text, startLine, endLine}[]
   */
  _splitParagraphs(text) {
    const lines = text.split('\n');
    const paragraphs = [];
    let current = [];
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        if (current.length > 0) {
          paragraphs.push({
            text: current.join('\n'),
            startLine: startLine,
            endLine: i - 1,
          });
          current = [];
        }
        startLine = i + 1;
      } else {
        current.push(line);
      }
    }
    // 最后一段
    if (current.length > 0) {
      paragraphs.push({
        text: current.join('\n'),
        startLine: startLine,
        endLine: lines.length - 1,
      });
    }
    return paragraphs;
  },

  /** 在文本中定位某个子串的行列 */
  _findPosition(text, substring, startFrom = 0) {
    const idx = text.indexOf(substring, startFrom);
    if (idx === -1) return null;
    const before = text.substring(0, idx);
    const lines = before.split('\n');
    const line = lines.length - 1;
    const col = lines[lines.length - 1].length;
    return { line, col, idx };
  },

  /** 报告行号转为1-based显示 */
  _lineStr(n) { return n + 1; },

  // ---- 各检查项 ----

  _checkBannedWords(text, results) {
    STYLE_RULES.bannedWords.forEach(rule => {
      let pos = 0;
      while (true) {
        const found = this._findPosition(text, rule.word, pos);
        if (!found) break;
        results.push({
          line: found.line,
          col: found.col,
          endCol: found.col + rule.word.length,
          message: rule.msg,
          severity: rule.level,
          type: '禁用词',
        });
        pos = found.idx + rule.word.length;
      }
    });
  },

  _checkClichés(text, results) {
    STYLE_RULES.bannedClichés.forEach(rule => {
      let pos = 0;
      while (true) {
        const found = this._findPosition(text, rule.word, pos);
        if (!found) break;
        results.push({
          line: found.line,
          col: found.col,
          endCol: found.col + rule.word.length,
          message: rule.msg,
          severity: rule.level,
          type: '网文套路',
        });
        pos = found.idx + rule.word.length;
      }
    });
  },

  _checkFrequency(paragraphs, results) {
    STYLE_RULES.frequencyChecks.forEach(rule => {
      paragraphs.forEach(para => {
        rule.words.forEach(word => {
          // 统计该词在段落中出现的次数
          let count = 0;
          let pos = 0;
          while (true) {
            const idx = para.text.indexOf(word, pos);
            if (idx === -1) break;
            count++;
            pos = idx + word.length;
          }
          if (count > rule.maxPerParagraph) {
            results.push({
              line: para.startLine,
              col: 0,
              endCol: 0,
              message: rule.msg.replace('{count}', count),
              severity: rule.level,
              type: '频率限制',
            });
          }
        });
      });
    });
  },

  _checkOpening(lines, paragraphs, results) {
    const rules = STYLE_RULES.structureRules;
    paragraphs.forEach(para => {
      const firstLine = lines[para.startLine];
      if (!firstLine || !firstLine.trim()) return;
      const clean = firstLine.replace(/[，。！？；：、""''「」『』【】《》（）\s]/g, '');
      const len = clean.length;
      if (len < rules.openingMinChars) {
        results.push({
          line: para.startLine,
          col: 0,
          endCol: firstLine.length,
          message: `段首句仅${len}字，建议4-12字定调`,
          severity: 'warn',
          type: '结构检查',
        });
      } else if (len > rules.openingMaxChars) {
        results.push({
          line: para.startLine,
          col: 0,
          endCol: firstLine.length,
          message: `段首句${len}字，建议不超过12字`,
          severity: 'warn',
          type: '结构检查',
        });
      }
    });
  },

  _checkActionSentences(paragraphs, results) {
    const maxLen = STYLE_RULES.structureRules.actionMaxChars;
    paragraphs.forEach(para => {
      // 把段落按句号、逗号、分号拆分
      const sentences = para.text.split(/[，。！？；]/);
      let accumulatedLen = 0;
      let segStart = para.startLine;
      let segStartCol = 0;

      // 简化：检查是否有明显超长的动作描述
      // 动作句识别：含"拔""斩""劈""砍""刺""挑"等动词且超过15字
      const actionVerbs = /[拔斩劈砍刺挑挥劈扫撩抹格挡踢踹跃跳翻滚撞扑]/;
      sentences.forEach(s => {
        const trimmed = s.trim();
        if (trimmed.length > maxLen && actionVerbs.test(trimmed)) {
          // 在整个段落文本中定位
          const idx = para.text.indexOf(trimmed);
          if (idx !== -1) {
            const before = para.text.substring(0, idx);
            const lineOffset = before.split('\n').length - 1;
            const colOffset = before.split('\n').pop().length;
            results.push({
              line: para.startLine + lineOffset,
              col: colOffset,
              endCol: colOffset + trimmed.length,
              message: `动作句${trimmed.length}字，建议不超过${maxLen}字，用短句拆分`,
              severity: 'warn',
              type: '结构检查',
            });
          }
        }
      });
    });
  },

  _checkInnerMonologue(paragraphs, results) {
    const maxConsecutive = STYLE_RULES.structureRules.maxConsecutiveInnerMonologue;
    // 内心独白特征：以"我"开头，或包含"觉得""想""心想""暗想"等
    const monologuePattern = /(我觉得|我想|他心想|他想|暗想|心道|心里|心说|寻思|暗道|腹诽)/;

    paragraphs.forEach(para => {
      const sentences = para.text.split(/[。！？]/);
      let consecutive = 0;
      let startIdx = -1;

      for (let i = 0; i < sentences.length; i++) {
        const s = sentences[i].trim();
        if (monologuePattern.test(s)) {
          if (consecutive === 0) startIdx = i;
          consecutive++;
        } else {
          if (consecutive > maxConsecutive) {
            const firstSentence = sentences[startIdx];
            const idx = para.text.indexOf(firstSentence);
            if (idx !== -1) {
              const before = para.text.substring(0, idx);
              const lineOffset = before.split('\n').length - 1;
              results.push({
                line: para.startLine + lineOffset,
                col: 0,
                endCol: 0,
                message: `连续${consecutive}句内心活动，超过${maxConsecutive}句上限`,
                severity: 'warn',
                type: '结构检查',
              });
            }
          }
          consecutive = 0;
        }
      }
      // 检查末尾
      if (consecutive > maxConsecutive) {
        results.push({
          line: para.startLine,
          col: 0,
          endCol: 0,
          message: `连续${consecutive}句内心活动，超过${maxConsecutive}句上限`,
          severity: 'warn',
          type: '结构检查',
        });
      }
    });
  },

  _checkAdjectiveStacking(paragraphs, results) {
    // 检测 "XX的XX的XX" 模式（一个名词前超过2个"的"修饰）
    paragraphs.forEach(para => {
      const pattern = /([^，。！？；\s]{2,}的[^，。！？；\s]{2,}的[^，。！？；\s]{2,}的)/g;
      let match;
      while ((match = pattern.exec(para.text)) !== null) {
        const before = para.text.substring(0, match.index);
        const lineOffset = before.split('\n').length - 1;
        results.push({
          line: para.startLine + lineOffset,
          col: match.index,
          endCol: match.index + match[0].length,
          message: '疑似形容词堆砌（3个以上"的"修饰同一名词），建议精简',
          severity: 'warn',
          type: '结构检查',
        });
      }
    });
  },

  _checkSentiment(text, results) {
    STYLE_RULES.sentimentWords.forEach(word => {
      let pos = 0;
      while (true) {
        const found = this._findPosition(text, word, pos);
        if (!found) break;
        results.push({
          line: found.line,
          col: found.col,
          endCol: found.col + word.length,
          message: `煽情词"${word}"，请考虑用白描替代，或确认此处确需使用`,
          severity: 'info',
          type: '煽情提示',
        });
        pos = found.idx + word.length;
      }
    });
  },

  _checkExplanatory(text, results) {
    STYLE_RULES.explanatoryPatterns.forEach(pattern => {
      let pos = 0;
      while (true) {
        const found = this._findPosition(text, pattern, pos);
        if (!found) break;
        results.push({
          line: found.line,
          col: found.col,
          endCol: found.col + pattern.length,
          message: `疑似解释性旁白（"${pattern}..."），请删除或改为角色视角`,
          severity: 'warn',
          type: '解释性旁白',
        });
        pos = found.idx + pattern.length;
      }
    });
  },

  // ---- 工具方法 ----

  /** 获取检查结果的统计摘要 */
  summary(results) {
    const counts = { error: 0, warn: 0, info: 0 };
    results.forEach(r => { counts[r.severity] = (counts[r.severity] || 0) + 1; });
    return counts;
  },

  /** 给结果标记严重程度对应的CSS类名 */
  severityClass(severity) {
    return {
      'error': 'sev-error',
      'warn': 'sev-warn',
      'info': 'sev-info',
    }[severity] || 'sev-info';
  },

  /** 严重程度中文标签 */
  severityLabel(severity) {
    return {
      'error': '错误',
      'warn': '警告',
      'info': '提示',
    }[severity] || '提示';
  },
};
