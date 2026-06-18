# AI Aggregator Mac App — 设计文档

## 概述

一个 Mac 桌面应用，用户可以同时打开多个 AI 聊天服务（DeepSeek、Kimi、Qwen 等），输入一个问题后同时触发所有 AI 进行回答，并以统一的卡片视图对比展示结果。

## 技术栈

- **Electron** — 主进程 + BrowserView（每个 AI 一个隐藏 webview）
- **React** — 渲染进程 UI
- **Zustand** — 轻量状态管理
- **Vite** — 构建工具
- **electron-builder** — 打包发布

## 架构方案：适配器模式

每个 AI 服务对应一个 adapter 模块，封装其 DOM 选择器和交互逻辑。通过 Electron 的 `webContents.executeJavaScript()` 向各 AI 网页注入 JS，实现自动填写问题、点击发送、监听流式回答。

### 项目结构

```
bot-aggregation/
├── package.json
├── electron-builder.yml
├── vite.config.js
├── src/
│   ├── main/                   # Electron 主进程
│   │   ├── index.js            # 入口，创建窗口
│   │   ├── windowManager.js    # 主窗口管理
│   │   └── webviewManager.js   # 隐藏 BrowserView 管理
│   ├── renderer/               # 渲染进程（React）
│   │   ├── index.html
│   │   ├── index.jsx
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── InputBar.jsx    # 统一输入框
│   │   │   ├── ResponseCard.jsx # AI 回答卡片
│   │   │   ├── AiSidebar.jsx   # 左侧 AI 列表
│   │   │   └── WebViewPanel.jsx # 原始网页查看面板
│   │   └── store.js            # Zustand 状态管理
│   ├── adapters/               # AI 适配器
│   │   ├── base.js             # 基类
│   │   ├── qwen.js
│   │   ├── deepseek.js
│   │   └── kimi.js
│   └── preload/
│       └── index.js            # contextBridge 暴露 IPC 接口
```

### 适配器系统

**BaseAdapter 基类：**

```javascript
class BaseAdapter {
  constructor(name, url) {
    this.name = name;
    this.url = url;
  }

  get selectors() {
    return { input: '', sendBtn: '', response: '' };
  }

  async waitForReady(webContents) {
    // 轮询检测 selectors.input 是否存在，超时 30s
  }

  async sendQuery(webContents, query) {
    // 注入 JS：找到输入框 → 填入文本 → 触发 input 事件 → 点击发送
  }

  async listenForResponse(webContents, onChunk) {
    // 注入 MutationObserver 监听 response 区域
    // DOM 变化时回调 onChunk(latestText)
    // 回答结束时 resolve（检测「停止生成」按钮消失或超时 3s 无变化）
  }
}
```

每个 AI 服务继承 BaseAdapter，覆盖 selectors 和特殊交互逻辑。

**首批支持：** Qwen、DeepSeek、Kimi。

### Webview 管理

**WebviewManager（主进程）：**

- 应用启动时为每个 AI 创建隐藏的 BrowserView，加载对应网页
- `broadcast(query)` — 并行向所有 webview 发送问题
- 通过 IPC (`ai-event`) 将状态和回答片段实时推送给渲染进程
- BrowserView 始终存在（保持登录状态），通过隐藏/显示切换
- 某个 AI 失败不影响其他 AI

**生命周期：**
1. 启动 → 创建 BrowserView → 加载 AI 网页 → 等待就绪
2. 用户提问 → 广播 → 流式回传回答 → 渲染进程实时更新
3. 点击「查看原网页」→ 显示对应 BrowserView
4. 点击「返回」→ 隐藏 BrowserView，回到主界面

### UI 界面

左侧输入 + 右侧并排卡片布局：

- **左侧边栏**：AI 服务列表 + 状态指示灯（绿=就绪，黄=加载中，红=错误）
- **顶部输入栏**：统一输入框 + 发送按钮，Enter 发送
- **右侧卡片区域**：每个 AI 一个卡片，并排显示，流式更新，可独立滚动
- **卡片操作**：「查看原网页」切换到完整网页、「复制」复制回答文本

### IPC 通信

```
渲染进程 → 主进程：
  - 'send-query' (query) → 广播到所有 AI
  - 'show-original' (name) → 显示某个 AI 的原网页
  - 'hide-original' () → 回到主界面

主进程 → 渲染进程：
  - 'ai-event' { name, type, data }
    type: 'status' | 'chunk' | 'error'
    status values: 'loading' | 'ready' | 'sending' | 'done' | 'error'
```

### 状态管理（Zustand）

```javascript
{
  aiServices: [
    { name: 'Qwen', status: 'ready', response: '', error: null },
    { name: 'DeepSeek', status: 'sending', response: '部分回答...', error: null },
    { name: 'Kimi', status: 'loading', response: '', error: null },
  ],
  currentView: 'unified', // 'unified' | 'original'
  activeOriginal: null,    // 当查看原网页时的 AI name
}
```

## 错误处理

- 某个 AI 网页加载超时 → 状态显示红色，允许重试
- 某个 AI 回答失败 → 卡片显示错误信息，不影响其他 AI
- 所有 AI 都失败 → 显示全局错误提示
- 输入框为空时发送按钮禁用

## 后续扩展

- 支持更多 AI 服务（只需新增 adapter 文件）
- 对话历史记录
- 回答导出（Markdown/JSON）
- 自定义布局（切换为标签页模式等）
