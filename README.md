# RSS Discord Bot

[![Deploy with Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/your-username/rss-discord-bot)

**高機能なRSS/Atom フィード監視Bot - Cloudflare Workers上で動作**

自動でRSSフィードを監視し、新着記事をDiscordチャンネルに投稿するボットです。Cloudflare Workersで動作し、サーバーレスでコスト効率的な運用が可能です。

## ✨ 主な機能

### 🔄 自動監視機能
- **15分間隔の自動チェック** - Cron Triggerによる定期実行
- **重複投稿防止** - 既読記事の追跡機能
- **多フォーマット対応** - RSS 2.0、Atom 1.0、RSS 1.0に対応
- **レート制限対策** - Discord API制限を考慮した投稿間隔

### 🎛️ 管理機能
- **Slash Commands** - `/rss` コマンドによる直感的な操作
- **フィード管理** - 追加、削除、一時停止、再開
- **ステータス管理** - アクティブ/一時停止の切り替え
- **テスト機能** - フィード追加前の検証

### 🔒 セキュリティ
- **Ed25519署名検証** - Discord Webhookの完全な署名検証
- **管理者権限制御** - ADMINISTRATOR/MANAGE_GUILD権限必須
- **エラー通知** - システムエラーの自動Discord通知

## 🚀 セットアップ

### 1. 必要な準備

#### Discord Bot作成
1. [Discord Developer Portal](https://discord.com/developers/applications)でアプリケーション作成
2. Botセクションでボットを作成し、トークンを取得
3. OAuth2 > URL Generatorで以下の権限を設定：
   - **Bot Permissions**: `Send Messages`, `Use Slash Commands`, `Embed Links`
   - **Scopes**: `bot`, `applications.commands`
4. 生成されたURLでボットをサーバーに招待

#### Cloudflare Workers設定
1. [Cloudflare Dashboard](https://dash.cloudflare.com/)でアカウント作成
2. Workers & Pages > Overview > Create Applicationを選択
3. KV Namespaceを作成（RSS_STORAGE用）

### 2. プロジェクトのクローンと依存関係

```bash
git clone https://github.com/your-username/rss-discord-bot.git
cd rss-discord-bot
npm install
```

### 3. 環境変数の設定

#### ローカル開発用（.env）
```env
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_APPLICATION_ID=your_discord_application_id
DISCORD_PUBLIC_KEY=your_discord_public_key
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

#### Cloudflare Workers用（Secrets）
```bash
# 本番環境のシークレット設定
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_APPLICATION_ID  
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_WEBHOOK_URL
```

### 4. wrangler.tomlの設定

`wrangler.toml`の以下の項目を更新：

```toml
[[kv_namespaces]]
binding = "RSS_STORAGE"
id = "your_kv_namespace_id"           # 本番用KV namespace ID
preview_id = "your_preview_kv_id"     # プレビュー用KV namespace ID
```

### 5. Discord Webhook URLの取得

1. 投稿先のDiscordチャンネルで **チャンネル設定 > 連携サービス > ウェブフック**
2. **新しいウェブフック**を作成
3. Webhook URLをコピーして環境変数に設定

### 6. デプロイ

```bash
# Discord Slash Commandsを登録
npm run register-commands

# Cloudflare Workersにデプロイ
npm run deploy
```

## 📖 使用方法

### 基本コマンド

#### フィード追加
```
/rss add url:https://example.com/feed.xml
```

#### フィード一覧表示
```
/rss list
```

#### フィード削除
```
/rss remove identifier:feed-001
/rss remove identifier:https://example.com/feed.xml
```

#### 全フィード削除
```
/rss removeall
```

#### フィードテスト
```
/rss test url:https://example.com/feed.xml
```

#### 手動チェック実行
```
/rss run
```

### 高度な管理

#### フィード一時停止
```
/rss pause identifier:feed-001
```

#### フィード再開
```
/rss restart identifier:feed-001
```

### フィードの識別方法

フィードは以下の方法で識別できます：
- **フィードID**: `feed-001`, `feed-002` など
- **フィードURL**: `https://example.com/feed.xml`
- **カスタム名**: 追加時に指定した名前

## 🏗️ アーキテクチャ

## 📁 プロジェクト構造

```
├── src/
│   ├── types.ts                    # 型定義
│   ├── index.ts                    # メインWorkers処理
│   ├── utils/
│   │   ├── discord.ts              # Discord API関連
│   │   ├── kv-storage.ts           # KVストレージ管理
│   │   ├── rss-parser.ts           # RSS/Atom解析
│   │   └── rss-checker.ts          # RSS新着チェック機能
│   └── commands/
│       ├── add.ts                  # /rss add コマンド
│       ├── remove.ts               # /rss remove コマンド
│       ├── remove-all.ts           # /rss removeall コマンド
│       ├── list.ts                 # /rss list コマンド
│       ├── test.ts                 # /rss test コマンド
│       ├── run.ts                  # /rss run コマンド
│       ├── pause.ts                # /rss pause コマンド
│       └── restart.ts              # /rss restart コマンド
├── scripts/
│   └── register-commands.ts        # コマンド登録スクリプト
├── package.json
├── tsconfig.json
├── wrangler.toml
└── README.md
```

## 🗂️ データ構造

### KVストレージ構造

```
feeds-metadata              フィード情報
├── feed-001: {
│   ├── id: "feed-001"
│   ├── url: "https://example.com/feed.xml"
│   ├── title: "サイト名"
│   ├── customName: "カスタム名（オプション）"
│   ├── status: "active" | "paused"
│   ├── addedAt: "2024-01-15T10:00:00Z"
│   └── lastChecked: "2024-01-15T12:00:00Z"
│   }
└── feed-002: { ... }

feeds-counter               連番カウンター: "2"

read-articles-feed-001      既読記事ハッシュリスト
├── ["hash1", "hash2", ...]
└── 最新1000件まで保持
```

### サポートするフィード形式

- **RSS 2.0** - 最も一般的な形式
- **RSS 1.0** - RDF/XMLベース
- **Atom 1.0** - Modern Web標準

### 技術スタック

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Storage**: Cloudflare KV
- **API**: Discord.js Types, Discord API v10
- **Security**: Ed25519 署名検証
- **Scheduling**: Cron Triggers

### データストレージ

KVストレージを使用した効率的なデータ管理については、**🗂️ データ構造**セクションを参照してください。

## 🔧 開発

### ローカル開発

```bash
# 開発サーバー起動
npm run dev

# 型チェック
npm run type-check

# コマンド登録（開発環境）
npm run register-commands
```

### API エンドポイント

| Endpoint | Method | 説明 |
|----------|--------|------|
| `/discord` | POST | Discord Interaction処理 |
| `/health` | GET | ヘルスチェック |
| `/rss-check` | POST | 手動RSSチェック |
| `/clear-read` | POST | 既読記事クリア（デバッグ用） |

### デバッグ

#### 既読記事をクリア
```bash
curl -X POST https://your-worker.workers.dev/clear-read \
  -H "Content-Type: application/json" \
  -d '{"feedId": "feed-001"}'
```

#### 手動RSSチェック
```bash
curl -X POST https://your-worker.workers.dev/rss-check
```

## ⚙️ 設定

## ⚙️ 設定

### 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `DISCORD_BOT_TOKEN` | Discordボットのトークン | ✅ |
| `DISCORD_APPLICATION_ID` | DiscordアプリケーションID | ✅ |
| `DISCORD_PUBLIC_KEY` | Discord公開鍵（署名検証用） | ✅ |
| `DISCORD_WEBHOOK_URL` | 投稿先チャンネルのWebhook URL | ✅ |
| `ENVIRONMENT` | 環境識別子（development/production） | ❌ |

## ⚙️ 自動実行設定

### 実行スケジュール
- **実行間隔**: 15分（`wrangler.toml`の`crons`設定で変更可能）
- **チェック方式**: 全アクティブフィードを順次処理
- **タイムアウト**: フィード取得10-15秒、全体処理時間制限あり

### チェック設定
- **チェック件数**: フィードあたり最新3件の記事
- **重複防止**: 記事のGUID/タイトル+URLハッシュで管理
- **既読記事**: 最新1000件まで保持（古いものは自動削除）

### レート制限対策
- **フィード間隔**: 2秒間隔でフィードを処理
- **投稿間隔**: Discord投稿間1秒間隔
- **エラー制御**: 連続エラー時の自動通知

### パフォーマンス最適化
- **軽量チェック**: `/rss run`コマンドは1フィードのみ高速処理
- **効率的ストレージ**: KVアクセス最小化
- **キャッシュ戦略**: 既読記事の効率的な管理

## 🚨 トラブルシューティング

### よくある問題

#### 1. コマンドが表示されない
**原因**: Slash Commandsが登録されていない  
**解決**: `npm run register-commands` を実行

#### 2. 署名検証エラー
**原因**: `DISCORD_PUBLIC_KEY`が間違っている  
**解決**: Discord Developer PortalでPublic Keyを再確認

#### 3. 新着記事が投稿されない
**原因**: Webhook URLが無効、またはフィードが一時停止中  
**解決**:
- Webhook URLを確認
- `/rss list` でフィードステータスを確認
- `/rss test` でフィードをテスト

#### 4. KVストレージエラー
**原因**: KV Namespace IDが間違っている  
**解決**: `wrangler.toml`のKV設定を確認

### ログの確認

```bash
# リアルタイムログ確認
wrangler tail

# 特定の関数のログ
wrangler tail --format pretty
```

### エラー通知

システムエラーは自動的にDiscordに通知されます：
- RSS取得エラー
- API制限エラー
- KVストレージエラー
- 予期しないエラー

## 📊 監視とメトリクス

### 利用可能な統計

```bash
# ストレージ統計を取得
curl https://your-worker.workers.dev/health
```

レスポンス例：
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00Z",
  "version": "1.0.0"
}
```

### Cloudflare Analytics

Cloudflare Dashboardで以下のメトリクスを確認可能：
- **リクエスト数**: Discord Interactionsの処理回数
- **実行時間**: RSS処理の所要時間
- **エラー率**: 失敗したリクエストの割合
- **KV操作**: ストレージアクセス回数

## 🤝 コントリビューション

### 開発環境セットアップ

```bash
git clone https://github.com/your-username/rss-discord-bot.git
cd rss-discord-bot
npm install
cp .env.example .env
# .envファイルを編集
npm run dev
```

### プルリクエスト

1. フィーチャーブランチを作成
2. 変更を実装・テスト
3. TypeScriptの型チェックを通す
4. プルリクエストを作成

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 🙏 謝辞

- [Cloudflare Workers](https://workers.cloudflare.com/) - サーバーレス実行環境
- [Discord.js](https://discord.js.org/) - Discord API Types
- [TypeScript](https://www.typescriptlang.org/) - 型安全な開発環境

---

**🚀 プロダクションレディなRSS Discord Bot**

高可用性、セキュア、コスト効率的なRSSフィード監視ソリューション
