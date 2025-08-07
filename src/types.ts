// src/types.ts
// アプリケーション全体で使用する型定義

// Discord API関連の型は必要時にimport

// 環境変数の型定義
export interface Env {
    DISCORD_BOT_TOKEN: string;
    DISCORD_APPLICATION_ID: string;
    DISCORD_PUBLIC_KEY: string;
    DISCORD_WEBHOOK_URL: string;
    RSS_STORAGE: KVNamespace;
    ENVIRONMENT?: string;
}

// フィード情報の型定義
export interface FeedInfo {
    id: string;                    // feed-001 のような連番ID
    url: string;                   // RSS/AtomフィードのURL
    title: string;                 // サイトタイトル（RSS取得時に設定）
    customName?: string;           // ユーザーが指定したカスタム名（オプション）
    status: 'active' | 'paused';   // フィードの状態
    addedAt: string;               // 登録日時（ISO8601形式）
    lastChecked?: string;          // 最終チェック日時（ISO8601形式）
}

// フィードメタデータ（KVストレージに保存）
export interface FeedsMetadata {
    [feedId: string]: FeedInfo;
}

// RSS/Atom記事の型定義
export interface Article {
    title: string;        // 記事タイトル
    link: string;         // 記事URL
    pubDate: Date;        // 公開日時
    description: string;  // 記事概要
    content?: string;     // 記事詳細（取得可能な場合）
    guid?: string;        // 記事のユニークID（RSS）
    id?: string;          // 記事のユニークID（Atom）
}

// Discord Embed用の型定義
export interface DiscordEmbed {
    title: string;
    url?: string;         // オプショナルに変更
    description: string;
    color: number;
    timestamp: string;
    footer: {
        text: string;
    };
    fields?: {
        name: string;
        value: string;
        inline?: boolean;
    }[];
}

// Discord Webhook ペイロード
export interface DiscordWebhookPayload {
    content?: string;
    embeds?: DiscordEmbed[];
    username?: string;
    avatar_url?: string;
}

// Discordコマンドのレスポンス型
export interface CommandResponse {
    success: boolean;
    message: string;
    data?: any;
}

// KVストレージのキー名定数
export const KV_KEYS = {
    FEEDS_METADATA: 'feeds-metadata',
    FEEDS_COUNTER: 'feeds-counter',
    READ_ARTICLES_PREFIX: 'read-articles-',
} as const;

// コマンド名の定数
export const COMMANDS = {
    ADD: 'add',
    REMOVE: 'remove',
    REMOVEALL: 'removeall',
    LIST: 'list',
    TEST: 'test',
    RUN: 'run',
    PAUSE: 'pause',
    RESTART: 'restart',
} as const;

// エラーメッセージの定数
export const ERROR_MESSAGES = {
    INVALID_URL: 'フィードが読み取れません。URLを確認してください。',
    FEED_EXISTS: 'このフィードは既に登録されています。',
    FEED_NOT_FOUND: '指定されたフィードが見つかりません。',
    FETCH_FAILED: 'フィードの取得に失敗しました。',
    UNAUTHORIZED: 'このコマンドを実行する権限がありません。',
    INTERNAL_ERROR: '内部エラーが発生しました。',
    NO_FEEDS: '登録されているフィードがありません。',
} as const;

// 成功メッセージの定数
export const SUCCESS_MESSAGES = {
    FEED_ADDED: 'フィードを追加しました。',
    FEED_REMOVED: 'フィードを削除しました。',
    ALL_FEEDS_REMOVED: 'すべてのフィードを削除しました。',
    FEED_PAUSED: 'フィードを一時停止しました。',
    FEED_RESTARTED: 'フィードを再開しました。',
    RSS_CHECK_STARTED: 'RSS チェックを開始しました。',
    FEED_TEST_SUCCESS: 'フィードのテストが成功しました。',
} as const;

// Discord API関連の型定義
export interface InteractionRequest {
    type: number;
    data?: {
        name: string;
        options?: Array<{
            name: string;
            value: string | number | boolean;
        }>;
    };
    member?: {
        permissions: string;
    };
    user?: {
        id: string;
        username: string;
    };
}

// 権限チェック用の定数
export const DISCORD_PERMISSIONS = {
    ADMINISTRATOR: '8',
    MANAGE_GUILD: '32',
} as const;
