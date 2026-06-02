extends Node
## AudioManager —— 音频管理（Autoload 单例）
##
## 提供：
## - BGM 播放/停止/淡入淡出
## - SFX 播放（一次性）
## - 主音量控制
##
## 命名规范（UE 风格）：变量/函数大驼峰，常量全大写

const BUS_MASTER := "Master"

@onready var BGMPlayer: AudioStreamPlayer = AudioStreamPlayer.new()
@onready var SFXPlayer: AudioStreamPlayer = AudioStreamPlayer.new()

var CurrentBGMPath: String = ""


# Godot 引擎钦定回调
func _ready() -> void:
	BeginPlay()


## UE 风格初始化入口
func BeginPlay() -> void:
	add_child(BGMPlayer)
	add_child(SFXPlayer)
	BGMPlayer.bus = BUS_MASTER
	SFXPlayer.bus = BUS_MASTER


# ============== BGM ==============
func PlayBGM(Path: String, FadeIn: float = 0.5) -> void:
	if Path == CurrentBGMPath and BGMPlayer.playing:
		return
	var Stream: AudioStream = load(Path)
	if Stream == null:
		push_warning("[Audio] 找不到 BGM: %s" % Path)
		return
	CurrentBGMPath = Path
	BGMPlayer.stream = Stream
	BGMPlayer.volume_db = -40.0 if FadeIn > 0.0 else 0.0
	BGMPlayer.play()
	if FadeIn > 0.0:
		var FadeTween := create_tween()
		FadeTween.tween_property(BGMPlayer, "volume_db", 0.0, FadeIn)


func StopBGM(FadeOut: float = 0.5) -> void:
	if not BGMPlayer.playing:
		return
	if FadeOut <= 0.0:
		BGMPlayer.stop()
		CurrentBGMPath = ""
		return
	var FadeTween := create_tween()
	FadeTween.tween_property(BGMPlayer, "volume_db", -40.0, FadeOut)
	FadeTween.tween_callback(func ():
		BGMPlayer.stop()
		CurrentBGMPath = ""
	)


# ============== SFX ==============
func PlaySFX(Path: String) -> void:
	var Stream: AudioStream = load(Path)
	if Stream == null:
		push_warning("[Audio] 找不到 SFX: %s" % Path)
		return
	SFXPlayer.stream = Stream
	SFXPlayer.play()


# ============== 音量 ==============
## 设置主音量 0.0~1.0
func SetMasterVolume(Linear: float) -> void:
	var Idx := AudioServer.get_bus_index(BUS_MASTER)
	AudioServer.set_bus_volume_db(Idx, linear_to_db(clamp(Linear, 0.0, 1.0)))
