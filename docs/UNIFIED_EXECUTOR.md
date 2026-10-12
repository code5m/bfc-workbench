# 统一执行器 v1：先建设，后接入账号

## 当前范围

本项目的 **UnifiedExecutor** 已实现为 Node.js 模块 `lib/unified-executor.mjs`。其输入是既有的 `deriveWorkflow()` 本地分类结果；不会调用 B站，不会读取登录凭据，也不会执行收藏夹增删改。

- 唯一 BV 号生成任务，默认收藏夹视频标记 `P0_default` 并优先执行。
- 任务持久化于 `~/Documents/Bilibili-Favorites-Review/unified-executor-job.json`。
- 任务持久状态：`prepared_offline` → `offline_running` → `offline_complete_account_blocked` 或 `offline_complete_adapter_unavailable`；另支持 `paused` 和 `cancelled`。
- 每批最多 40 条本地任务，由执行器单独保存断点，退出后读取原状态。
- 使用 `wx` 互斥锁防止多个进程同时执行同一任务；异常遗留锁不会自动抢占。
- 快照变化会产生新任务 ID，并在本地归档上一个任务。相同快照重复准备不生成重复任务。
- 每批完成后追加本地审计日志 `unified-executor-audit.jsonl`。本地 JSON 和日志均不入 GitHub。
- 不再误把“已在旧快照目标夹”认作“实时同步成功”。**`remoteRequests=0`，`accountWrites=0`，`verifiedAccountSync=0`**。
- 任务中的 `needs_manual_review`、`invalid_requires_disposition`、`locally_assessed` 仅为离线结果，不代表账号已整理。

## 页面按钮及 API

工作台新增：生成统一任务、开始本地执行、暂停、恢复、取消、查看进度。账号操作仍被访问门禁保护。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/executor` | 本地执行状态 |
| POST | `/api/executor/action` | `prepare/start/pause/resume/cancel` |

POST 必须使用工作台已有的同源与 CSRF 令牌规则，不能从第三方网页调用。

## 尚未完成

这一版有意识地**不实现**联网适配器。只有在平台允许的接口、账号权限、统一请求额度和回读规范确认后，才能新增严格隔离的执行器端口：读取目录、读取目标成员、复制条目、验证目标、受控移出源目录。收到 412 等拒绝状态立即执行账号级熔断。不能将旧脚本直接插入统一执行器，也不能因执行器离线任务结束就宣布 ALL_DONE。

## 部署说明

GitHub 源码提交后，需在原电脑 `/home/ainfinit/Documents/bilibili-favorites-workbench` 拉取 `main` 并重启 Node 工作台才能看到按钮。远程设备离线时，GitHub 代码已保存，**本地部署尚未验证**。

本地数据一旦恢复可用，`npm test` 和 `/api/executor` 应首先验收，再开始离线批量任务。
