extends Node
## SaveSystem —— 存档系统（Autoload 单例）
##
## 设计：
## - 多槽位（slot 0..N），每个槽位一个 JSON 文件
## - 存放在 user:// 目录（Windows 下是 %APPDATA%/Godot/app_userdata/Disha/）
## - JSON 明文，便于调试；后续可加加密/校验
##
## 槽位约定：
##   slot 0 = 自动存档
##   slot 1..9 = 手动存档槽
##
## 命名规范（UE 风格）：变量/函数大驼峰，常量全大写
## JSON 字段保持 snake_case 兼容存档格式

const SAVE_DIR := "user://saves/"
const SAVE_PREFIX := "save_"
const SAVE_EXT := ".json"
const SAVE_VERSION := 1
const MAX_SLOTS := 10


# Godot 引擎钦定回调
func _ready() -> void:
	BeginPlay()


## UE 风格初始化入口
func BeginPlay() -> void:
	EnsureSaveDir()


func EnsureSaveDir() -> void:
	if not DirAccess.dir_exists_absolute(SAVE_DIR):
		DirAccess.make_dir_recursive_absolute(SAVE_DIR)


func PathForSlot(Slot: int) -> String:
	return "%s%s%d%s" % [SAVE_DIR, SAVE_PREFIX, Slot, SAVE_EXT]


# ============== 写存档 ==============
## 把 GameState 当前状态写入指定槽位
## SaveLabel: 存档显示名（避免与 Godot 内置类 Label 同名）
func SaveToSlot(Slot: int, SaveLabel: String = "") -> bool:
	if Slot < 0 or Slot >= MAX_SLOTS:
		push_error("[SaveSystem] 非法槽位: %d" % Slot)
		return false
	EnsureSaveDir()
	var Payload := {
		"version": SAVE_VERSION,
		"slot": Slot,
		"label": SaveLabel,
		"timestamp": Time.get_datetime_string_from_system(false, true),
		"play_time": GameState.PlayTimeSeconds,
		"game_state": GameState.ToDict(),
		"achievements": AchievementManager.ToDict(),
	}
	var JsonText := JSON.stringify(Payload, "\t")
	var File := FileAccess.open(PathForSlot(Slot), FileAccess.WRITE)
	if File == null:
		push_error("[SaveSystem] 无法写入存档: slot %d, err=%d" % [Slot, FileAccess.get_open_error()])
		return false
	File.store_string(JsonText)
	File.close()
	EventBus.SaveCompleted.emit(Slot)
	print("[SaveSystem] 存档完成: slot %d" % Slot)
	return true


# ============== 读存档 ==============
## 从指定槽位读取并恢复到 GameState
func LoadFromSlot(Slot: int) -> bool:
	if not HasSave(Slot):
		push_warning("[SaveSystem] 槽位 %d 无存档" % Slot)
		return false
	var File := FileAccess.open(PathForSlot(Slot), FileAccess.READ)
	if File == null:
		push_error("[SaveSystem] 无法打开存档: slot %d" % Slot)
		return false
	var Text := File.get_as_text()
	File.close()
	var Parsed = JSON.parse_string(Text)
	if typeof(Parsed) != TYPE_DICTIONARY:
		push_error("[SaveSystem] 存档解析失败: slot %d" % Slot)
		return false
	var Payload: Dictionary = Parsed
	# 版本兼容性处理（暂时只支持 v1）
	var Ver: int = int(Payload.get("version", 0))
	if Ver != SAVE_VERSION:
		push_warning("[SaveSystem] 存档版本不匹配 (got %d expect %d)，仍尝试加载" % [Ver, SAVE_VERSION])
	GameState.FromDict(Payload.get("game_state", {}))
	AchievementManager.FromDict(Payload.get("achievements", {}))
	EventBus.LoadCompleted.emit(Slot)
	print("[SaveSystem] 读档完成: slot %d" % Slot)
	return true


# ============== 工具方法 ==============
func HasSave(Slot: int) -> bool:
	return FileAccess.file_exists(PathForSlot(Slot))


## 获取槽位元信息（不加载游戏状态），用于读档界面预览
func GetSlotMeta(Slot: int) -> Dictionary:
	if not HasSave(Slot):
		return {}
	var File := FileAccess.open(PathForSlot(Slot), FileAccess.READ)
	if File == null:
		return {}
	var Text := File.get_as_text()
	File.close()
	var Parsed = JSON.parse_string(Text)
	if typeof(Parsed) != TYPE_DICTIONARY:
		return {}
	return {
		"slot": Slot,
		"label": Parsed.get("label", ""),
		"timestamp": Parsed.get("timestamp", ""),
		"play_time": Parsed.get("play_time", 0.0),
	}


func ListAllSlots() -> Array[Dictionary]:
	var Result: Array[Dictionary] = []
	for I in range(MAX_SLOTS):
		var Meta := GetSlotMeta(I)
		if not Meta.is_empty():
			Result.append(Meta)
	return Result


func DeleteSlot(Slot: int) -> bool:
	if not HasSave(Slot):
		return false
	var Err := DirAccess.remove_absolute(PathForSlot(Slot))
	return Err == OK
