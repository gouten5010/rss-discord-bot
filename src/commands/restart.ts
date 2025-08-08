// src/commands/restart.ts
// /rss restart コマンドの処理

import { APIInteractionResponse } from 'discord-api-types/v10';
import { Env, InteractionRequest, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../types';
import { KVStorageManager } from '../utils/kv-storage';
import { createSuccessResponse, createErrorResponse } from '../utils/discord';

/**
 * /rss restart コマンドの処理
 * 指定されたフィードを再開する
 */
export async function handleRestartCommand(interaction: InteractionRequest, env: Env): Promise<APIInteractionResponse> {
    const options = interaction.data?.options;

    if (!options || options.length === 0) {
        return createErrorResponse('再開するフィードのID、URL、または名前を指定してください。');
    }

    // パラメータの取得
    const identifierOption = options.find(opt => opt.name === 'identifier');

    if (!identifierOption || typeof identifierOption.value !== 'string') {
        return createErrorResponse('有効なフィード識別子を指定してください。');
    }

    const identifier = identifierOption.value.trim();

    if (!identifier) {
        return createErrorResponse('フィード識別子が空です。');
    }

    console.log(`▶️ フィード再開: ${identifier}`);

    try {
        const kvManager = new KVStorageManager(env);

        // フィード情報を取得
        const feedInfo = await kvManager.findFeedByIdentifier(identifier);

        if (!feedInfo) {
            return createErrorResponse(ERROR_MESSAGES.FEED_NOT_FOUND);
        }

        // 既にアクティブかチェック
        if (feedInfo.status === 'active') {
            return createErrorResponse(`フィード ${feedInfo.id} は既にアクティブです。`);
        }

        // フィードをアクティブ状態に更新
        const updated = await kvManager.updateFeedStatus(identifier, 'active');

        if (!updated) {
            return createErrorResponse('フィードの再開に失敗しました。');
        }

        console.log(`▶️ フィード再開成功: ${feedInfo.id} (${feedInfo.url})`);

        // 成功レスポンス
        const message = `${SUCCESS_MESSAGES.FEED_RESTARTED}\n\n**再開されたフィード**:\n**ID**: ${feedInfo.id}\n**サイト**: ${feedInfo.title}\n**URL**: ${feedInfo.url}\n\n✅ 次回の自動チェックから再開されます`;

        return createSuccessResponse(message, false); // 公開メッセージ

    } catch (error) {
        console.error('▶️ Restart command failed:', error);

        if (error instanceof Error && error.message === 'FEED_NOT_FOUND') {
            return createErrorResponse(ERROR_MESSAGES.FEED_NOT_FOUND);
        }

        return createErrorResponse(ERROR_MESSAGES.INTERNAL_ERROR);
    }
}
