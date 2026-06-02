extends Control
## DialogueScene —— 对话场景（Dialogic 2 驱动版）
##
## M1 阶段：装载 Dialogic layout，跑通一条 test 时间线。
##
## 流程：
##   1) BeginPlay() 时调用 Dialogic.start("test")
##   2) Dialogic 自动加载 default VN style 的 layout 节点
##   3) 把 layout 挂到 DialogicHost 下作为子节点
##   4) 监听 Dialogic.timeline_ended 信号 → 跳回 TimelineView
##
## 后续阶段会接入 DialogicBridge 桥接到 EventBus / SaveSystem / AchievementManager。
##
## 命名规范（UE 风格）：变量/函数大驼峰，按钮加 Btn 前缀
## 注意：Dialogic 是第三方插件，其 API（timeline_ended/timeline_started/start/end_timeline）
## 不能修改，保持 snake_case 调用即可。

const TEST_TIMELINE := "test"

@onready var DialogicHost: Control = $DialogicHost
@onready var BtnSkip: Button = $TopBarLayer/TopBar/BtnSkip
@onready var BtnSave: Button = $TopBarLayer/TopBar/BtnSave
@onready var BtnBack: Button = $TopBarLayer/TopBar/BtnBack

var LayoutNode: Node = null
var TimelineId: String = TEST_TIMELINE

# Godot 引擎钦定回调
func _ready() -> void:
	BeginPlay()

## UE 风格初始化入口
func BeginPlay() -> void:
	BtnSave.pressed.connect(OnSave)
	BtnSkip.pressed.connect(OnBackToTitle)
	BtnBack.pressed.connect(OnBackToTitle)

	# 启动 Dialogic 时间线
	# Dialogic.start() 会自动加载 layout 节点并返回它
	LayoutNode = Dialogic.start(TimelineId)
	if LayoutNode:
		# 默认 layout 会被加到 root，我们把它移到 DialogicHost 下方便管理
		if LayoutNode.get_parent():
			LayoutNode.get_parent().remove_child(LayoutNode)
		DialogicHost.add_child(LayoutNode)

	# 桥接 Dialogic 信号 → 自家 EventBus
	# 注意：Dialogic 的信号名是 snake_case，不能改
	if not Dialogic.timeline_ended.is_connected(OnTimelineEnded):
		Dialogic.timeline_ended.connect(OnTimelineEnded)
	if not Dialogic.timeline_started.is_connected(OnTimelineStarted):
		Dialogic.timeline_started.connect(OnTimelineStarted)

	# 解锁示例成就
	AchievementManager.Unlock("first_dialogue")


# Godot 引擎钦定回调
func _exit_tree() -> void:
	EndPlay()


## UE 风格的清理入口
func EndPlay() -> void:
	# 离开场景时清理 Dialogic 信号
	if Dialogic.timeline_ended.is_connected(OnTimelineEnded):
		Dialogic.timeline_ended.disconnect(OnTimelineEnded)
	if Dialogic.timeline_started.is_connected(OnTimelineStarted):
		Dialogic.timeline_started.disconnect(OnTimelineStarted)


# Godot 引擎钦定回调
func _unhandled_input(Event: InputEvent) -> void:
	if Event.is_action_pressed("ui_quick_save"):
		OnSave()


func OnTimelineStarted() -> void:
	EventBus.DialogueStarted.emit(TimelineId)


func OnTimelineEnded() -> void:
	EventBus.DialogueFinished.emit(TimelineId)
	GameState.UnlockStoryNode(TimelineId)
	EventBus.RequestToast.emit("时间线结束", 2.0)
	EventBus.RequestSceneChange.emit("res://scenes/timeline/TimelineView.tscn")


func OnSave() -> void:
	SaveSystem.SaveToSlot(0, "自动存档")
	EventBus.RequestToast.emit("已保存", 1.5)


func OnBackToTitle() -> void:
	Dialogic.end_timeline()
	EventBus.RequestSceneChange.emit("res://scenes/title/TitleScreen.tscn")
