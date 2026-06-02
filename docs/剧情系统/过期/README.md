# 历史归档（Unity 时代文档）

> ⚠️ **此目录下所有文档均为 Unity 项目时代的设计稿，已不再适用于当前 Godot 项目。**
> 
> 保留原因：其中包含的世界观/剧情骨架（3 章主线、序章设定等）仍有参考价值。
> 
> **当前生效的设计文档请查阅 [`docs/技术方案/`](../../技术方案/)**。

---

## 归档时间
2026-06-01

## 归档原因
项目从 Unity（C# + UGUI）迁移到 Godot 4.6（GDScript + Dialogic 2），原文档中以下内容均已失效：

| 失效内容 | 替代方案 |
|---------|----------|
| `NarrativeArcEngine`（C# 状态机引擎） | Dialogic 2 Timeline + 自研 `BranchEvaluator` |
| `UGUI / UI Toolkit / PanelBase` | Godot Control 节点 + Dialogic Style |
| `NarrativeSequence` 数据结构 | Dialogic `.dtl` 时间线文件 |
| `WorldStateTracker`（C# 黑板系统） | `GameState.gd`（Autoload）+ JSON 存档 |
| `ReputationManager` 声望系统 | `GameState.affinity{}` 数值好感度 |

## 仍然有效的设定（已迁移到新文档）
- ✅ 3 章主线骨架（画皮鬼 → 千佛寺 → 太平篇）
- ✅ 序章设定（穿越 + 画皮鬼必败战 + 越州城指引）
- ✅ 黄皮书任务追踪概念
- ✅ 唐末乱世世界观（这部分在 `世界观/` 目录，未受影响）

以上内容已抽取并融入 [`docs/技术方案/02-玩法范围与边界.md`](../../技术方案/02-玩法范围与边界.md)。

---

## 文件清单

| 文件 | 原用途 | 失效程度 |
|------|--------|---------|
| `需求.md` | 主线剧情系统总需求 | 🟡 剧情骨架有效，技术实现已废 |
| `构思-叙事弧引擎.md` | C# 状态机引擎设计 | 🔴 整体废弃 |
| `构思-对话UI与立绘系统.md` | UGUI 对话系统 | 🔴 整体废弃 |
| `06-2D场景交互设计规范.md` | Unity 2D 场景交互 | 🔴 整体废弃 |
| `Scene-Event-写作指南.md` | Unity 场景脚本写法 | 🔴 整体废弃 |
