// src/utils/rss-checker.ts
// RSS新着記事チェック・自動投稿機能

import { Env, Article } from '../types';
import { KVStorageManager } from './kv-storage';
import { parseArticles } from './rss-parser';
import { sendWebhookMessage, createArticleEmbed, notifySystemError } from './discord';

/**
 * RSS新着チェック・自動投稿クラス
 */
export class RSSChecker {
    private env: Env;
    private kvManager: KVStorageManager;

    constructor(env: Env) {
        this.env = env;
        this.kvManager = new KVStorageManager(env);
    }

    /**
     * 全フィードの新着チェックを実行
     */
    async checkAllFeeds(): Promise<void> {
        console.log('🔄 RSS新着チェック開始...');

        try {
            const feeds = await this.kvManager.getFeeds();
            const activeFeeds = feeds.filter(feed => feed.status === 'active');

            console.log(`📊 アクティブフィード数: ${activeFeeds.length}/${feeds.length}`);

            if (activeFeeds.length === 0) {
                console.log('ℹ️ チェック対象のフィードがありません');
                return;
            }

            let totalNewArticles = 0;
            let successCount = 0;
            let errorCount = 0;

            for (const feed of activeFeeds) {
                try {
                    const newArticleCount = await this.checkFeed(feed);
                    totalNewArticles += newArticleCount;
                    successCount++;

                    // フィード間の間隔を空ける（レート制限対策）
                    await this.sleep(2000);

                } catch (error) {
                    console.error(`❌ フィード ${feed.id} のチェックに失敗:`, error);
                    errorCount++;

                    // エラーが続く場合はシステム通知
                    if (errorCount >= 3) {
                        await notifySystemError(
                            this.env.DISCORD_WEBHOOK_URL,
                            `複数のフィードでエラーが発生 (${errorCount}件)`,
                            'RSS Check Error'
                        );
                    }
                }
            }

            console.log(`✅ RSS新着チェック完了 - 新着: ${totalNewArticles}件, 成功: ${successCount}件, エラー: ${errorCount}件`);

        } catch (error) {
            console.error('❌ RSS新着チェックでエラー:', error);

            await notifySystemError(
                this.env.DISCORD_WEBHOOK_URL,
                error instanceof Error ? error.message : 'Unknown error',
                'RSS Check System Error'
            );
        }
    }

    /**
     * 単一フィードの新着チェック
     */
    private async checkFeed(feed: any): Promise<number> {
        console.log(`🔍 ${feed.id} (${feed.title}) をチェック中...`);

        try {
            // 最新3件の記事を取得
            const articles = await parseArticles(feed.url, 3);

            if (articles.length === 0) {
                console.log(`📰 ${feed.id}: 記事が見つかりません`);
                return 0;
            }

            // 既読記事リストを取得
            const readArticles = await this.kvManager.getReadArticles(feed.id);

            // 新着記事をフィルタ（古い順にソート）
            const newArticles = articles
                .filter(article => !readArticles.includes(this.getArticleHash(article)))
                .sort((a, b) => a.pubDate.getTime() - b.pubDate.getTime());

            if (newArticles.length === 0) {
                console.log(`📰 ${feed.id}: 新着記事なし`);

                // 最終チェック時刻を更新
                await this.kvManager.updateLastChecked(feed.id);
                return 0;
            }

            console.log(`📰 ${feed.id}: ${newArticles.length}件の新着記事を発見`);

            // Discord に投稿
            let postedCount = 0;
            for (const article of newArticles) {
                const success = await this.postArticleToDiscord(article, feed);
                if (success) {
                    postedCount++;
                    // 既読リストに追加
                    await this.kvManager.addReadArticle(feed.id, this.getArticleHash(article));

                    // Discord API レート制限対策
                    await this.sleep(1000);
                }
            }

            // 最終チェック時刻を更新
            await this.kvManager.updateLastChecked(feed.id);

            console.log(`✅ ${feed.id}: ${postedCount}件投稿完了`);
            return postedCount;

        } catch (error) {
            console.error(`❌ ${feed.id} のチェックに失敗:`, error);
            throw error;
        }
    }

    /**
     * 記事をDiscordに投稿
     */
    private async postArticleToDiscord(article: Article, feed: any): Promise<boolean> {
        try {
            const embed = createArticleEmbed(article, feed.customName || feed.title);

            const success = await sendWebhookMessage(this.env.DISCORD_WEBHOOK_URL, {
                embeds: [embed]
            });

            if (success) {
                console.log(`📤 投稿成功: ${article.title}`);
            } else {
                console.error(`📤 投稿失敗: ${article.title}`);
            }

            return success;

        } catch (error) {
            console.error(`📤 投稿エラー: ${article.title}`, error);
            return false;
        }
    }

    /**
     * 記事のユニークハッシュを生成
     */
    private getArticleHash(article: Article): string {
        // GUID/ID がある場合はそれを使用、なければタイトル+リンクのハッシュ
        const uniqueString = article.guid || (article.title + article.link);
        return this.hashString(uniqueString);
    }

    /**
     * 文字列のハッシュを生成
     */
    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit整数に変換
        }
        return hash.toString();
    }

    /**
     * 待機（sleep）
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 特定フィードのテスト実行（/rss test用）
     */
    async testFeed(url: string): Promise<{
        success: boolean;
        title?: string;
        articlesCount?: number;
        articles?: Article[];
        error?: string;
    }> {
        try {
            console.log(`🧪 フィードテスト開始: ${url}`);

            const articles = await parseArticles(url, 5);

            if (articles.length === 0) {
                return {
                    success: false,
                    error: 'フィードから記事を取得できませんでした'
                };
            }

            // フィードタイトルを取得（最初の記事から推測）
            const title = articles[0] ? 'Test Feed' : 'Unknown Feed';

            console.log(`🧪 テスト成功: ${articles.length}件の記事を取得`);

            return {
                success: true,
                title,
                articlesCount: articles.length,
                articles: articles.slice(0, 3) // 最新3件を返す
            };

        } catch (error) {
            console.error(`🧪 フィードテストに失敗: ${url}`, error);

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
