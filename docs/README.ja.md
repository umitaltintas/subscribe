# SubScribe

[![Build](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml/badge.svg)](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/umitaltintas/subscribe)](https://github.com/umitaltintas/subscribe/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

ファジー検索、AI翻訳・要約、リアルタイム字幕オーバーレイを備えた強力なYouTubeトランスクリプト管理ユーザースクリプト。

**[English](../README.md)** | **[Turkce](README.tr.md)** | **[Deutsch](README.de.md)** | **[Espanol](README.es.md)**

## 機能

- **ワンクリックトランスクリプト抽出** — YouTubeビデオのトランスクリプトをタイムスタンプ付き・なしで取得
- **ファジー検索** — [Fuse.js](https://www.fusejs.io/)によるタイトル、チャンネル、タグ、トランスクリプト内容のタイポ許容検索
- **AI翻訳** — [OpenRouter](https://openrouter.ai/)経由で18言語に翻訳（Gemini、Claude、GPTなど任意のモデルに対応）。文は途中で切れず、字幕の同期も保たれます：モデルが字幕の断片を文単位にまとめ、各まとまりのタイミングはモデルではなく常に元の字幕から取得します
- **高い信頼性** — 原文と照合して検証される構造化（JSON）出力、フィードバック付きの自動リトライ、レート制限時のバックオフ、いつでもキャンセル可能、失敗後も二重に課金されずに再開
- **用語の一貫性** — 最初のパスで動画の簡潔なコンテキストと用語集を作成し、すべてのチャンクがそれに従います
- **AI要約** — 形式、トーン、長さ、出力言語を選択可能。重要な場面にはクリックできるタイムスタンプ付き
- **字幕オーバーレイ** — プレーヤー上にフレーム単位で正確な字幕を表示。二言語モード（翻訳＋原文）、サイズ・色・背景の調整に対応し、プレーヤーのコントロールと重ならないよう自動で位置を調整
- **字幕エクスポート** — 翻訳を`.srt`または`.vtt`でダウンロード
- **トランスクリプトライブラリ** — すべてをIndexedDBにローカル保存：お気に入り、タグ、ファジー検索、統計情報
- **ビューアー** — 原文／翻訳／要約タブ。タイムスタンプをクリックするとその位置へジャンプし、再生中の行がハイライトで追従
- **コスト追跡** — 翻訳ごとの正確なコストをOpenRouterがその場で報告
- **プライバシー** — APIキーはユーザースクリプトのストレージに保存され（youtube.comからは読み取れません）、リクエストはOpenRouterへ直接送信
- **ライト＆ダークテーマ**、キーボード操作に対応したダイアログとメニュー

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
bun test           # ユニットテスト（パース、チャンク分割、検証、翻訳フロー）
```

## 使い方

インストール後、YouTube上に新しいボタンが表示されます：

### ナビゲーションバー
- **ライブラリ**（SubScribeロゴ）— トランスクリプトライブラリのダッシュボードを開く
- **設定**（歯車アイコン）— APIキー（「テスト」ボタン付き）、モデル（最新の料金情報付き）、言語、字幕の外観

### ビデオページ
- **トランスクリプト** — 現在のビデオのトランスクリプトを抽出し、タグを付けて保存
- **翻訳** — 翻訳して字幕をオンにします。進捗を表示（クリックでキャンセル）。保存後は同じボタンで字幕のオン／オフを切り替え
- **言語メニュー（▾）** — 翻訳先言語の切り替え、翻訳をテキストで表示、再翻訳、字幕設定
- **要約** — 要約を生成。保存後はその要約を開く

### ダッシュボードタブ

| タブ | 説明 |
|------|------|
| 履歴 | ファジー検索とフィルター付きの全保存トランスクリプト |
| お気に入り | ブックマークしたトランスクリプト |
| 翻訳 | 翻訳済みトランスクリプトの表示と管理 |
| 統計 | ビデオ総数、トークン、単語数、チャンネル数など |
| データ | 設定へのショートカット、エクスポート/インポート（翻訳・要約を含む）、検索インデックスの再構築 |

### AI翻訳の設定

1. [OpenRouter](https://openrouter.ai/)からAPIキーを取得
2. YouTubeナビゲーションバーの設定（歯車）ボタンをクリック
3. APIキーを入力して**テスト**を押し、モデルと翻訳先言語を選択
4. 任意のビデオで**翻訳**をクリック — 完了するとすぐにプレーヤー上に字幕が表示されます

## 技術スタック

- **TypeScript** — 完全に型付けされたコードベース
- **esbuild** — 単一IIFEユーザースクリプトへの高速バンドル
- **Fuse.js** — クライアントサイドファジー検索エンジン
- **IndexedDB** — ローカルストレージ（サーバーなし、アカウント不要）
- **OpenRouter API** — 構造化出力とコスト追跡に対応したマルチモデルAI
- **Trusted Types** — CSP対応DOM操作

## プロジェクト構成

```
src/
├── index.ts              # エントリーポイント、初期化
├── config.ts             # 定数と設定
├── types.ts              # TypeScript型定義
├── db.ts                 # IndexedDBラッパー（TranscriptDB）
├── transcript.ts         # YouTube DOMからのトランスクリプト抽出
├── search.ts             # Fuse.js検索マネージャー
├── ai.ts                 # 翻訳・要約のプロンプトとパイプライン
├── openrouter.ts         # OpenRouterクライアント（リトライ、構造化出力、コスト）
├── http.ts               # キャンセル対応のGM_xmlhttpRequestラッパー
├── segments.ts           # 純粋な字幕パース、チャンク分割、検証、SRT/VTT
├── translation-service.ts # 全UIで共有するジョブ、永続化、字幕
├── settings-store.ts     # ユーザースクリプトストレージ上の設定
├── subtitle-overlay.ts   # 動画上のリアルタイム字幕表示
├── router.ts             # YouTube SPAのナビゲーションハンドラー
├── dom.ts                # DOMユーティリティとCSS注入
├── icons.ts              # SVGアイコンライブラリ
├── utils.ts              # ヘルパー関数
├── trusted-types.ts      # Trusted Typesポリシー
├── global.d.ts           # Tampermonkey APIの型宣言
└── ui/
    ├── navbar.ts          # マストヘッドのボタンとビデオページのアクション
    ├── dashboard.ts       # ライブラリモーダル
    ├── viewer.ts          # 原文／翻訳／要約ビューアー
    ├── copy-modal.ts      # コピー＆タグ付けモーダル
    ├── settings.ts        # 設定モーダル
    ├── summary-options.ts # 要約オプションダイアログ
    ├── modal.ts           # アクセシブルなモーダル＋確認ダイアログ
    ├── menu.ts            # ドロップダウンメニュー
    └── require-key.ts     # APIキーのチェック
tests/                     # bun testのテストスイート
```

## コントリビュート

コントリビュートを歓迎します！Issueの作成やPull Requestの送信をお気軽にどうぞ。

## ライセンス

[MIT](../LICENSE)
