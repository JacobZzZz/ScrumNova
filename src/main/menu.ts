import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import type { NavigateCommandPayload } from '@shared/types'

interface AppMenuCallbacks {
  onOpenQuickCapture: () => void
  onNavigateMainWindow: (payload: NavigateCommandPayload) => void
}

export function setupApplicationMenu(cb: AppMenuCallbacks): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = []

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 ScrumNova' },
        { type: 'separator' },
        {
          label: '偏好与快捷键设置…',
          accelerator: 'Command+,',
          click: () => cb.onNavigateMainWindow({ type: 'open-settings' })
        },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 ScrumNova' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { role: 'quit', label: '退出 ScrumNova' }
      ]
    })
  }

  template.push({
    label: '任务',
    submenu: [
      {
        label: '新建任务卡片',
        accelerator: 'CommandOrControl+N',
        click: () => cb.onNavigateMainWindow({ type: 'open-new-card' })
      },
      {
        label: '快速秒记悬浮窗',
        click: () => cb.onOpenQuickCapture()
      },
      { type: 'separator' },
      {
        label: '全局搜索',
        accelerator: 'CommandOrControl+K',
        click: () => cb.onNavigateMainWindow({ type: 'open-search' })
      },
      {
        label: '显示/收起需求池',
        accelerator: 'CommandOrControl+B',
        click: () => cb.onNavigateMainWindow({ type: 'toggle-backlog' })
      },
      {
        label: '打开归档箱',
        accelerator: 'CommandOrControl+Shift+A',
        click: () => cb.onNavigateMainWindow({ type: 'open-archive' })
      },
      ...(!isMac
        ? [
            { type: 'separator' as const },
            {
              label: '设置',
              accelerator: 'Control+,',
              click: () => cb.onNavigateMainWindow({ type: 'open-settings' })
            },
            { type: 'separator' as const },
            { role: 'quit' as const, label: '退出 ScrumNova' }
          ]
        : [])
    ]
  })

  // 必须保留标准编辑角色，确保打包后 macOS 下 Cmd+C / Cmd+V / Cmd+Z / Cmd+A 在输入框内正常工作
  template.push({
    label: '编辑',
    submenu: [
      { role: 'undo', label: '撤销' },
      { role: 'redo', label: '重做' },
      { type: 'separator' },
      { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
      { role: 'selectAll', label: '全选' }
    ]
  })

  const windowSubmenu: MenuItemConstructorOptions[] = [
    { role: 'minimize', label: '最小化' },
    { role: 'zoom', label: '缩放' },
    ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const, label: '前置全部窗口' }] : [{ role: 'close' as const, label: '关闭窗口' }])
  ]

  if (!app.isPackaged) {
    windowSubmenu.push(
      { type: 'separator' },
      { role: 'reload', label: '重新加载开发页面' },
      { role: 'toggleDevTools', label: '开发者工具' }
    )
  }

  template.push({
    label: '窗口',
    submenu: windowSubmenu
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
