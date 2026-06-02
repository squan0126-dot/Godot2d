extends Control
## ============================================================
## TitleScreen.gd —— 标题界面（游戏首屏）
## ------------------------------------------------------------
## 【功能】游戏启动后第一个看到的画面，提供 5 个入口：
##   - 开始新游戏：重置存档状态 → 进入对话场景
##   - 继续：从 0 号槽位读档（若有）→ 进入对话场景
##   - 读档：列出所有槽位（M1 仅打印 + Toast，UI 待实现）
##   - 成就：跳转到 AchievementPanel 场景
##   - 退出：调用 SceneTree.quit()
##
## 【交互细节】
## - 没有自动存档时，"继续"按钮自动 disabled
## - 所有跳转通过 EventBus.RequestSceneChange 发事件，由 Main.gd 统一处理
##
## 【命名规范（UE 风格）】
## - 函数大驼峰，按钮变量加 Btn 前缀
## - "On..." 前缀的函数都是按钮回调
## ============================================================

# === 节点引用（场景树路径见 TitleScreen.tscn） ===
@onready var BtnNew: Button = $Center/VBox/BtnNew                  # 新游戏
@onready var BtnContinue: Button = $Center/VBox/BtnContinue        # 继续（读 0 号槽位）
@onready var BtnLoad: Button = $Center/VBox/BtnLoad                # 读档
@onready var BtnAchievement: Button = $Center/VBox/BtnAchievement  # 成就
@onready var BtnQuit: Button = $Center/VBox/BtnQuit                # 退出


# Godot 引擎钦定回调
func _ready() -> void:
	BeginPlay()


## UE 风格初始化入口：连接所有按钮信号 + 设定初始可用性
func BeginPlay() -> void:
	# 把每个按钮 pressed 信号挂到对应 OnXxx 回调
	BtnNew.pressed.connect(OnNewGame)
	BtnContinue.pressed.connect(OnContinue)
	BtnLoad.pressed.connect(OnLoadGame)
	BtnAchievement.pressed.connect(OnAchievement)
	BtnQuit.pressed.connect(OnQuit)

	# 没有 0 号槽位的存档时禁用"继续"按钮
	# SaveSystem 是 Autoload 单例，HasSave(slot) 返回 bool
	BtnContinue.disabled = not SaveSystem.HasSave(0)


# ============== 按钮回调 ==============

## 新游戏：清空进度 → 进入对话
func OnNewGame() -> void:
	GameState.ResetToNewGame()  # 重置好感度/侠义值/已解锁节点等
	EventBus.RequestSceneChange.emit("res://scenes/dialogue/DialogueScene.tscn")


## 继续：从 0 号槽位读档；读档失败则什么都不做（按钮已禁用过滤过）
func OnContinue() -> void:
	if SaveSystem.LoadFromSlot(0):
		EventBus.RequestSceneChange.emit("res://scenes/dialogue/DialogueScene.tscn")


## 读档：M1 阶段先打印槽位列表 + 弹个 Toast 提示
## TODO: M2 阶段实现真正的 LoadGamePanel 选择界面
func OnLoadGame() -> void:
	var Slots := SaveSystem.ListAllSlots()
	print("可用存档槽位：", Slots)
	EventBus.RequestToast.emit("读档界面待实现，已打印到控制台。", 2.0)


## 成就：直接跳到成就面板（实际数据由 AchievementManager 提供）
func OnAchievement() -> void:
	EventBus.RequestSceneChange.emit("res://scenes/achievement/AchievementPanel.tscn")


## 退出：调用 SceneTree.quit() 关闭游戏窗口
func OnQuit() -> void:
	get_tree().quit()
