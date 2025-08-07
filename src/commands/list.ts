// src/commands/list.ts
// /list コマンドの処理

import { APIInteractionResponse, InteractionResponseType } from 'discord-api-types/v10';
import { Env, InteractionRequest, ERROR_MESSAGES } from '../types';
import { KVStorageManager } from '../utils/kv-storage';
import { createFeedListEmbed, createErrorResponse } from '../utils/discord';

/**
 * /list コマンドの処理
 * 登録されているフィードの一覧を表示する
 */
export async function handleListCommand(interaction: InteractionRequest, env: Env): Promise<APIInteractionResponse> {
    console.log('Listing feeds');

    try {
        const kvManager = new KVStorageManager(env);

        // フィード一覧を取得
        const feeds = await kvManager.getFeeds();

        console.log(`Found ${feeds.length} feeds`);

        // フィード情報をEmbed用の形式に変換
        const feedData = feeds.map(feed => ({
            id: feed.id,
            url: feed.url,
            title: feed.customName || feed.title,
            status: feed.status
        }));

        // Embedを作成
        const embed = createFeedListEmbed(feedData);

        // 追加情報がある場合の詳細フィールド
        if (feeds.length > 0) {
            const activeCount = feeds.filter(f => f.status === 'active').length;
            const pausedCount = feeds.filter(f => f.status === 'paused').length;

            embed.fields = [
                {
                    name: '📊 ステータス',
                    value: `✅ アクティブ: ${activeCount}件\n⏸️ 一時停止: ${pausedCount}件`,
                    inline: true
                }
            ];

            // 最近追加されたフィードの情報
            const recentFeeds = feeds
                .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
                .slice(0, 3);

            if (recentFeeds.length > 0) {
                const recentList = recentFeeds.map(feed => {
                    const addedDate = new Date(feed.addedAt).toLocaleDateString('ja-JP');
                    return `• ${feed.id} (${addedDate})`;
                }).join('\n');

                embed.fields.push({
                    name: '🆕 最近追加',
                    value: recentList,
                    inline: true
                });
            }
        }

        // レスポンスを作成
        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                embeds: [embed]
                // flags を省略（デフォルトで公開メッセージ）
            }
        };

    } catch (error) {
        console.error('List command failed:', error);
        return createErrorResponse(ERROR_MESSAGES.INTERNAL_ERROR);
    }
}
