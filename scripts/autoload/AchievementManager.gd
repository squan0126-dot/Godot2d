extends Node
## AchievementManager —— 成就系统（Autoload 单例）
##
## 数据来源：res://data/achievements/achievements.json
## 解锁状态：随存档一起持久化（由 SaveSystem 调用 ToDict / FromDict）
##
## 成就 JSON 结构（每条）：
##   {
##     "id": "first_dialogue",
##     "name": "初次对话",
##     "description": "完成第一段对话",
##     "icon": "res://resources/cgs/ach_default.png",
##     "hidden": false
##   }
##
## 命名规范（UE 风格）：变量/函数大驼峰，常量全大写

const ACHIEVEMENTS_DEF_PATH := "res://data/achievements/achievements.json"

# 所有成就定义：id -> Dictionary
var Definitions: Dictionary = {}
# 已解锁成就 id -> 解锁时间（ISO 字符串）
var Unlocked: Dictionary = {}


# Godot 引擎钦定回调，保留下划线
func _ready() -> void:
	BeginPlay()


## UE 风格初始化入口
func BeginPlay() -> void:
	LoadDefinitions()


func LoadDefinitions() -> void:
	if not FileAccess.file_exists(ACHIEVEMENTS_DEF_PATH):
		push_warning("[Achievement] 定义文件不存在: %s" % ACHIEVEMENTS_DEF_PATH)
		return
	var File := FileAccess.open(ACHIEVEMENTS_DEF_PATH, FileAccess.READ)
	var Text := File.get_as_text()
	File.close()
	var Parsed = JSON.parse_string(Text)
	if typeof(Parsed) != TYPE_ARRAY:
		push_error("[Achievement] 定义格式错误，应为数组")
		return
	for Item in Parsed:
		if typeof(Item) == TYPE_DICTIONARY and Item.has("id"):
			Definitions[Item["id"]] = Item
	print("[Achievement] 已加载 %d 个成就定义" % Definitions.size())


# ============== 解锁 API ==============
func Unlock(AchievementId: String) -> bool:
	if not Definitions.has(AchievementId):
		push_warning("[Achievement] 未知成就 id: %s" % AchievementId)
		return false
	if Unlocked.has(AchievementId):
		return false  # 已解锁，不重复触发
	Unlocked[AchievementId] = Time.get_datetime_string_from_system(false, true)
	var Def: Dictionary = Definitions[AchievementId]
	EventBus.AchievementUnlocked.emit(AchievementId)
	EventBus.RequestToast.emit("🏆 解锁成就：%s" % Def.get("name", AchievementId), 3.0)
	print("[Achievement] 解锁: %s" % AchievementId)
	return true


func IsUnlocked(AchievementId: String) -> bool:
	return Unlocked.has(AchievementId)


func GetDefinition(AchievementId: String) -> Dictionary:
	return Definitions.get(AchievementId, {})


func GetAllDefinitions() -> Array:
	return Definitions.values()


func GetUnlockedCount() -> int:
	return Unlocked.size()


func GetTotalCount() -> int:
	return Definitions.size()


# ============== 序列化 ==============
## JSON 字段保持 snake_case 兼容旧存档
func ToDict() -> Dictionary:
	return {"unlocked": Unlocked.duplicate(true)}


func FromDict(Data: Dictionary) -> void:
	Unlocked = Data.get("unlocked", {})
