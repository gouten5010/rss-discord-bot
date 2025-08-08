// src/index.ts
// Cloudflare Workers のメインエントリーポイント

import { InteractionType, InteractionResponseType } from 'discord-api-types/v10';
import { Env, InteractionRequest, COMMANDS } from './types';
import { verifyDiscordRequest, hasAdminPermission, createErrorResponse, notifySystemError } from './utils/discord';
import { RSSChecker } from './utils/rss-checker';
import { KVStorageManager } from './utils/kv-storage';
import { handleAddCommand } from './commands/add';
import { handleRemoveCommand } from './commands/remove';
import { handleRemoveAllCommand } from './commands/remove-all';
import { handleListCommand } from './commands/list';
import { handleTestCommand } from './commands/test';
import { handleRunCommand } from './commands/run';
import { handlePauseCommand } from './commands/pause';
import { handleRestartCommand } from './commands/restart';

/**
 * Cloudflare Workers のメインハンドラ
 */
export default {
    /**
     * HTTP リクエスト処理
     */
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        try {
            const url = new URL(request.url);

            // Discord Interaction の処理（POSTのみ）
            if (url.pathname === '/discord') {
                if (request.method === 'POST') {
                    return await handleDiscordInteraction(request, env);
                } else {
                    // GET リクエストには適切なレスポンス
                    return new Response('Discord Interaction Endpoint - POST only', {
                        status: 405,
                        headers: {
                            'Allow': 'POST',
                            'Content-Type': 'text/plain'
                        }
                    });
                }
            }

            // ヘルスチェック用エンドポイント
            if (request.method === 'GET' && url.pathname === '/health') {
                return new Response(JSON.stringify({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0-phase1'
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // 手動RSS チェック用エンドポイント
            if (request.method === 'POST' && url.pathname === '/rss-check') {
                const rssChecker = new RSSChecker(env);
                await rssChecker.checkAllFeeds();

                return new Response(JSON.stringify({
                    success: true,
                    message: 'RSS check completed',
                    timestamp: new Date().toISOString()
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // デバッグ用：既読記事クリア
            if (request.method === 'POST' && url.pathname === '/clear-read') {
                try {
                    const body = await request.text();
                    const { feedId } = JSON.parse(body || '{}');

                    const kvManager = new KVStorageManager(env);
                    if (feedId) {
                        await kvManager.clearReadArticles(feedId);
                        return new Response(JSON.stringify({
                            success: true,
                            message: `Feed ${feedId} の既読記事をクリアしました`
                        }), { headers: { 'Content-Type': 'application/json' } });
                    } else {
                        const feeds = await kvManager.getFeeds();
                        for (const feed of feeds) {
                            await kvManager.clearReadArticles(feed.id);
                        }
                        return new Response(JSON.stringify({
                            success: true,
                            message: '全フィードの既読記事をクリアしました'
                        }), { headers: { 'Content-Type': 'application/json' } });
                    }
                } catch (error) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    }), { headers: { 'Content-Type': 'application/json' } });
                }
            }

            // デフォルトレスポンス
            return new Response(
                'RSS Discord Bot - Phase 1\n\nEndpoints:\n- POST /discord - Discord Interactions\n- GET /health - Health Check\n- POST /test - Manual RSS Check (Phase 2)',
                { headers: { 'Content-Type': 'text/plain' } }
            );

        } catch (error) {
            console.error('Request handling error:', error);

            // システムエラーをDiscordに通知
            if (env.DISCORD_WEBHOOK_URL) {
                await notifySystemError(
                    env.DISCORD_WEBHOOK_URL,
                    error instanceof Error ? error.message : 'Unknown error',
                    'Request processing failed'
                );
            }

            return new Response('Internal Server Error', { status: 500 });
        }
    },

    /**
     * Cron Trigger での定期実行（15分間隔）
     */
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log('⏰ RSS定期チェック開始 - Cron Trigger実行');

        try {
            const rssChecker = new RSSChecker(env);
            await rssChecker.checkAllFeeds();

            console.log('✅ RSS定期チェック完了');

        } catch (error) {
            console.error('❌ RSS定期チェックでエラー:', error);

            // システムエラーをDiscordに通知
            if (env.DISCORD_WEBHOOK_URL) {
                await notifySystemError(
                    env.DISCORD_WEBHOOK_URL,
                    error instanceof Error ? error.message : 'Unknown error',
                    'Scheduled RSS check failed'
                );
            }
        }
    }
};

/**
 * Discord Interaction の処理
 */
async function handleDiscordInteraction(request: Request, env: Env): Promise<Response> {
    try {
        // Content-Typeチェック
        const contentType = request.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.log('Invalid content-type:', contentType);
            return new Response('Bad Request', { status: 400 });
        }

        // Discord署名の検証（本格実装）
        const { valid, body } = await verifyDiscordRequest(request, env);
        if (!valid) {
            console.log('Invalid Discord signature');
            return new Response('Unauthorized', { status: 401 });
        }

        console.log('Received Discord interaction:', body);

        const interaction: InteractionRequest = JSON.parse(body);

        // PING応答（Discord Bot検証用）
        if (interaction.type === InteractionType.Ping) {
            console.log('Responding to Discord PING');
            const pongResponse = {
                type: InteractionResponseType.Pong
            };
            console.log('PONG response:', JSON.stringify(pongResponse));

            return new Response(JSON.stringify(pongResponse), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                }
            });
        }

        // アプリケーションコマンドの処理
        if (interaction.type === InteractionType.ApplicationCommand && interaction.data) {
            return await handleApplicationCommand(interaction, env);
        }

        // 未対応のInteractionタイプ
        console.log('Unhandled interaction type:', interaction.type);
        return new Response(JSON.stringify({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: '未対応のコマンドです。',
                flags: 64 // EPHEMERAL
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Discord interaction handling error:', error);

        return new Response(JSON.stringify({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: '❌ コマンドの処理中にエラーが発生しました。',
                flags: 64 // EPHEMERAL
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * アプリケーションコマンドの処理
 */
async function handleApplicationCommand(interaction: InteractionRequest, env: Env): Promise<Response> {
    const commandName = interaction.data?.name;

    if (!commandName) {
        return new Response(JSON.stringify(createErrorResponse('コマンド名が見つかりません。')), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 管理者権限チェック
    if (!hasAdminPermission(interaction)) {
        return new Response(JSON.stringify(createErrorResponse('このコマンドを実行する権限がありません。')), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    console.log(`Processing command: ${commandName}`);

    // /rss コマンドの処理
    if (commandName === 'rss') {
        const subcommand = interaction.data?.options?.[0]?.name;
        const subcommandOptions = interaction.data?.options?.[0]?.options;

        if (!subcommand) {
            return new Response(JSON.stringify(createErrorResponse('サブコマンドが見つかりません。')), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`Processing RSS subcommand: ${subcommand}`);

        // サブコマンド用のinteractionオブジェクトを作成
        const subInteraction = {
            ...interaction,
            data: {
                ...interaction.data,
                name: subcommand,
                options: subcommandOptions || []
            }
        };

        try {
            let response;

            switch (subcommand) {
                case 'add':
                    response = await handleAddCommand(subInteraction, env);
                    break;
                case 'remove':
                    response = await handleRemoveCommand(subInteraction, env);
                    break;
                case 'removeall':
                    response = await handleRemoveAllCommand(subInteraction, env);
                    break;
                case 'list':
                    response = await handleListCommand(subInteraction, env);
                    break;
                case 'test':
                    response = await handleTestCommand(subInteraction, env);
                    break;
                case 'run':
                    response = await handleRunCommand(subInteraction, env);
                    break;
                case 'pause':
                    response = await handlePauseCommand(subInteraction, env);
                    break;
                case 'restart':
                    response = await handleRestartCommand(subInteraction, env);
                    break;
                default:
                    response = createErrorResponse(`未知のサブコマンドです: ${subcommand}`);
            }

            return new Response(JSON.stringify(response), {
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error(`Subcommand ${subcommand} failed:`, error);

            // エラーをDiscordに通知
            if (env.DISCORD_WEBHOOK_URL) {
                await notifySystemError(
                    env.DISCORD_WEBHOOK_URL,
                    error instanceof Error ? error.message : 'Unknown error',
                    `Subcommand failed: ${subcommand}`
                );
            }

            return new Response(JSON.stringify(createErrorResponse('コマンドの実行に失敗しました。')), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // その他のコマンド（将来の拡張用）
    return new Response(JSON.stringify(createErrorResponse(`未知のコマンドです: ${commandName}`)), {
        headers: { 'Content-Type': 'application/json' }
    });
}
