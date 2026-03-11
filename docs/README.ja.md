# SubScribe

[![Build](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml/badge.svg)](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/umitaltintas/subscribe)](https://github.com/umitaltintas/subscribe/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

ファジー検索、AI翻訳・要約、リアルタイム字幕オーバーレイを備えた強力なYouTubeトランスクリプト管理ユーザースクリプト。

**[English](../README.md)** | **[Turkce](README.tr.md)** | **[Deutsch](README.de.md)** | **[Espanol](README.es.md)**

## 機能

- **ワンクリックトランスクリプト抽出** — YouTubeビデオのトランスクリプトをタイムスタンプ付き・なしで取得
- **ファジー検索** — [Fuse.js](https://www.fusejs.io/)によるタイトル、チャンネル、タグ、トランスクリプト内容のタイポ許容検索
- **AI翻訳** — [OpenRouter](https://openrouter.ai/)経由で10以上の言語に翻訳（Gemini、Claude、GPTなど全モデル対応）
- **AI要約** — ワンクリックでビデオの要約を生成：主要トピック、重要ポイント、結論
- **字幕オーバーレイ** — 翻訳された字幕をYouTubeビデオプレーヤー上にリアルタイム表示
- **トランスクリプトライブラリ** — 全トランスクリプトをIndexedDBにローカル保存：お気に入り、タグ、統計情報
- **ダッシュボード** — 履歴、お気に入り、翻訳、統計、データのエクスポート/インポート
- **コスト追跡** — OpenRouter APIによる翻訳ごとのトークン使用量とコスト表示

## インストール

### リリースから（推奨）

1. [Tampermonkey](https://www.tampermonkey.net/)をインストール（Chrome、Firefox、Edge、Safari）
2. [最新リリース](https://github.com/umitaltintas/subscribe/releases/latest)から`subscribe.user.js`をダウンロード
3. Tampermonkeyのダッシュボードを開いてファイルをドラッグ、または新しいスクリプトを作成して内容を貼り付け

### ソースから

```bash
bun install
bun run build
```

ビルドされたユーザースクリプトは`dist/userscript.js`に出力されます。

### 開発

```bash
bun run watch      # ファイル変更時に自動リビルド
bun run typecheck  # TypeScript型チェック
```

## 使い方

インストール後、YouTube上に新しいボタンが表示されます：

### ナビゲーションバー
- **トランスクリプトマネージャー**（ドキュメントアイコン）— トランスクリプトライブラリのダッシュボードを開く
- **設定**（歯車アイコン）— AI翻訳設定を構成

### ビデオページ
- **トランスクリプト**ボタン — 現在のビデオのトランスクリプトを抽出して保存
- **翻訳**ボタン — トランスクリプトを翻訳してビデオ上に字幕を表示
- **要約**ボタン — ビデオ内容のAI要約を生成

### ダッシュボードタブ

| タブ | 説明 |
|------|------|
| 履歴 | ファジー検索とフィルター付きの全保存トランスクリプト |
| お気に入り | ブックマークしたトランスクリプト |
| 翻訳 | 翻訳済みトランスクリプトの表示と管理 |
| 統計 | ビデオ総数、トークン、単語数、チャンネル数など |
| 設定 | データのエクスポート/インポート、検索インデックスの再構築 |

### AI翻訳の設定

1. [OpenRouter](https://openrouter.ai/)からAPIキーを取得
2. YouTubeナビゲーションバーの設定（歯車）ボタンをクリック
3. APIキーを入力し、モデルとターゲット言語を選択
4. 任意のビデオで「翻訳」をクリック — プレーヤー上に字幕が表示されます

## 技術スタック

- **TypeScript** — 完全に型付けされたコードベース
- **esbuild** — 単一IIFEユーザースクリプトへの高速バンドル
- **Fuse.js** — クライアントサイドファジー検索エンジン
- **IndexedDB** — ローカルストレージ（サーバーなし、アカウント不要）
- **OpenRouter API** — コスト追跡付きマルチモデルAI翻訳
- **Trusted Types** — CSP対応DOM操作

## コントリビュート

コントリビュートを歓迎します！Issueの作成やPull Requestの送信をお気軽にどうぞ。

## ライセンス

[MIT](../LICENSE)
