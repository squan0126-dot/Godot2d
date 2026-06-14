// ============================================================
// 功能C：AI 续写助手（Ollama 本地接口）
// ============================================================

const AI = {

  _history: [],
  _abortController: null,

  init() {
    this._history = Storage.loadAIHistory();
  },

  // ---- 构建 system prompt ----

  _buildSystemPrompt() {
    return `你是"祭酒"——网络小说《地煞七十二变》的作者。你精通志怪叙事，擅长用半文半白的语言写出恐怖、侠义、幽默交织的修仙故事。

# 核心规则
- 半文半白：用"甫一""悚然""径直""好似""腹诽""嗤笑""面面相觑"等词，但不晦涩
- 短句为主：动作描写不超过15字/句
- 细节恐怖：不写"恐怖""可怕"，只写具体视觉/嗅觉/触觉细节
- 反差幽默：紧张场景后插入一句腹诽或吐槽
- 对白口语化：角色说话带烟火气
- 悲剧用白描：不煽情，只陈述事实

# 绝对禁止
- 不写"他感到恐惧/震惊"
- 不写"震惊！""这怎么可能！""你找死！"
- 不写"泪流满面""心如刀割""肝肠寸断"
- 不用"竟然""居然"超过1次/段
- 不堆砌形容词（名词前不超过2个修饰）
- 不大段心理独白（不超过3句连续内心活动）

# 当前背景
主角李归舟，28岁前会计，被玉佩带到唐末乱世。穿青布道袍，佩刻"苍生太平"的剑，骑瘦马。师父玄义老道已牺牲。每斩一个妖鬼，玉佩亮一道刻痕，传送去下一个地方。

请只输出正文，不要任何解释。直接续写，保持风格一致。`;
  },

  // ---- 生成续写 ----

  /**
   * @param {string} promptText - 用户输入的上下文文本
   * @param {object} options - { temperature, maxTokens }
   * @param {function} onChunk - 流式回调 (chunkText)
   * @param {function} onDone - 完成回调 (fullText)
   * @param {function} onError - 错误回调 (errorMessage)
   */
  async generate(promptText, options = {}, onChunk, onDone, onError) {
    const url = Storage.getOllamaUrl();
    const model = Storage.getOllamaModel();

    const systemPrompt = this._buildSystemPrompt();

    // 构建消息
    const messages = [
      { role: 'system', content: systemPrompt },
      ...this._history.slice(-6),  // 最近6条对话
      { role: 'user', content: `请续写以下内容，保持祭酒风格，只输出续写正文：\n\n${promptText}` },
    ];

    const body = {
      model: model,
      messages: messages,
      stream: true,
      options: {
        temperature: options.temperature || 0.8,
        num_predict: options.maxTokens || 512,
      },
    };

    this._abortController = new AbortController();
    let fullText = '';

    try {
      const response = await fetch(`${url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this._abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama 返回错误: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';  // 保留不完整的最后一行

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullText += content;
              onChunk && onChunk(content);
            }
          } catch (e) {
            // 跳过解析失败的行
          }
        }
      }

      // 保存到历史
      this._history.push(
        { role: 'user', content: promptText },
        { role: 'assistant', content: fullText }
      );
      Storage.saveAIHistory(this._history);

      onDone && onDone(fullText);

    } catch (err) {
      if (err.name === 'AbortError') {
        onDone && onDone(fullText || '(已中断)');
      } else {
        onError && onError(err.message || '连接失败，请确认 Ollama 已启动');
      }
    }
  },

  /** 停止生成 */
  abort() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  },

  // ---- 风格改写 ----

  /**
   * 对已有文本进行风格改写
   * @param {string} text - 原文
   * @param {string} instruction - 改写指令（如"加一个腹诽""加强恐怖氛围"）
   */
  async rewrite(text, instruction, onChunk, onDone, onError) {
    const url = Storage.getOllamaUrl();
    const model = Storage.getOllamaModel();

    const messages = [
      { role: 'system', content: this._buildSystemPrompt() },
      { role: 'user', content: `请对以下文本进行改写。改写要求：${instruction}\n\n原文：\n${text}\n\n只输出改写后的文本，不要解释。` },
    ];

    const body = {
      model, messages, stream: true,
      options: { temperature: 0.7, num_predict: 512 },
    };

    this._abortController = new AbortController();
    let fullText = '';

    try {
      const response = await fetch(`${url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this._abortController.signal,
      });

      if (!response.ok) throw new Error(`Ollama 错误: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) { fullText += content; onChunk && onChunk(content); }
          } catch (e) { /* skip */ }
        }
      }
      onDone && onDone(fullText);
    } catch (err) {
      if (err.name === 'AbortError') {
        onDone && onDone(fullText || '(已中断)');
      } else {
        onError && onError(err.message || '连接失败');
      }
    }
  },

  // ---- 对话历史 ----

  getHistory() { return this._history; },

  clearHistory() {
    this._history = [];
    Storage.clearAIHistory();
  },

  // ---- 预设指令 ----

  PRESETS: [
    { id: 'add_humor', label: '插入腹诽', prompt: '在适当位置插入一句主角的腹诽或吐槽（半文半白，带烟火气），然后继续原文。' },
    { id: 'add_tension', label: '加强恐怖', prompt: '加强恐怖氛围：用具体感官细节替代抽象描述，用短句断行制造节奏，不要用"恐怖""可怕"等词。' },
    { id: 'shorten_action', label: '拆分长句', prompt: '把超过15字的动作描写拆成多个短句，每句不超过15字。保持节奏紧凑。' },
    { id: 'add_detail', label: '丰富细节', prompt: '在场景中增加1-2个具体的感官细节（视觉/听觉/嗅觉/触觉），不求多，但求准。' },
    { id: 'add_contrast', label: '日常→异常', prompt: '在恐怖场景前加2-3句日常描写，然后引入一个微小的不对劲，逐步递进到恐怖。' },
    { id: 'make_dialogue', label: '对白口语化', prompt: '角色对白要带烟火气，像真人说话，不端着，不念台词。用短句，可以有语气词。' },
  ],
};
