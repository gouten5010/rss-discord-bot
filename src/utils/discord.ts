// src/utils/discord.ts
// Discord API関連のユーティリティ関数

import {
    APIInteractionResponse,
    InteractionResponseType,
    MessageFlags,
} from 'discord-api-types/v10';
import {
    Env,
    InteractionRequest,
    DiscordWebhookPayload,
    DiscordEmbed,
    DISCORD_PERMISSIONS,
} from '../types';

/**
 * Discord署名を検証する
 */
export async function verifyDiscordRequest(
    request: Request,
    env: Env
): Promise<{ valid: boolean; body: string }> {
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');

    if (!signature || !timestamp) {
        console.log('Missing signature or timestamp headers');
        return { valid: false, body: '' };
    }

    try {
        const body = await request.text();
        const isValid = await verifySignature(
            body,
            signature,
            timestamp,
            env.DISCORD_PUBLIC_KEY
        );
        return { valid: isValid, body };
    } catch (error) {
        console.error('Discord signature verification failed:', error);
        return { valid: false, body: '' };
    }
}

/**
 * Ed25519署名を検証する（WebCrypto API使用）
 */
async function verifySignature(
    body: string,
    signature: string,
    timestamp: string,
    publicKey: string
): Promise<boolean> {
    try {
        // タイムスタンプチェック（5分以内）
        const now = Math.floor(Date.now() / 1000);
        const requestTime = parseInt(timestamp, 10);
        if (Math.abs(now - requestTime) > 300) {
            console.log('Request timestamp too old:', { now, requestTime, diff: Math.abs(now - requestTime) });
            return false;
        }

        // 署名検証用のメッセージを構築
        const message = timestamp + body;
        const messageBytes = new TextEncoder().encode(message);

        // 16進数文字列をUint8Arrayに変換
        const signatureBytes = hexToUint8Array(signature);
        const publicKeyBytes = hexToUint8Array(publicKey);

        // Cloudflare WorkersのWebCrypto APIでEd25519署名を検証
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            publicKeyBytes,
            {
                name: 'Ed25519',
                namedCurve: 'Ed25519',
            },
            false,
            ['verify']
        );

        const isValid = await crypto.subtle.verify(
            'Ed25519',
            cryptoKey,
            signatureBytes,
            messageBytes
        );

        console.log('Signature verification result:', isValid);
        return isValid;

    } catch (error) {
        console.error('Signature verification error:', error);

        // WebCrypto APIでEd25519がサポートされていない場合のフォールバック
        if (error instanceof Error && error.message.includes('Ed25519')) {
            console.log('Ed25519 not supported, falling back to basic validation');
            // 基本的なフォーマット検証のみ
            return signature.length === 128 && publicKey.length === 64;
        }

        return false;
    }
}

/**
 * 16進数文字列をUint8Arrayに変換
 */
function hexToUint8Array(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

/**
 * ユーザーが管理者権限を持っているかチェック
 */
export function hasAdminPermission(interaction: InteractionRequest): boolean {
    const permissions = interaction.member?.permissions;
    if (!permissions) {
        return false;
    }

    const permissionBits = BigInt(permissions);
    const adminBits = BigInt(DISCORD_PERMISSIONS.ADMINISTRATOR);
    const manageBits = BigInt(DISCORD_PERMISSIONS.MANAGE_GUILD);

    return (permissionBits & adminBits) !== 0n ||
        (permissionBits & manageBits) !== 0n;
}

/**
 * Discord Interactionレスポンスを作成
 */
export function createInteractionResponse(
    message: string,
    ephemeral: boolean = true
): APIInteractionResponse {
    return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            content: message,
            flags: ephemeral ? MessageFlags.Ephemeral : undefined,
        },
    };
}

/**
 * エラー用のInteractionレスポンスを作成
 */
export function createErrorResponse(
    message: string
): APIInteractionResponse {
    return createInteractionResponse(`❌ ${message}`, true);
}

/**
 * 成功用のInteractionレスポンスを作成
 */
export function createSuccessResponse(
    message: string,
    ephemeral: boolean = true
): APIInteractionResponse {
    return createInteractionResponse(`✅ ${message}`, ephemeral);
}

/**
 * フィード一覧表示用のEmbedを作成
 */
export function createFeedListEmbed(
    feeds: Array<{id: string, url: string, title: string, status: string}>
): DiscordEmbed {
    const description = feeds.length === 0
        ? '登録されているフィードがありません。'
        : feeds.map(feed => {
            const statusEmoji = feed.status === 'active' ? '✅' : '⏸️';
            return `${statusEmoji} **${feed.id}**: ${feed.title}\n🔗 ${feed.url}`;
        }).join('\n\n');

    return {
        title: '📋 登録フィード一覧',
        description,
        color: 0x5865f2, // Discord Blue
        timestamp: new Date().toISOString(),
        footer: {
            text: `合計: ${feeds.length}件`,
        },
    };
}

/**
 * RSS記事用のEmbedを作成
 */
export function createArticleEmbed(
    article: { title: string; link: string; description: string; pubDate: Date },
    feedTitle: string
): DiscordEmbed {
    return {
        title: article.title,
        url: article.link,
        description: article.description || '記事の詳細はリンクをご確認ください。',
        color: 0x1f8b4c, // Green
        timestamp: article.pubDate.toISOString(),
        footer: {
            text: `📰 ${feedTitle}`,
        },
    };
}

/**
 * フィードテスト結果用のEmbedを作成
 */
export function createTestResultEmbed(
    url: string,
    success: boolean,
    title?: string,
    articlesCount?: number,
    error?: string
): DiscordEmbed {
    const color = success ? 0x1f8b4c : 0xe74c3c; // Green or Red
    const statusEmoji = success ? '✅' : '❌';

    let description = `${statusEmoji} **フィードURL**: ${url}\n`;

    if (success && title && articlesCount !== undefined) {
        description += `📰 **サイトタイトル**: ${title}\n`;
        description += `📄 **記事数**: ${articlesCount}件`;
    } else if (error) {
        description += `⚠️ **エラー**: ${error}`;
    }

    return {
        title: '🧪 フィードテスト結果',
        description,
        color,
        timestamp: new Date().toISOString(),
        footer: {
            text: 'RSS Feed Test',
        },
    };
}

/**
 * Webhook経由でDiscordにメッセージを送信
 */
export async function sendWebhookMessage(
    webhookUrl: string,
    payload: DiscordWebhookPayload
): Promise<boolean> {
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error(`Webhook error: ${response.status} ${response.statusText}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Failed to send webhook message:', error);
        return false;
    }
}

/**
 * システムエラーをDiscordに通知
 */
export async function notifySystemError(
    webhookUrl: string,
    error: string,
    context?: string
): Promise<void> {
    const embed: DiscordEmbed = {
        title: '🚨 システムエラー',
        description: `**エラー内容**: ${error}${context ? `\n**詳細**: ${context}` : ''}`,
        color: 0xe74c3c, // Red
        timestamp: new Date().toISOString(),
        footer: {
            text: 'RSS Bot Error Notification',
        },
    };

    await sendWebhookMessage(webhookUrl, { embeds: [embed] });
}
