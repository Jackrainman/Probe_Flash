---
date: 2026-05-15 01:40
symptom: 串口只能进一次回调，vTaskDelay只工作一次，init静默失败输出脏数据
project: STM32 HAL + FreeRTOS
relatedCommits: []
relatedFiles: []
status: resolved
---

# 检查清单：STM32 HAL + FreeRTOS 经典初始化陷阱

**症状**：
1. 非模板串口DMA接收只能正确进一次IDLE回调，之后不再触发
2. `vTaskDelay` 只能工作一次，第二次无法进入
3. 初始化函数静默失败，输出莫名其妙的数据（指针访问未分配内存）

**仓库上下文**：STM32G4 / HAL库 / FreeRTOS / UART DMA
**生成时间**：2026-05-15 01:40

## 实际根因与修复

### 问题1：UART IDLE回调只触发一次 [优先级：高]

**根因**：缺少 IDLE 标志的主动查询和清除逻辑。HAL库的HAL_UART_IRQHandler()不会自动处理IDLE中断，需要用户在自定义中断服务中主动检查。

**修复代码**：
```c
// 在 USARTx_IRQHandler 中添加
if (__HAL_UART_GET_FLAG(&huart5, UART_FLAG_IDLE) &&
    (huart5.ReceptionType != HAL_UART_RECEPTION_TOIDLE)) {
    __HAL_UART_CLEAR_IDLEFLAG(&huart5);
    uart_dmarx_idle_callback(&huart5);
}
```

**验证动作**：
- 连续发送多包数据，观察是否每次都能触发IDLE回调
- 在 `uart_dmarx_idle_callback` 中加断点，确认多次进入

---

### 问题2：vTaskDelay只能工作一次 [优先级：高]

**根因**：SysTick_Handler 缺少 FreeRTOS 的任务调度钩子。HAL库默认的SysTick_Handler只调用HAL_IncTick()，没有调用 `xPortSysTickHandler()`，导致FreeRTOS的tick计数不增加，任务调度停滞。

**修复代码**：
```c
void SysTick_Handler(void)
{
    HAL_IncTick();
    
    // 添加 FreeRTOS 支持
    extern void xPortSysTickHandler(void);
    if (xTaskGetSchedulerState() != taskSCHEDULER_NOT_STARTED) {
        xPortSysTickHandler();
    }
}
```

**验证动作**：
- 创建两个LED闪烁任务，不同频率
- 观察是否两个LED都能持续闪烁（而非闪一次就停止）

---

### 问题3：init静默失败，输出脏数据 [优先级：高]

**根因**：初始堆/栈空间配置不足。FreeRTOS的 `configTOTAL_HEAP_SIZE` 太小或启动文件的堆栈设置不够，导致任务创建或malloc时返回NULL。但代码未检查返回值，指针继续被使用，访问到未分配的内存区域（通常是已有数据的内存），不产生HardFault但输出脏数据。

**修复方案**：
```c
// FreeRTOSConfig.h
#define configTOTAL_HEAP_SIZE                    ((size_t)32768)  // 从8192增加到32768

// 任务创建必须检查返回值
BaseType_t ret = xTaskCreate(taskFunc, "Task", 256, NULL, 1, &taskHandle);
if (ret != pdPASS) {
    // 处理失败，打印日志或LED指示
    Error_Handler();
}
```

**验证动作**：
- 在启动文件（startup_xxx.s）中确认Stack_Size
- 使用 `xPortGetFreeHeapSize()` 打印剩余堆空间
- 任务创建后断言 `taskHandle != NULL`

---

## 总结：STM32 HAL + FreeRTOS 三件套检查

新工程或移植时，务必确认这三项：

1. **UART DMA + IDLE**：自定义IRQHandler中主动查询IDLE标志并清除
2. **SysTick**：添加 `xPortSysTickHandler()` 调用，加scheduler状态判断
3. **内存配置**：Heap ≥ 32KB，任务创建检查返回值，使用断言

这三个问题都是"静默型"——不产生HardFault但行为异常，排查难度大，建议作为新项目checklist固定项。
