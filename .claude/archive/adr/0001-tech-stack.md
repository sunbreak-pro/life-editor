# ADR-0001: Technology Stack Selection

## Status

Superseded (2026-04-13) — 元は Java + Spring Boot 構成。現在の技術スタックは CLAUDE.md を参照。

## Date

2025-02-06

## Context

初期設計では Java 23 + Spring Boot 3.4.2 + H2 Database をバックエンドとし、React フロントエンドと REST API で通信する構成だった。

## Decision (Original)

- Backend: Java 23 + Spring Boot 3.4.2 + H2 Database
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4

## Superseded By

Electron デスクトップアプリへの移行に伴い、バックエンド構成が根本的に変更された:

- **Java + Spring Boot → Electron Main Process** (Node.js)
- **H2 Database → SQLite** (better-sqlite3, WAL モード)
- **REST API → IPC** (contextBridge + ipcMain/ipcRenderer)
- **CORS 不要**、ランタイムは Electron 1つに統合

### 継続している選定

- React 19 + TypeScript + Vite（フロントエンド）
- Tailwind CSS v4
- TipTap（リッチテキスト）
- @dnd-kit（ドラッグ&ドロップ）
- React Context API（状態管理）

## References

現在の技術スタック詳細は `CLAUDE.md` のアーキテクチャセクションを参照。
