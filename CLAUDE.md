# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Aggregator — an Electron desktop app that embeds multiple AI chatbot webviews (DeepSeek, Kimi, Qwen), injects JS to send queries simultaneously, and displays streaming responses in a unified card layout.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev mode (Vite + Electron concurrently)
npm run build:renderer  # Build renderer only (Vite)
npm run build        # Build renderer + package Electron app
```

## Architecture

**Electron main process** (`src/main/`) creates the app window and manages hidden BrowserViews — one per AI service. Each BrowserView loads the AI's actual web page. The `WebviewManager` handles lifecycle, IPC, and broadcasting queries.

**Adapters** (`src/adapters/`) are the core abstraction. Each AI service has an adapter that extends `BaseAdapter` and provides:
- CSS selectors for the AI's input field, send button, response area, and stop button
- `sendQuery()` — injects JS to fill the input and click send
- `listenForResponse()` — injects a MutationObserver to watch for streaming responses

To add a new AI service: use the `/add-bot` command (see `.claude/skills/add-bot.md`) or manually create a new file in `src/adapters/` extending `BaseAdapter`, then register it in `WebviewManager.adapters`.

**Renderer** (`src/renderer/`) is a React app with Zustand state management. Layout: left sidebar (AI list + status dots) → top input bar → right response cards (one per AI, streaming text).

**IPC flow:**
- Renderer → Main: `send-query`, `show-original`, `hide-original`, `retry-ai` (via preload bridge)
- Main → Renderer: `ai-event` with `{ name, type: 'status'|'chunk'|'error', data }`

**Preload** (`src/preload/`) exposes `window.api` via contextBridge with `sendQuery()`, `onAiEvent()`, `showOriginal()`, `hideOriginal()`, `retryAi()`.

## Key Design Decisions

- BrowserViews stay alive (hidden) to preserve login state; toggled visible/hidden for "view original" feature
- Each adapter's JS injection uses `webContents.executeJavaScript()` — adapters must handle React synthetic events (native value setter) and contenteditable inputs
- Response detection uses MutationObserver + polling fallback; considers stream done when text stabilizes for 3s and stop button disappears
- Dark theme (Catppuccin Mocha palette): bg `#181825`, surface `#1e1e2e`, text `#cdd6f4`
