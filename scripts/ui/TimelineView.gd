extends Control
## ============================================================
## TimelineView.gd —— 故事时间轴查看面板
## ------------------------------------------------------------
## 【功能】把 res://data/timeline/story_nodes.json 中定义的所有
##        故事节点渲染成一个按章节排序的列表：
##   - 已解锁节点：显示真实标题与描述
##   - 未解锁节点：标题用 "???" 占位，描述显示 "（未解锁）"
##
## 【数据来源】
##   - JSON 文件：res://data/timeline/story_nodes.json
##     格式：[ { id, chapter, order, title, description }, ... ]
##   - 解锁状态：GameState.IsStoryNodeUnlocked(id)（Autoload）
##
## 【排序规则】先按 chapter（章节）升序，再按 order（章内顺序）升序
##
## 【命名规范（UE 风格）】函数/变量大驼峰；按钮加 Btn 前缀
## ============================================================

const TIMELINE_PATH := "res://data/timeline/story_nodes.json"  # JSON 数据文件路径

# === 节点引用 ===
@onready var List: VBoxContainer = $Scroll/VBox  # 滚动区内的条目容器
@onready var BtnBack: Button = $TopBar/BtnBack   # 返回标题按钮


# Godot 引擎钦定回调
func _ready() -> void:
	BeginPlay()


## UE 风格初始化入口
func BeginPlay() -> void:
	# 返回按钮：直接发场景切换事件
	BtnBack.pressed.connect(func (): EventBus.RequestSceneChange.emit("res://scenes/title/TitleScreen.tscn"))
	Populate()


## 重建整个时间轴列表
func Populate() -> void:
	# 1) 清空旧条目
	for Child in List.get_children():
		Child.queue_free()

	# 2) 加载并排序故事节点
	var Nodes := LoadNodes()
	# 排序：先 chapter 升序，再 order 升序
	Nodes.sort_custom(func (A, B):
		if A.get("chapter", 0) != B.get("chapter", 0):
			return A.get("chapter", 0) < B.get("chapter", 0)
		return A.get("order", 0) < B.get("order", 0)
	)

	# 3) 逐条生成 UI
	for N in Nodes:
		var Item := MakeItem(N)
		List.add_child(Item)


## 从 JSON 文件加载所有故事节点定义
## @return Array[Dictionary]，文件不存在或解析失败时返回空数组
func LoadNodes() -> Array:
	if not FileAccess.file_exists(TIMELINE_PATH):
		return []
	var F := FileAccess.open(TIMELINE_PATH, FileAccess.READ)
	var T := F.get_as_text()
	F.close()
	var P = JSON.parse_string(T)
	# 防御性判断：JSON 顶层必须是数组
	return P if typeof(P) == TYPE_ARRAY else []


## 把单个故事节点定义转换成 UI 条目
## @param NodeData 字典：{ id, chapter, order, title, description }
## @return         一个 PanelContainer，可直接 add_child
func MakeItem(NodeData: Dictionary) -> Control:
	var Panel := PanelContainer.new()
	var VBox := VBoxContainer.new()
	Panel.add_child(VBox)

	# 是否已解锁（GameState 是 Autoload 单例）
	var bUnlocked: bool = GameState.IsStoryNodeUnlocked(NodeData.get("id", ""))

	# --- 标题：解锁则显示 "第X章 · 真实标题"，否则显示 "第X章 · ???" ---
	var Title := Label.new()
	Title.add_theme_font_size_override("font_size", 22)
	if bUnlocked:
		Title.text = "第%d章 · %s" % [NodeData.get("chapter", 0), NodeData.get("title", "")]
	else:
		Title.text = "第%d章 · ???" % NodeData.get("chapter", 0)
		Title.modulate = Color(0.6, 0.6, 0.6)  # 灰色暗示未解锁
	VBox.add_child(Title)

	# --- 描述：解锁则显示真实描述，否则显示 "（未解锁）" ---
	var Desc := Label.new()
	Desc.text = NodeData.get("description", "") if bUnlocked else "（未解锁）"
	Desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	VBox.add_child(Desc)
	return Panel
