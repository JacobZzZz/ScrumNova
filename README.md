# ScrumNova

面向个人开发者的轻量敏捷看板与桌面私人助理（Local-First，优先支持 macOS，兼容 Windows）。

## 核心能力（v0.1）

- **多空间隔离**：工作项目 / 个人项目独立管理，互不串台。
- **需求池（Backlog）+ 4 列拖拽看板**：`待办 (Todo)`、`进行中 (Doing)`、`等待/阻塞 (Blocked)`、`已完成 (Done)` 自由拖拽，支持看板空白区域划屏平移与惯性滚动。
- **自定义需求来源 & `P0`~`P5` 优先级**：自由新增、改色、管理需求来源，支持插单标记、截止日期提醒与每周建议负载上限预警。
- **防打断与防扯皮详情页**：
  - 置顶「当前进度 / 下一步」现场便签（直接透出在卡片正面）
  - 子任务拆解清单与完成度进度条
  - 直接按 `Cmd/Ctrl + V` 粘贴剪贴板截图、按需提取图片文字（本地离线 OCR）、关联外部文档链接（蓝湖/飞书等）
  - 带时间戳的需求变更小记
- **系统级私人助理**：
  - 全局快捷键秒记悬浮窗（默认 `Cmd/Ctrl + Shift + N`，支持自定义录制）
  - 顶部菜单栏/托盘常驻快捷菜单
  - 一键归档已完成卡片 + `Cmd/Ctrl + K` 跨全字段（含归档卡片与截图 OCR 文字）极速搜索

## 常用命令

```bash
# 启动开发实时预览窗口（支持热更新）
npm run dev

# 类型检查
npm run typecheck

# 打包 macOS 正式版 (.app 与 .dmg，输出至 dist/ 目录)
npm run dist:mac

# 打包 Windows 安装包 (输出至 dist/ 目录)
npm run dist:win
```

## 本地数据目录

- macOS：`~/Library/Application Support/ScrumNova/`
  - `scrumnova.db`：SQLite 本地数据库
  - `attachments/`：卡片粘贴/上传的原图文件
- 备份或迁移电脑时，直接完整拷贝该文件夹即可。
