// src/commands/run.ts
// /rss run コマンドの処理

import { APIInteractionResponse, InteractionResponseType } from 'discord-api-types/v10';
import { Env, InteractionRequest, SUCCESS_MESSAGES } from '../types';
import { RSSChecker } from '../utils/rss-checker';
import { createSuccessResponse, createErrorResponse } from '../utils/discord';

/**
 * /rss run コマンドの処理
 * RSS新着チェックを即座に実行する（軽量版）
 */
export async function handleRunCommand(interaction: InteractionRequest, env: Env): Promise<APIInteractionResponse> {
    console.log('🚀 手動RSS新着チェック開始');

    try {
        const rssChecker = new RSSChecker(env);

        // 軽量チェック（1件のフィードのみ、高速実行）
        const feeds = await rssChecker.quickCheck();

        if (feeds.newArticles === 0) {
            return createSuccessResponse('RSS新着チェック完了。新着記事はありませんでした。', false);
        } else {
            return createSuccessResponse(`RSS新着チェック完了。${feeds.newArticles}件の新着記事を投稿しました。`, false);
        }

    } catch (error) {
        console.error('❌ 手動RSSチェックでエラー:', error);
        return createErrorResponse(`RSS新着チェックに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
