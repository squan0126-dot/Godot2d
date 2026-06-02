# Disha

一款使用 Godot 4.6.3 (GDScript) 制作的视觉小说 / 对话冒险游戏。

## 核心特性

- 网状对话 + 分支选项（计划接入 [Dialogic 2.0](https://github.com/coppolaemilio/dialogic)）
- 全屏 CG + 底部对话框（VN 风格）
- 多槽位 JSON 存档
- 成就系统（解锁通知 / 成就列表）
- 故事时间轴（玩家可回看已解锁的剧情节点）
- 标题界面（开始 / 继续 / 读档 / 成就 / 退出）

## 目录结构

```
Disha/
├── project.godot              # 项目配置（含 autoload 注册）
├── scenes/                    # 场景 (.tscn)
│   ├── main/                  # 根场景
│   ├── title/                 # 标题界面
│   ├── dialogue/              # 对话场景
│   ├── timeline/              # 时间轴查看
│   └── achievement/           # 成就面板
├── scripts/
│   ├── autoload/              # 全局单例 (5 个)
│   │   ├── EventBus.gd        # 事件总线
│   │   ├── GameState.gd       # 全局游戏状态
│   │   ├── SaveSystem.gd      # 多槽位存档
│   │   ├── AchievementManager.gd
│   │   └── AudioManager.gd
│   ├── ui/                    # 各场景挂载脚本
│   ├── systems/               # 业务系统（待扩展）
│   └── data/                  # 资源类 (Resource) 数据定义
├── resources/                 # 美术 / 音频 / 字体 / Theme
│   ├── cgs/
│   ├── dialogues/
│   ├── audio/{bgm,sfx}/
│   ├── fonts/
│   └── themes/
├── data/                      # 配置型 JSON
│   ├── achievements/achievements.json
│   ├── timeline/story_nodes.json
│   └── saves_template/
└── addons/                    # 第三方插件（如 Dialogic）
```

## 启动

直接用 Godot 4.6.3 打开本目录即可：

```
"C:\Users\v_qxyequan\Downloads\Godot_v4.6.3-stable_win64.exe" --path "C:\Users\v_qxyequan\Documents\Disha" -e
```

按 F5 运行，将进入标题界面。

## 目标平台 & 分辨率

- **PC（Windows）+ 移动端（Android）双端**，基准分辨率 **2560×1440 (2K, 16:9)**
- Stretch：`canvas_items` + `expand`（长屏手机不黑边）
- 移动端：横屏锁定 + 运行时安全区适配（刘海屏/灵动岛/小白条）
- 渲染后端：`gl_compatibility`（低端机友好）

完整方案与实施变更见 [`docs/技术方案/01-平台与分辨率.md`](docs/技术方案/01-平台与分辨率.md)。

## Autoload 单例

| 单例                | 职责                                                    |
| ------------------- | ------------------------------------------------------- |
| `EventBus`          | 集中声明全局信号，跨模块解耦                            |
| `GameState`         | 当前一局的状态：变量、标志位、解锁的故事节点            |
| `SaveSystem`        | JSON 多槽位存档（`user://saves/save_<n>.json`）         |
| `AchievementManager`| 加载 `data/achievements/achievements.json` 并管理解锁   |
| `AudioManager`      | BGM 淡入淡出、SFX 一次性播放                            |

调用顺序约定：`EventBus` 先于其他单例（其它单例会 `emit` 它）。

## 接入 Dialogic 2.0（待办）

1. 编辑器顶部 `AssetLib` 搜索 `Dialogic` 安装。
2. `项目设置 → 插件` 中启用 `dialogic`。
3. 在 `addons/dialogic` 内编辑时间线（.dtl）。
4. 在 `DialogueScene.gd` 内将示例 `_demo_lines` 替换为：

```gdscript
var layout := Dialogic.start("intro")
add_child(layout)
Dialogic.timeline_ended.connect(_on_dialogue_end)
```

## 输入映射

| Action            | 默认按键           | 用途             |
| ----------------- | ------------------ | ---------------- |
| `ui_advance`      | 空格 / 鼠标左键     | 推进对话         |
| `ui_skip`         | Ctrl               | 跳过             |
| `ui_quick_save`   | F5                 | 快速存档（slot 0）|
| `ui_quick_load`   | F6                 | 快速读档（slot 0）|

## 存档格式

存档为明文 JSON，位于 `%APPDATA%/Godot/app_userdata/Disha/saves/save_<slot>.json`。

## 架构要点（写给将来的自己）

- **不要堆 UI 单例**，所有 UI 都是 Control 节点，由 `Main.tscn` 的 `SceneRoot` 持有当前场景，旧场景 `queue_free()`。
- **跨模块通信只走 EventBus 信号**，不要互相 import。
- **数据驱动**：成就、时间轴节点放在 `data/*.json`；新增内容只改 JSON，不改代码。
- **存档统一走 SaveSystem**，业务模块提供 `to_dict / from_dict` 接口给它调用。

## AI 编码辅助（可选）

本仓库提供 [Godot MCP](https://github.com/Coding-Solo/godot-mcp) 的示例配置，让 AI 助手（Cursor / Cline / Claude Desktop / 腾讯 gongfeng-copilot 等）能直接打开项目、运行场景、读取报错、增删节点等。

详见 [`.mcp/README.md`](.mcp/README.md) 与示例配置 [`.mcp/godot-mcp.example.json`](.mcp/godot-mcp.example.json)。

非必要，纯手写代码完全不影响游戏运行。
