// src/commands/pause.ts
// /rss pause コマンドの処理

import { APIInteractionResponse } from 'discord-api-types/v10';
import { Env, InteractionRequest, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../types';
import { KVStorageManager } from '../utils/kv-storage';
import { createSuccessResponse, createErrorResponse } from '../utils/discord';

/**
 * /rss pause コマンドの処理
 * 指定されたフィードを一時停止する
 */
export async function handlePauseCommand(interaction: InteractionRequest, env: Env): Promise<APIInteractionResponse> {
    const options = interaction.data?.options;

    if (!options || options.length === 0) {
        return createErrorResponse('一時停止するフィードのID、URL、または名前を指定してください。');
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

    console.log(`⏸️ フィード一時停止: ${identifier}`);

    try {
        const kvManager = new KVStorageManager(env);

        // フィード情報を取得
        const feedInfo = await kvManager.findFeedByIdentifier(identifier);

        if (!feedInfo) {
            return createErrorResponse(ERROR_MESSAGES.FEED_NOT_FOUND);
        }

        // 既に一時停止済みかチェック
        if (feedInfo.status === 'paused') {
            return createErrorResponse(`フィード ${feedInfo.id} は既に一時停止中です。`);
        }

        // フィードを一時停止状態に更新
        const updated = await kvManager.updateFeedStatus(identifier, 'paused');

        if (!updated) {
            return createErrorResponse('フィードの一時停止に失敗しました。');
        }

        console.log(`⏸️ フィード一時停止成功: ${feedInfo.id} (${feedInfo.url})`);

        // 成功レスポンス
        const message = `${SUCCESS_MESSAGES.FEED_PAUSED}\n\n**一時停止されたフィード**:\n**ID**: ${feedInfo.id}\n**サイト**: ${feedInfo.title}\n**URL**: ${feedInfo.url}\n\n⚠️ 自動チェックがスキップされます`;

        return createSuccessResponse(message, false); // 公開メッセージ

    } catch (error) {
        console.error('⏸️ Pause command failed:', error);

        if (error instanceof Error && error.message === 'FEED_NOT_FOUND') {
            return createErrorResponse(ERROR_MESSAGES.FEED_NOT_FOUND);
        }

        return createErrorResponse(ERROR_MESSAGES.INTERNAL_ERROR);
    }
}
