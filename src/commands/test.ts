// src/commands/test.ts
// /rss test コマンドの処理

import { APIInteractionResponse, InteractionResponseType } from 'discord-api-types/v10';
import { Env, InteractionRequest } from '../types';
import { RSSChecker } from '../utils/rss-checker';
import { createTestResultEmbed, createErrorResponse } from '../utils/discord';

/**
 * /rss test コマンドの処理
 * 指定されたフィードのテスト取得を行う
 */
export async function handleTestCommand(interaction: InteractionRequest, env: Env): Promise<APIInteractionResponse> {
    const options = interaction.data?.options;

    if (!options || options.length === 0) {
        return createErrorResponse('テストするフィードのURLが指定されていません。');
    }

    // パラメータの取得
    const urlOption = options.find(opt => opt.name === 'url');

    if (!urlOption || typeof urlOption.value !== 'string') {
        return createErrorResponse('有効なURLを指定してください。');
    }

    const feedUrl = urlOption.value.trim();

    console.log(`🧪 フィードテスト開始: ${feedUrl}`);

    try {
        // URLの基本的なバリデーション
        if (!isValidUrl(feedUrl)) {
            return createErrorResponse('有効なURLを指定してください。');
        }

        const rssChecker = new RSSChecker(env);
        const testResult = await rssChecker.testFeed(feedUrl);

        if (!testResult.success) {
            const embed = createTestResultEmbed(
                feedUrl,
                false,
                undefined,
                undefined,
                testResult.error
            );

            return {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    embeds: [embed]
                }
            };
        }

        // 成功時のレスポンス
        const embed = createTestResultEmbed(
            feedUrl,
            true,
            testResult.title,
            testResult.articlesCount
        );

        // テスト結果に記事サンプルを追加
        if (testResult.articles && testResult.articles.length > 0) {
            const sampleArticles = testResult.articles.slice(0, 2).map(article => {
                const pubDate = article.pubDate.toLocaleDateString('ja-JP');
                return `• **${article.title}**\n  ${pubDate} - [リンク](${article.link})`;
            }).join('\n\n');

            embed.fields = [
                {
                    name: '📄 サンプル記事',
                    value: sampleArticles,
                    inline: false
                }
            ];
        }

        console.log(`🧪 フィードテスト成功: ${feedUrl}`);

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                embeds: [embed]
            }
        };

    } catch (error) {
        console.error('🧪 フィードテストに失敗:', error);

        const embed = createTestResultEmbed(
            feedUrl,
            false,
            undefined,
            undefined,
            'フィードの取得中にエラーが発生しました'
        );

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                embeds: [embed]
            }
        };
    }
}

/**
 * URLの基本的なバリデーション
 */
function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

