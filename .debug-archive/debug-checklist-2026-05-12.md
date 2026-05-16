# 检查清单：main_ctrl 查表重构 + 夹爪自动化优化

**改动范围**：`main_ctrl.c`, `includes.h`, `catch_rod.c`, `chassis.c`, `msg_process.c`
**仓库上下文**：STM32G474 机器人固件 / dev 分支（5 commits ahead of main）
**生成时间**：2026-05-12 13:45

## 检查项

1. **按键注册查表法正确性** [优先级：高]
   - **依据**：`6218dd5` 将 `main_ctrl.c` 从多个单独回调改为统一 `key_action_table[]` 查表
   - **验证动作**：上电后遥控各功能键测试：底盘自锁、A*导航、抬升上下、夹爪取点、红外发送。确认每个按键触发对应功能，无错位或遗漏

2. **消息分发映射完整性** [优先级：高]
   - **依据**：`includes.h` 新增 `msg_handler_map_t` 结构体，消息处理改为查表 dispatch
   - **验证动作**：检查 `main_ctrl_msg_process_task` 中 `MAIN_MSG_*` 枚举与处理函数的映射是否完整，确认 `MAIN_MSG_CMD_NUM` 前所有消息都有对应 handler

3. **夹爪自动取点死区与等待时间** [优先级：高]
   - **依据**：`c20bc05` 修改 `CATCH_AUTO_EPS` 0.050→0.030，新增 `CATCH_AUTO_SEQ_WAIT_MS` 800ms
   - **验证动作**：测试 GRAB_WEAPON → PLACE 自动序列，观察到位判定是否过敏感/迟钝，检查阶段间 800ms 等待是否导致卡顿

4. **yaw_source 遥报到 NUC 正确性** [优先级：中]
   - **依据**：`d96fa34` 新增 `yaw_source` 上报字段，`r1_data_t` 结构变更
   - **验证动作**：在 NUC 上位机检查接收到的 `r1_data_t` 数据包，确认 yaw_source 值与底盘实际使用的角度源一致（陀螺仪/视觉）

5. **底盘 speed/accel 模式切换** [优先级：中]
   - **依据**：`50dbc67` 警告默认速度加速度大幅提升，`chassis.c` 新增加速度/速度模式切换
   - **验证动作**：测试 `CHASSIS_SPEED_MODE_TOGGLE` 和 `CHASSIS_ACCEL_UP` 按键，观察底盘运动是否平滑，急停时是否异常抖动

6. **夹爪位姿表更新兼容性** [优先级：中]
   - **依据**：`c20bc05` 合并 `CATCH_POSE_PLACE_WEAPON_1/2` 为 `CATCH_POSE_PLACE_WEAPON`，坐标更新
   - **验证动作**：测试 PLACE 动作，确认新坐标 1.779f, -0.694f, 0.0f 不会导致机械干涉或超出关节限位

7. **report bug fix 后的遥测完整性** [优先级：中]
   - **依据**：`7c59481` 修复 chassis.c 上报 bug（仅 3 行改动）
   - **验证动作**：检查 NUC 接收的遥测数据完整性，确认底盘状态、yaw_source 等字段无异常值或丢失

8. **查表回调的队列溢出防护** [优先级：低]
   - **依据**：`main_ctrl_remote_callback` 使用 `xQueueOverwrite`（队列容量 1），查表失败时静默
   - **验证动作**：快速连按同一按键，确认无消息堆积或 HardFault，未注册按键无响应（预期行为）

## 看完仍未定位时

- **建议回滚验证**：`git diff 6218dd5~1 6218dd5 -- Code/User/Application/Src/main_ctrl.c > /tmp/main_ctrl.patch && git checkout 6218dd5~1 -- Code/User/Application/Src/main_ctrl.c` 对比原实现
- **建议对比的 baseline commit**：`7c59481`（main_ctrl 优化前最后一个稳定版本）

## 相关 Commit

- `6218dd5` 优化 main_ctrl.c 可读性与按键注册方式
- `7c59481` report bug fix
- `d96fa34` 增加yaw_source上报
- `c20bc05` 自动化夹爪优化
- `eca71e6` catch servo deg fix
- `ec34425` key change，servo change to deg_ctrl
- `50dbc67` WARNING: default speed and acceleration become much more faster
