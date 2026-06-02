# UE5 老用户的 Godot 4 上手对照表

> 写给从 UE5 / Unity 转到 Godot 4.6 的工程师。本表只列**心智模型差异**，不抄文档。

---

## 1. 概念映射（最重要，先读这个）

| UE5                                | Unity                              | Godot 4                                  | 备注                                       |
|------------------------------------|------------------------------------|------------------------------------------|--------------------------------------------|
| Actor                              | GameObject                         | Node                                     | Godot 万物皆 Node，且**节点本身有行为**    |
| Component                          | Component                          | **子 Node**                              | Godot 没有 Component，用嵌套节点表达       |
| Blueprint Class / Class            | Prefab + MonoBehaviour             | **Scene (.tscn) + Script (.gd)**         | 一个 .tscn 就是一个"预制体+组件"组合       |
| Level (.umap)                      | Scene (.unity)                     | 也是 .tscn                               | Godot 的 Scene 既是关卡也是预制体          |
| World                              | SceneManager.activeScene           | SceneTree (get_tree())                 | 全局只有一个 SceneTree                     |
| GameInstance / GameMode 单例       | DontDestroyOnLoad 单例             | **Autoload (Singleton)**                 | 在 Project Settings 里登记                 |
| UFUNCTION/Event Dispatcher         | UnityEvent / C# event              | signal                                 | 一等公民，连线由编辑器或 connect() 完成  |
| TickComponent / Tick               | Update / FixedUpdate               | _process(delta) / _physics_process   | 同样是回调，命名前缀 _ 表示生命周期      |
| BeginPlay                          | Start / Awake                      | _ready()                               | 节点进入树后调用                           |
| GC + UPROPERTY                     | GC + [SerializeField]              | 引用计数 (RefCounted) + @export        | @export var hp:int = 100 直接出现在面板  |
| FString / FName                    | string                             | String / StringName                      | &"foo" 是 StringName 字面量              |
| TArray / TMap                      | List / Dictionary                  | Array / Dictionary                       | 没有泛型限制，类型注解可选                 |
| FVector                            | Vector3                            | Vector3 / Vector2                        | 多数 2D 游戏只用 Vector2                   |
| BP Casting (Cast To)               | as / GetComponent                  | s 关键字                              | ar p := node as Player                  |
| Construction Script                | OnValidate                         | @tool + _ready()                     | 加 @tool 让脚本在编辑器里也跑            |
| GameplayTags                       | Tag / Layer                        | Groups + node dd_to_group("enemy")   | 用 get_tree().get_nodes_in_group() 查询  |
| Soft Reference                     | AssetReference                     | preload() / load()                   | preload 是编译期，load 是运行期            |
| Niagara                            | VFX Graph                          | GPUParticles2D / 3D                      |                                            |
| UMG                                | uGUI / UI Toolkit                  | **Control 节点树**                       | UI 也是节点；不要再混用两套 UI 系统！      |
| Sequencer                          | Timeline                           | AnimationPlayer (+ AnimationTree)        | 关键帧 + 调用方法 + 触发信号都能做         |
| Behavior Tree                      | -                                  | 无内建（用插件 LimboAI 等）              |                                            |

---

## 2. 项目结构差异

### UE5 / Unity 你习惯的：
- 一个项目一个 .uproject / Assets/，工程文件巨大、首次打开 5~10 分钟。
- 资源 import 后变成 .uasset / .meta + 二进制。
- Source/ 里写 C++ / C#。

### Godot 你要适应的：
- **整个项目就是一个文件夹**，根目录有一个 project.godot（纯文本）。
- **资源就是文件本身**：.png 直接用、.ogg 直接用，旁边自动生成 .import 元数据。
- **场景是文本格式 (.tscn)**，可以用 git diff 直接看，**冲突可手动合并**（这是 UE 做不到的）。
- 没有"编译"概念。GDScript 脚本是热加载的，改完保存秒生效。
- 第三方插件统一放 ddons/<plugin_name>/。

---

## 3. 你最容易踩的 5 个坑

### 坑 1：把 UE 的"Actor + Component"思维硬搬过来

UE 习惯：在 Actor 上挂一堆 Component。
Godot 的对应做法：**用子节点替代 Component**。
比如一个角色：

`
Player (CharacterBody2D)
├── Sprite2D            # 美术
├── CollisionShape2D    # 碰撞（必须是子节点，不是属性）
├── AnimationPlayer     # 动画
├── HealthComponent     # 自定义"组件"——其实就是一个 Node + 脚本
└── HitBox (Area2D)
`

每个子节点都能挂自己的脚本，父节点用 $Sprite2D 或 @onready var sprite =  拿到引用。

### 坑 2：以为 Autoload 越多越好

UE 的 GameInstance / GameState / GameMode 一堆全局对象，让人产生"全局单例越多越方便"的错觉。
Godot 项目你设置一次就受用一辈子，**Autoload 控制在 5~8 个以内**。本项目我已经定好 5 个：
EventBus / GameState / SaveSystem / AchievementManager / AudioManager。**新增前先想：能不能用普通 Node 解决？**

### 坑 3：UI 双轨混用

你之前 Unity 做修真项目踩过 UGUI + UIToolkit 混用的坑。Godot 没有这个问题——**UI 就是 Control 节点**，没有第二套。
但是新坑：Godot 里 Control（UI）和 Node2D（游戏世界）坐标系不同，**UI 一定放在 CanvasLayer 下**才能不被相机变换影响。本项目 Main.tscn 里的 ToastLayer 就是这个用法。

### 坑 4：信号连接没断开导致内存泄漏

UE 的 Delegate / Unity 的 event 你都习惯了。Godot 的 signal 在节点 queue_free() 时会**自动断开**自己持有的信号连接，但**别人 connect 到你的信号**时你死了，对方那一头还活着——所以从临时节点向 Autoload 单例 connect 时，记得 connect(... CONNECT_ONE_SHOT) 或在 _exit_tree() 里手动 disconnect。

### 坑 5：用 get_node("...") 而非 $

`gdscript
# 啰嗦版（少用）
var btn = get_node("HBox/VBox/BtnSave")
# 简洁版（推荐）
@onready var btn: Button = /VBox/BtnSave
# 唯一名字（推荐用于深层节点，编辑器里勾"Access as Unique Name"）
@onready var btn: Button = %BtnSave
`

@onready 表示"节点树构建完成后再赋值"，相当于 UE 的 BeginPlay 阶段才能用。

---

## 4. GDScript 速查（写给 C++/C# 开发者）

`gdscript
# 类型注解可选但推荐
var hp: int = 100
var name := "Disha"           # := 自动推导类型
const MAX_HP := 999            # 常量

# 函数
func take_damage(amount: int) -> void:
	hp -= amount
	if hp <= 0:
		die()

# Lambda（叫"Lambda Callable"）
button.pressed.connect(func (): print("点了"))

# 异步：await 关键字（类似 C# async）
await get_tree().create_timer(1.0).timeout
print("一秒后")

# 信号声明 + 触发 + 连接
signal damaged(amount: int)
damaged.emit(10)
damaged.connect(_on_damaged)

# 类成员可见性：以 _ 开头视为"私有约定"，没有强制 private
var _internal_state: int

# @export 暴露到检查器（相当于 UE 的 UPROPERTY(EditAnywhere)）
@export var speed: float = 200.0
@export_range(0, 100) var volume: int = 80
@export_file("*.json") var data_path: String

# 类型转换 / 判断
if node is Player:
	var p := node as Player
	p.do_something()
`

---

## 5. 调试技巧

| 你想做的事         | UE 的做法                       | Godot 的做法                                |
|--------------------|---------------------------------|---------------------------------------------|
| 打日志             | UE_LOG                        | print() / print_rich("[color=red]...") |
| 打警告             | UE_LOG(Warning)               | push_warning("...")                       |
| 打错误             | UE_LOG(Error)                 | push_error("...")                         |
| 断点               | VS 里 F9                        | 编辑器脚本视图里左键点行号                  |
| 看节点树运行时     | World Outliner                  | 运行时按下方 "Remote" 标签查看              |
| Profile            | Insights                        | 编辑器底部 "Profiler" / "Monitor" 标签      |
| 单步调试           | 同上                            | 同上，断点后 F10/F11                        |

---

## 6. 与本项目相关的快速参考

`gdscript
# 切换场景
EventBus.request_scene_change.emit("res://scenes/title/TitleScreen.tscn")

# 弹一条 Toast
EventBus.request_toast.emit("已保存", 1.5)

# 解锁成就（自动弹通知，不需要再手动 toast）
AchievementManager.unlock("first_dialogue")

# 设置/读取剧情标志位
GameState.set_flag("met_old_taoist", true)
if GameState.get_flag("met_old_taoist"):
	pass

# 解锁时间轴节点
GameState.unlock_story_node("ch1_meet")

# 存档/读档
SaveSystem.save_to_slot(0, "自动存档")
SaveSystem.load_from_slot(0)

# 播放 BGM（带淡入）
AudioManager.play_bgm("res://resources/audio/bgm/title.ogg", 1.0)
`

---

## 7. 接下来推荐的学习顺序

1. 用编辑器打开本项目，按 F5 跑一遍流程：标题 → 对话 → 时间轴 → 成就。
2. 在编辑器里**点开每个 .tscn 看节点树**，对照本对照表的"概念映射"理解。
3. 改一句对话文本（scripts/ui/DialogueScene.gd 里的 _demo_lines），再跑一遍——感受热加载。
4. 安装 Dialogic 2.0：编辑器顶栏 AssetLib → 搜索 → 安装 → 启用。
5. 把示例对话替换成 Dialogic 时间线（README 里有片段）。
6. 给 esources/cgs/ 丢一张 1920×1080 的 PNG，在 DialogueScene 里设给 \.texture 看看效果。

---

## 8. 一句话总结心智迁移

> **UE 是"类继承 + 组件挂载"，Godot 是"节点组合 + 信号通信"。**
> 想清楚每个新功能是"加一个子节点"还是"加一个 Autoload"——99% 的情况是前者。
