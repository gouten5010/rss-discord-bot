// src/commands/remove-all.ts
// /removeall コマンドの処理

import { APIInteractionResponse } from 'discord-api-types/v10';
import { Env, InteractionRequest, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../types';
import { KVStorageManager } from '../utils/kv-storage';
import { createSuccessResponse, createErrorResponse } from '../utils/discord';

/**
 * /removeall コマンドの処理
 * すべてのフィードを削除する
 */
export async function handleRemoveAllCommand(interaction: InteractionRequest, env: Env): Promise<APIInteractionResponse> {
    console.log('Removing all feeds');

    try {
        const kvManager = new KVStorageManager(env);

        // 削除前にフィード一覧を取得（ログ・確認用）
        const existingFeeds = await kvManager.getFeeds();

        if (existingFeeds.length === 0) {
            return createErrorResponse(ERROR_MESSAGES.NO_FEEDS);
        }

        console.log(`About to remove ${existingFeeds.length} feeds`);

        // すべてのフィードを削除
        const removedCount = await kvManager.removeAllFeeds();

        if (removedCount === 0) {
            return createErrorResponse('削除するフィードがありません。');
        }

        console.log(`Successfully removed ${removedCount} feeds`);

        // 削除されたフィードの一覧を作成（最初の5件まで表示）
        const feedList = existingFeeds.slice(0, 5).map(feed =>
            `• **${feed.id}**: ${feed.title}`
        ).join('\n');

        const moreFeeds = existingFeeds.length > 5 ? `\n...他${existingFeeds.length - 5}件` : '';

        // 成功レスポンス
        const message = `${SUCCESS_MESSAGES.ALL_FEEDS_REMOVED}\n\n**削除されたフィード (${removedCount}件)**:\n${feedList}${moreFeeds}`;

        return createSuccessResponse(message, false); // 公開メッセージ

    } catch (error) {
        console.error('Remove all command failed:', error);
        return createErrorResponse(ERROR_MESSAGES.INTERNAL_ERROR);
    }
}
