extends Node
## EventBus —— 全局事件总线（Autoload 单例）
##
## 设计原则：
## - 跨模块解耦：A 模块不直接引用 B，而是通过事件通信
## - 信号集中声明在这里，避免散落各处难以追踪
## - 谁发出（emit）谁负责，谁监听（connect）谁处理
##
## 命名规范（UE 风格）：
## - 信号名：PascalCase（大驼峰），如 RequestSceneChange
## - 参数名：PascalCase（大驼峰），如 ScenePath
##
## 用法：
##   EventBus.DialogueFinished.emit("intro_01")
##   EventBus.DialogueFinished.connect(OnDialogueFinished)
##
## 注意：本类自身不消费任何信号（它只是中转站），
## 因此对本文件全局忽略 "unused_signal" 警告。
@warning_ignore_start("unused_signal")


# ============== 对话相关 ==============
## 对话开始播放
signal DialogueStarted(DialogueId: String)
## 对话结束（含正常完成与中途跳过）
signal DialogueFinished(DialogueId: String)
## 玩家做出选项
signal DialogueChoiceMade(DialogueId: String, ChoiceIndex: int)


# ============== CG 相关 ==============
## CG 显示
signal CGShown(CGId: String)
## CG 隐藏
signal CGHidden(CGId: String)


# ============== 故事进度相关 ==============
## 故事节点解锁（用于时间轴）
signal StoryNodeUnlocked(NodeId: String)
## 标志位变更（用于条件分支）
signal FlagChanged(FlagName: String, Value: Variant)


# ============== 成就相关 ==============
## 成就解锁
signal AchievementUnlocked(AchievementId: String)


# ============== 存档相关 ==============
## 存档完成
signal SaveCompleted(Slot: int)
## 读档完成
signal LoadCompleted(Slot: int)


# ============== UI / 场景切换 ==============
## 请求切换场景（由 Main 监听并执行）
signal RequestSceneChange(ScenePath: String)
## 请求显示通知 toast
signal RequestToast(Text: String, Duration: float)
