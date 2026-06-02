extends Control
## ============================================================
## AchievementPanel.gd —— 成就列表面板
## ------------------------------------------------------------
## 【功能】把 AchievementManager 中所有成就定义渲染成一个滚动列表：
##   - 每条成就显示：名称 / 描述 / 状态（已解锁 / 未解锁）
##   - 已解锁：高亮颜色；未解锁：灰色
##   - 隐藏成就（hidden=true）：未解锁前显示为 "???"
##
## 【数据来源】AchievementManager（Autoload 单例）
##   - GetAllDefinitions() 返回所有成就定义 Array[Dictionary]
##   - IsUnlocked(id) 判断是否解锁
##   - GetUnlockedCount() / GetTotalCount() 用于顶部统计 "X / Y"
##
## 【命名规范（UE 风格）】函数/变量大驼峰；按钮加 Btn 前缀
## ============================================================

# === 节点引用 ===
@onready var List: VBoxContainer = $Scroll/VBox  # 滚动区内的成就条目容器
@onready var BtnBack: Button = $TopBar/BtnBack   # 返回标题按钮
@onready var Stat: Label = $TopBar/Stat          # 顶部 "已解锁/总数" 文字


# Godot 引擎钦定回调
func _ready() -> void:
	BeginPlay()


## UE 风格初始化入口
func BeginPlay() -> void:
	# 返回按钮：用 lambda 直接发送切场景事件（逻辑足够简单不必单开一个函数）
	BtnBack.pressed.connect(func (): EventBus.RequestSceneChange.emit("res://scenes/title/TitleScreen.tscn"))
	Populate()


## 重建整个成就列表
## - 先清空旧条目，避免重复打开时叠加
## - 再按 AchievementManager 中的定义顺序逐个生成 UI
func Populate() -> void:
	# 1) 清空旧条目（queue_free 安全释放）
	for Child in List.get_children():
		Child.queue_free()

	# 2) 顶部统计文字 "已解锁数 / 总数"
	Stat.text = "%d / %d" % [AchievementManager.GetUnlockedCount(), AchievementManager.GetTotalCount()]

	# 3) 逐条生成成就 UI
	for Def in AchievementManager.GetAllDefinitions():
		var D: Dictionary = Def
		List.add_child(MakeItem(D))


## 把单条成就定义转换成一个可视化 UI 节点
## @param Def 成就定义字典：{ id, name, description, hidden }
## @return    一个完整的 PanelContainer 节点，可直接 add_child
func MakeItem(Def: Dictionary) -> Control:
	# 外层 Panel（带背景）
	var Panel := PanelContainer.new()
	var HBox := HBoxContainer.new()
	Panel.add_child(HBox)

	# 状态标记
	var bUnlocked: bool = AchievementManager.IsUnlocked(Def.get("id", ""))
	# 隐藏成就：未解锁前不显示真名 / 描述
	var bHidden: bool = Def.get("hidden", false) and not bUnlocked

	# --- 左侧：名称 + 描述（VBox） ---
	var VBox := VBoxContainer.new()
	VBox.size_flags_horizontal = Control.SIZE_EXPAND_FILL  # 占满剩余宽度
	HBox.add_child(VBox)

	# 成就名（大字号，未解锁灰色，隐藏成就显示为 "???"）
	var NameLabel := Label.new()
	NameLabel.add_theme_font_size_override("font_size", 20)
	NameLabel.text = "???" if bHidden else Def.get("name", "")
	if not bUnlocked:
		NameLabel.modulate = Color(0.55, 0.55, 0.55)
	VBox.add_child(NameLabel)

	# 描述（自动换行）
	var Desc := Label.new()
	Desc.text = "（隐藏成就）" if bHidden else Def.get("description", "")
	Desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	VBox.add_child(Desc)

	# --- 右侧：状态文字（绿色=已解锁 / 灰色=未解锁） ---
	var Status := Label.new()
	Status.text = "已解锁" if bUnlocked else "未解锁"
	Status.modulate = Color(0.4, 1.0, 0.4) if bUnlocked else Color(0.6, 0.6, 0.6)
	HBox.add_child(Status)
	return Panel