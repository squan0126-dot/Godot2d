extends Node
## GameState —— 全局游戏状态（Autoload 单例）
##
## 持有"当前一局"的状态数据：
## - 玩家变量 / 标志位（Flags）
## - 当前对话 ID
## - 已解锁的故事节点
## - 当前场景 / CG
##
## 注意：本节点的字段会被 SaveSystem 序列化到 JSON。
## JSON 字段名（如 "variables"、"flags"）保持 snake_case 以兼容存档格式。
## 凡是新增需要存档的字段，请放进 ToDict() / FromDict()。
##
## 命名规范（UE 风格）：
## - 变量：PascalCase（大驼峰），如 Variables、Flags
## - 函数：PascalCase（大驼峰），如 SetFlag()、UnlockStoryNode()
## - 引擎回调：保留下划线 _ready / _process（Godot 钦定）

# 玩家自定义变量（剧情用，比如好感度、声望、关键道具）
var Variables: Dictionary = {}

# 故事标志位：用于对话条件分支（key -> bool / int / String）
var Flags: Dictionary = {}

# 已解锁的故事节点 ID 列表（时间轴用）
var UnlockedStoryNodes: Array[String] = []

# 当前对话 ID（空表示无对话）
var CurrentDialogueId: String = ""

# 当前 CG ID
var CurrentCGId: String = ""

# 玩家在游戏内的累计游玩时长（秒）
var PlayTimeSeconds: float = 0.0


# Godot 引擎钦定的回调，名字不能改
func _process(Delta: float) -> void:
	Tick(Delta)


## UE 风格的每帧更新（自定义入口）
func Tick(Delta: float) -> void:
	PlayTimeSeconds += Delta


# ============== 标志位 API ==============
func SetFlag(Key: String, Value: Variant) -> void:
	Flags[Key] = Value
	EventBus.FlagChanged.emit(Key, Value)


func GetFlag(Key: String, DefaultValue: Variant = null) -> Variant:
	return Flags.get(Key, DefaultValue)


func HasFlag(Key: String) -> bool:
	return Flags.has(Key)


# ============== 故事节点 API ==============
func UnlockStoryNode(NodeId: String) -> void:
	if not UnlockedStoryNodes.has(NodeId):
		UnlockedStoryNodes.append(NodeId)
		EventBus.StoryNodeUnlocked.emit(NodeId)


func IsStoryNodeUnlocked(NodeId: String) -> bool:
	return UnlockedStoryNodes.has(NodeId)


# ============== 序列化 ==============
## 把状态导出为字典（供 SaveSystem 写入 JSON）
## 注意：JSON 的 key 保持 snake_case 以兼容旧存档
func ToDict() -> Dictionary:
	return {
		"variables": Variables.duplicate(true),
		"flags": Flags.duplicate(true),
		"unlocked_story_nodes": UnlockedStoryNodes.duplicate(),
		"current_dialogue_id": CurrentDialogueId,
		"current_cg_id": CurrentCGId,
		"play_time_seconds": PlayTimeSeconds,
	}


## 从字典恢复状态（供 SaveSystem 读档时调用）
func FromDict(Data: Dictionary) -> void:
	Variables = Data.get("variables", {})
	Flags = Data.get("flags", {})
	var Nodes: Array = Data.get("unlocked_story_nodes", [])
	UnlockedStoryNodes.clear()
	for N in Nodes:
		UnlockedStoryNodes.append(str(N))
	CurrentDialogueId = Data.get("current_dialogue_id", "")
	CurrentCGId = Data.get("current_cg_id", "")
	PlayTimeSeconds = Data.get("play_time_seconds", 0.0)


## 重置为新游戏初始态
func ResetToNewGame() -> void:
	Variables.clear()
	Flags.clear()
	UnlockedStoryNodes.clear()
	CurrentDialogueId = ""
	CurrentCGId = ""
	PlayTimeSeconds = 0.0
