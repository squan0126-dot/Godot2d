# 字体资源说明

> 本项目目标平台：PC + 移动端，基准分辨率 2560×1440（2K）
> 推荐字号已写入 `resources/themes/main.tres`：默认 32 / 正文 36

## 推荐字体（开源免费、商用安全）

### 主字体 · 思源宋体 SC（古风志怪贴合）

| 用途 | 字重 | 文件名 |
|------|------|--------|
| 正文 / 旁白 | Regular | `source_han_serif_sc_regular.otf` |
| 角色名 / 标题 | Bold | `source_han_serif_sc_bold.otf` |

**下载**：
- 官方 GitHub：<https://github.com/adobe-fonts/source-han-serif/releases>
- 选 `Language Specific OTF / SimplifiedChinese / SC.zip`
- 解压后将 `SourceHanSerifSC-Regular.otf` 与 `SourceHanSerifSC-Bold.otf` 拷贝到本目录并改名为上表文件名。

**License**：SIL Open Font License 1.1（自由商用）。

### 备选 · 霞鹜文楷（更书法味）
- GitHub：<https://github.com/lxgw/LxgwWenKai>

## 接入方式

1. 把 `.otf` 文件放进本目录。
2. 编辑 `resources/themes/main.tres`，在 Theme 中加 `default_font` 引用。
3. 所有 `Control` 节点会自动继承 Theme，无需逐个设置。

## 当前状态

- [ ] 占位（Godot 默认字体，中文显示正常但无风格）
- [ ] 已放入思源宋体（待补）
