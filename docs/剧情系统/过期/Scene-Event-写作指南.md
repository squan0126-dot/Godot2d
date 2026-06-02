# Scene + Event 写作指南（活侠传式 AVG）

> 本文档面向策划、文案、关卡设计师，用于指导新场景的 JSON 创作。
> 与编辑器面板字段名、JSON 字段名严格一致。

---

## 0. 核心概念

| 名词 | 含义 |
| --- | --- |
| **场景 (Scene)** | 一个地点，对应一个 JSON 文件，type=scene |
| **事件 (Event)** | 场景内的一段叙事单元，按顺序播放或玩家点击触发 |
| **背景 (Background)** | 场景级常驻图像，事件流转期间不重载、不闪屏 |
| **立绘 (Portrait)** | 角色图像，跨场景常驻；位置/明暗/翻转/表情可控 |
| **对话框 (DialogueBox)** | 跨场景常驻 UI，与立绘同层 |
| **热点 (Hotspot)** | 背景上的可点击区域，触发某个事件 |

> 一个 JSON = 一个地点；一个地点内可以有多段对话、多个热点、多个分支。

---

## 1. JSON 字段速查

### 1.1 场景级字段（顶层）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `nodeId` | string | 场景唯一ID（建议 `prologue_xxx`） |
| `nodeName` | string | 编辑器显示用中文名 |
| `chapter` | string | 所属章节，例如 `prologue` / `chapter1` |
| `type` | string | **固定为 `"scene"`** |
| `background` | string | `Resources/Backgrounds/` 下的资源名（无后缀） |
| `bgm` | string | `Resources/Audio/BGM/` 下的资源名 |
| `scrollable` | bool | `true`=可左右拖拽全景 / `false`=单屏静态 |
| `backgroundFitMode` | string | `stretch`（拉伸至屏幕） / `panorama`（全景溢出） |
| `initialViewOffset` | float | 0~1，初始视图位置（0=最左，0.5=居中，1=最右） |
| `events` | array | 事件列表，按数组顺序为默认时间轴 |
| `next` | string | 场景结束跳转：`@scene:目标场景id` / `@end` / 空 |

### 1.2 事件级字段（events 数组中每一项）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 事件id（场景内唯一） |
| `name` | string | 编辑器显示用中文名 |
| `type` | string | `auto` / `hotspot` / `choice_branch` / `manual` |
| `trigger` | object | 触发条件（见下） |
| `hotspot` | object | type=hotspot 时必填 |
| `sequence` | array | 执行的指令列表（见 §3） |
| `next` | string | 事件结束跳转：`同场景event id` / `@scene:xxx` / `@end` / 空（按顺序往下） |

### 1.3 trigger 触发条件

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `visibleAfter` | string | 在某事件被消费完后才可见/触发，空=无依赖 |
| `afterAllHotspotsConsumed` | bool | 在所有 hotspot 消费完后才触发（典型："通幽激活后"） |
| `flagRequired` | string | 需要某 flag=true 才触发，由 `set_flag` 命令设置 |
| `runOnce` | bool | 是否只触发一次（默认 true，避免循环） |

### 1.4 hotspot 字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | hover 提示用中文名 |
| `position` | Vector2 | 归一化坐标 (0~1) |
| `interactionShape` | string | `circle` / `rect` |
| `radius` | float | circle 半径（归一化值） |
| `size` | Vector2 | rect 尺寸（归一化值） |
| `consumeOnClick` | bool | 点击后是否消失（默认 true） |
| `tooltip` | string | 提示气泡文本 |

---

## 2. 四种事件类型

### 2.1 `auto` — 自动播放
进入场景或前一事件结束后自动触发。

```json
{
  "id": "evt_intro",
  "type": "auto",
  "sequence": [ ... ],
  "next": ""
}
```

### 2.2 `hotspot` — 等待玩家点击热点
渲染一个可点击的区域，玩家点击后触发 sequence。

```json
{
  "id": "evt_lamp",
  "type": "hotspot",
  "trigger": { "visibleAfter": "evt_intro" },
  "hotspot": {
    "name": "桌上油灯",
    "position": { "x": 0.32, "y": 0.55 },
    "interactionShape": "circle",
    "radius": 0.05,
    "consumeOnClick": true
  },
  "sequence": [
    { "type": "narration", "text": "（油灯昏黄……）" }
  ]
}
```

### 2.3 `choice_branch` — 选项分支
sequence 中含有 `choice` 命令；每个选项可指定 `next`。

```json
{
  "id": "evt_choice",
  "type": "choice_branch",
  "trigger": { "afterAllHotspotsConsumed": true },
  "sequence": [
    { "type": "dialogue", "speaker": "桃花女", "text": "公子可愿留下？" },
    {
      "type": "choice",
      "options": [
        { "text": "留下", "next": "evt_stay" },
        { "text": "离去", "next": "@scene:next_scene_id" }
      ]
    }
  ]
}
```

### 2.4 `manual` — 命名段落
仅作为跳转目标，不会自动触发。常用于"分支后的剧情段落"。

```json
{
  "id": "evt_stay",
  "type": "manual",
  "sequence": [ ... ],
  "next": "@end"
}
```

---

## 3. sequence 命令清单

| `type` | 必填字段 | 可选字段 | 用途 |
| --- | --- | --- | --- |
| `narration` | `text` | `speed`(slow/normal/fast)、`pause` | 旁白 |
| `dialogue` | `speaker`、`text` | `position`、`highlight`、`expression` | 角色对白 |
| `show_character` | `id`、`position` | `state`、`transition`、`flip`、`brightness`、`offsetX`、`offsetY`、`animation` | 立绘进场 |
| `hide_character` | `id` | `transition` | 立绘退场 |
| `character_morph` | `id`、`from`、`to` | `duration`、`morphAnimation` | 立绘平滑过渡（恐怖递进核心） |
| `bg_change` | `target` | `transition`、`duration` | 切背景（**场景内一般不用，背景应常驻**） |
| `bgm_change` | `target` | `fade` | 切BGM |
| `sfx` | `sound` | `delay` | 播放音效 |
| `effect` | `name`、`intensity` | `duration` | 屏幕特效（screen_shake/darken/flash/blur/vignette） |
| `cg` | `image` | `transition` | 显示CG |
| `choice` | `options` | — | 显示选项（option 含 text/next/flag） |
| `system_prompt` | `text`、`style` | — | 系统提示 |
| `set_flag` | `flag`、`value` | — | 设置标记 |
| `wait` | `duration` | — | 等待 N 秒 |
| `goto_event` | `target` | — | 跳转到事件id 或 `@scene:xxx` |

---

## 4. 立绘三连命令详解

### 4.1 `show_character` — 立绘进场
```json
{
  "type": "show_character",
  "id": "taohua_woman",
  "position": "right",          // left / center / right
  "state": "normal",            // 表情/服装状态：对应资源 Portraits/<id>/<state>.png
  "transition": "fade",         // fade / slide_in_left / slide_in_right / instant / bounce_in
  "flip": false,                // 镜像翻转
  "brightness": 1,              // 亮度 0~1
  "offsetX": 0,                 // 相对标准位置的 X 微调（px）
  "offsetY": 0,                 // 相对标准位置的 Y 微调（px，一般为 0）
  "animation": "breathing"      // 持续动画：breathing / idle / sway / none
}
```

### 4.2 `character_morph` — 立绘平滑过渡（不消失）
```json
{
  "type": "character_morph",
  "id": "taohua_woman",
  "from": "normal",
  "to": "rotten_stage1",
  "duration": 3,
  "morphAnimation": "glitch"    // glitch / shake / fade_to_dark / none
}
```

### 4.3 `hide_character` — 立绘淡出
```json
{ "type": "hide_character", "id": "taohua_woman", "transition": "fade" }
```

### 4.4 多角色明暗联动
- 在 `dialogue` 命令上加 `"highlight": true` + `"position": "right"`：
  - 当前说话者保持高亮，**其他立绘自动调暗**（默认调到 `dimBrightness=0.5`）。

---

## 5. 跳转与 next 字段

| 写法 | 含义 |
| --- | --- |
| `""`（空） | 按 events 顺序往下推进 |
| `"evt_xxx"` | 跳到本场景内的事件 id |
| `"@scene:SS_xxx"` | 切换到目标场景 |
| `"@end"` | 结束当前章节 |

> `goto_event` 命令的 `target` 字段使用同样语法。

---

## 6. 三个典型示例

### 示例 1：同地点连续多段对话（不闪屏）
**重点**：所有对话都放在同一个 scene 节点的多个 auto 事件里，背景只设一次。

```json
{
  "type": "scene",
  "background": "qinhuai_inner",
  "events": [
    { "id": "evt1", "type": "auto", "sequence": [ ... ] },
    { "id": "evt2", "type": "auto", "sequence": [ ... ] },
    { "id": "evt3", "type": "auto", "sequence": [ ... ] }
  ]
}
```

### 示例 2：分支选项跨场景
```json
{
  "id": "evt_choose",
  "type": "choice_branch",
  "sequence": [
    {
      "type": "choice",
      "options": [
        { "text": "上岸", "next": "@scene:prologue_shore" },
        { "text": "继续乘船", "next": "evt_continue" }
      ]
    }
  ]
}
```

### 示例 3：全景探索式 hotspot 串
```json
{
  "scrollable": true,
  "backgroundFitMode": "panorama",
  "initialViewOffset": 0.5,
  "events": [
    { "id": "evt_intro", "type": "auto", "sequence": [ ... ] },
    { "id": "evt_lamp", "type": "hotspot",
      "trigger": { "visibleAfter": "evt_intro" },
      "hotspot": { "position": {"x":0.3,"y":0.55}, "radius": 0.05 },
      "sequence": [ ... ] },
    { "id": "evt_window", "type": "hotspot",
      "trigger": { "visibleAfter": "evt_intro" },
      "hotspot": { "position": {"x":0.7,"y":0.62}, "radius": 0.05 },
      "sequence": [ ... ] },
    { "id": "evt_horror", "type": "auto",
      "trigger": { "afterAllHotspotsConsumed": true },
      "sequence": [
        { "type": "character_morph", "id": "taohua_woman", "from": "normal", "to": "rotten_stage1", "duration": 3 }
      ],
      "next": "@scene:next_scene"
    }
  ]
}
```

---

## 7. 编辑器使用流程

1. **菜单**：`Tools / 场景与事件编辑器`
2. **新建场景节点**：点击顶部 `➕ 新建场景节点`，自动生成最小可用模板
3. **场景属性 Tab（右栏）**：填 background / bgm / scrollable 等
4. **事件时间轴（中栏）**：点击 `➕ 新增事件`，选中事件后右栏自动切到"事件编辑 Tab"
5. **拖动热点**：选中 hotspot 类型事件后，背景预览上的橙色圆点支持鼠标拖动调位置
6. **保存**：`💾 保存` 触发字段校验（id 唯一、next 跳转目标存在），不通过弹窗阻止
7. **预览**：`▶ Play 预览` 设置 `EditorPrefs.PreviewNodeId` 后启动 Play，序章直跳到当前场景

---

## 8. 字段命名一致性约定

- **JSON / 代码 / 编辑器面板**三处字段名严格一致（驼峰 camelCase）。
- 编辑器 UI 文本格式："中文名 (englishKey)"，例如 `可滑动 (scrollable)`，避免迷路。
- 文档中函数名/资源路径用反引号（`像这样`），便于查找。

---

## 9. 常见问题

**Q：为什么我的连续两段对话之间会黑屏闪一下？**
A：你大概率把它们放在两个不同的 scene 节点里了。同地点对话应放进同一个 scene 的多个事件中。

**Q：如何让某个 hotspot 在玩家点完所有其它 hotspot 之后才出现？**
A：用 `trigger.afterAllHotspotsConsumed: true`，并把这个事件设为 type=auto（不是 hotspot），它会在所有热点消费完后自动播放。

**Q：旁白和对话有什么区别？**
A：`narration` 不显示说话者名字，居中或下方显示；`dialogue` 显示 speaker 名字与立绘高亮联动。

**Q：立绘上去后下一段对话不是同一个角色，会自动调暗他吗？**
A：会。在 dialogue 命令上加 `highlight: true` + `position`，引擎会把其他立绘调到 dimBrightness。

**Q：我想让玩家点击屏幕直接推进对话，不用做任何特殊设置吗？**
A：是的，PrologueDirector 已统一处理：旁白/对话播放完毕后任意点击/Space/Enter 都会推进。

---

## 10. 旧节点格式说明

旧的 `panorama_explore` / 旧 `narrative` 节点已被**彻底废弃**：
- 加载器看到旧 type 仅输出 warning，不再尝试解析。
- 旧 6 个 JSON 文件（QINHUAI_01~03、PROLOGUE_01、PANORAMA_01、RESCUE、TEMPLE_01）已全部删除。
- 序章入口节点改为 `prologue_example_scene`，作为新模型的最小可玩示例。

请始终使用 `type: "scene"` 创建新内容。
