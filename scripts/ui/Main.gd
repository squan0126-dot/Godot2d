extends Node
## ============================================================
## Main.gd —— 游戏根入口（对应 UE 中的 AGameMode + AHUD 简化版）
## ------------------------------------------------------------
## 【场景结构】（详见 Main.tscn）
##   Main (Control, mouse_filter=IGNORE)        ← 本脚本挂载点
##   ├─ SceneRoot (Control, mouse_filter=PASS)  ← 子场景挂载点
##   └─ ToastLayer (CanvasLayer, layer=100)     ← 浮层
##       └─ ToastLabel (Label, mouse_filter=IGNORE) ← 提示文字
##
## 【职责】
## - 游戏启动时进入标题界面（TitleScreen）
## - 监听 EventBus.RequestSceneChange 事件，统一处理场景切换
## - 监听 EventBus.RequestToast 事件，显示淡入淡出的全局提示
## - 持有当前正在显示的子场景 CurrentScene，切换时负责销毁旧场景
##
## 【为什么这样设计】
## 子场景之间不直接 change_scene_to_file，而是通过 EventBus 发事件：
## 1) 解耦——子场景不需要知道"切到哪、谁来切"
## 2) 集中——切换前后的统一处理（动画、清场、保存）都放这里
## 3) 测试方便——单独跑某个子场景时不会因 Main 缺失而崩溃
##
## 【命名规范（UE 风格）】变量/函数大驼峰，私有内部变量用大驼峰
## ============================================================


# === 节点引用（@onready 在 _ready() 之前自动赋值） ===
@onready var SceneRoot: Control = $SceneRoot            # 子场景挂载点
@onready var ToastLabel: Label = $ToastLayer/ToastLabel # 全局 Toast 文字

# === 运行时状态 ===
var CurrentScene: Node = null  # 当前已挂载的子场景实例（每次只有一个）


# Godot 引擎钦定回调：节点首次进入场景树时调用
func _ready() -> void:
	# 把所有初始化逻辑都丢到 BeginPlay() 里，统一 UE 风格入口
	BeginPlay()


## UE 风格的真正入口
## 在这里完成：事件订阅、初始 UI 状态、跳转到首屏
func BeginPlay() -> void:
	# 订阅全局事件总线（EventBus 是 Autoload 单例）
	EventBus.RequestSceneChange.connect(OnRequestSceneChange)
	EventBus.RequestToast.connect(OnRequestToast)

	# 初始 Toast 不可见
	ToastLabel.visible = false

	# 启动后先进标题界面
	ChangeScene("res://scenes/title/TitleScreen.tscn")


## EventBus.RequestSceneChange 的回调
func OnRequestSceneChange(Path: String) -> void:
	ChangeScene(Path)


## 真正执行场景切换：销毁旧场景 → 加载新场景 → 挂到 SceneRoot
func ChangeScene(Path: String) -> void:
	print("[Main] ChangeScene -> %s" % Path)

	# 1) 销毁当前场景
	if CurrentScene:
		CurrentScene.queue_free()
		CurrentScene = null

	# 2) 加载 PackedScene 资源
	var Packed: PackedScene = load(Path)
	if Packed == null:
		push_error("[Main] 无法加载场景: %s" % Path)
		return

	# 3) 实例化并挂载
	CurrentScene = Packed.instantiate()
	if CurrentScene == null:
		push_error("[Main] instantiate 失败: %s" % Path)
		return
	SceneRoot.add_child(CurrentScene)


# ============== Toast 提示 ==============

## EventBus.RequestToast 的回调：在屏幕左上角显示一段淡出的提示文字
func OnRequestToast(Text: String, Duration: float) -> void:
	ToastLabel.text = Text
	ToastLabel.visible = true
	ToastLabel.modulate.a = 1.0

	# 注意：本地变量名故意不叫 Tween，避免与 Godot 内置类型 Tween 同名
	var FadeTween := create_tween()
	FadeTween.tween_interval(Duration)
	FadeTween.tween_property(ToastLabel, "modulate:a", 0.0, 0.4)
	FadeTween.tween_callback(HideToast)


## 淡出动画结束后真正隐藏节点
func HideToast() -> void:
	ToastLabel.visible = false
