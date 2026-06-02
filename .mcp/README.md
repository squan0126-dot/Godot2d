# Godot MCP 配置说明

本目录提供 **[Godot MCP](https://github.com/Coding-Solo/godot-mcp)** 的示例配置，让 AI 编码助手（Cursor / Cline / Claude Desktop / 腾讯 gongfeng-copilot 等）能够直接驱动 Godot 4 编辑器：启动编辑器、运行项目、读取调试输出、创建场景节点、保存场景等。

> 本目录**仅供参考**，不会被 Godot 引擎本身加载，可以安全保留在仓库中。

---

## 这是什么？

**MCP（Model Context Protocol）** 是 Anthropic 提出的一种协议，让 AI 助手能调用本地工具。`@coding-solo/godot-mcp` 是一个开源 MCP Server，把 Godot 编辑器的常用能力暴露给 AI，配合本项目可以做到：

- 让 AI 帮你**直接打开当前项目**（而不是叫你手动开编辑器）
- 让 AI **运行场景并读取报错**，自动修 bug
- 让 AI **创建/添加/保存场景节点**
- 查询项目元数据、Godot 版本、UID 等

---

## 提供的 14 个工具

| 工具                  | 用途                              |
| --------------------- | --------------------------------- |
| `launch_editor`       | 用 Godot 编辑器打开指定项目       |
| `run_project`         | 运行项目（可指定场景）            |
| `stop_project`        | 停止当前正在运行的项目            |
| `get_debug_output`    | 读取运行时输出与报错              |
| `get_godot_version`   | 查询本机 Godot 版本               |
| `get_project_info`    | 读取 project.godot 元数据         |
| `list_projects`       | 列出指定目录下的所有 Godot 项目   |
| `create_scene`        | 新建一个 .tscn 场景               |
| `add_node`            | 向场景里添加节点                  |
| `load_sprite`         | 给 Sprite2D 节点加载贴图          |
| `save_scene`          | 保存场景                          |
| `export_mesh_library` | 把场景导出为 MeshLibrary 资源     |
| `get_uid`             | 获取文件的 UID（Godot 4.4+）      |
| `update_project_uids` | 重新生成项目 UID 引用（Godot 4.4+）|

---

## 安装步骤

### 1. 准备环境

| 依赖     | 最低版本          | 说明                                 |
| -------- | ----------------- | ------------------------------------ |
| Node.js  | 18+               | `npx` 由 Node 自带                   |
| Godot    | 4.x（推荐 4.4+）  | 需要能从命令行调用的可执行文件路径   |

### 2. 选定你的 AI 工具

下面以几种主流工具为例，告诉你把示例配置放到哪。

#### 🔧 Cursor

把 [`godot-mcp.example.json`](./godot-mcp.example.json) 里的 `mcpServers.godot` 节点合并到：

- Windows: `%USERPROFILE%\.cursor\mcp.json`
- macOS / Linux: `~/.cursor/mcp.json`

#### 🔧 Cline (VSCode 扩展)

合并到：

- Windows: `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
- macOS: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

#### 🔧 Claude Desktop

合并到：

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

#### 🔧 腾讯 gongfeng-copilot

合并到：

- Windows: `%USERPROFILE%\.gongfeng-copilot\mcp.json`

### 3. 替换 `GODOT_PATH`

把示例里的占位符换成**你本机** Godot 可执行文件的绝对路径。

| 系统    | 路径示例                                                          |
| ------- | ----------------------------------------------------------------- |
| Windows | `C:/Tools/Godot/Godot.exe` 或 `C:/Users/<你>/Downloads/Godot_v4.6.3-stable_win64.exe` |
| macOS   | `/Applications/Godot.app/Contents/MacOS/Godot`                    |
| Linux   | `/usr/bin/godot` 或 `~/bin/Godot.x86_64`                          |

> ⚠️ Windows 下 JSON 里的反斜杠要写成 `\\` 或者直接用正斜杠 `/`，否则解析失败。

### 4. 重启 AI 工具

完全退出再打开，让它重新加载 MCP 配置。看到 `godot` 节点为绿色 / 已连接即可。

---

## 最小配置（直接复制版）

```json
{
  "mcpServers": {
    "godot": {
      "command": "npx",
      "args": ["-y", "@coding-solo/godot-mcp"],
      "env": {
        "GODOT_PATH": "C:/Tools/Godot/Godot.exe"
      },
      "type": "stdio"
    }
  }
}
```

---

## 试一试

配好后，在 AI 对话框里直接说：

> 帮我用 Godot 打开这个项目并运行 Main 场景，报错贴给我

或者：

> 在 scenes/main/Main.tscn 的根节点下加一个 ColorRect 节点，命名为 Background，然后保存

AI 会自动调用对应的 MCP 工具完成。

---

## 常见问题

**Q: 提示 `npx: command not found`？**
A: 没装 Node.js 或没把它加到 PATH。安装 [Node.js LTS](https://nodejs.org/) 后重启终端 / AI 工具即可。

**Q: 启动 Godot 卡住没反应？**
A: 99% 是 `GODOT_PATH` 写错。在终端里手动跑一遍 `"<你填的路径>" --version`，能输出版本号才算对。

**Q: macOS 报 “xxx is damaged”？**
A: Godot 没签名，跑一次 `xattr -dr com.apple.quarantine /Applications/Godot.app`。

**Q: 想完全自己搭 Godot MCP，不用 npm 包？**
A: 参考上游仓库 [Coding-Solo/godot-mcp](https://github.com/Coding-Solo/godot-mcp)，clone 下来 `npm i && npm run build`，然后把 `command` 改成 `node`，`args` 指向构建产物即可。

---

## 不会上传敏感信息

仓库里**只**有这份示例配置（脱敏 + 占位符）和这篇说明，**不会**包含任何本机绝对路径、用户名或其他项目的 MCP 配置。各人根据上面步骤自行填写本机路径即可。
