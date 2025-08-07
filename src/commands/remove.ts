// src/commands/remove.ts
// /remove コマンドの処理

import { APIInteractionResponse } from 'discord-api-types/v10';
import { Env, InteractionRequest, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../types';
import { KVStorageManager } from '../utils/kv-storage';
import { createSuccessResponse, createErrorResponse } from '../utils/discord';

/**
 * /remove コマンドの処理
 * 指定されたフィードを削除する
 */
export async function handleRemoveCommand(interaction: InteractionRequest, env: Env): Promise<APIInteractionResponse> {
    const options = interaction.data?.options;

    if (!options || options.length === 0) {
        return createErrorResponse('削除するフィードのID、URL、または名前を指定してください。');
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

    console.log(`Removing feed: ${identifier}`);

    try {
        const kvManager = new KVStorageManager(env);

        // 削除前にフィード情報を取得（ログ用）
        const feedInfo = await kvManager.findFeedByIdentifier(identifier);

        if (!feedInfo) {
            return createErrorResponse(ERROR_MESSAGES.FEED_NOT_FOUND);
        }

        // フィードを削除
        const removed = await kvManager.removeFeed(identifier);

        if (!removed) {
            return createErrorResponse('フィードの削除に失敗しました。');
        }

        console.log(`Feed removed successfully: ${feedInfo.id} (${feedInfo.url})`);

        // 成功レスポンス
        const message = `${SUCCESS_MESSAGES.FEED_REMOVED}\n\n**削除されたフィード**:\n**ID**: ${feedInfo.id}\n**サイト**: ${feedInfo.title}\n**URL**: ${feedInfo.url}`;

        return createSuccessResponse(message, false); // 公開メッセージ

    } catch (error) {
        console.error('Remove command failed:', error);

        if (error instanceof Error && error.message === 'FEED_NOT_FOUND') {
            return createErrorResponse(ERROR_MESSAGES.FEED_NOT_FOUND);
        }

        return createErrorResponse(ERROR_MESSAGES.INTERNAL_ERROR);
    }
}
