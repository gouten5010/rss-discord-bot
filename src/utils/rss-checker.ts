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
            // より多くの記事を取得（過去記事の見落とし防止）
            const articles = await parseArticles(feed.url, 20);

            if (articles.length === 0) {
                console.log(`📰 ${feed.id}: 記事が見つかりません`);
                await this.kvManager.updateLastChecked(feed.id);
                return 0;
            }

            // 前回の最終pubDateを取得（初回は1970年1月1日）
            const lastPubDate = feed.lastPubDate ? new Date(feed.lastPubDate) : new Date(0);
            console.log(`📅 ${feed.id}: 前回最終日時 ${lastPubDate.toISOString()}`);

            // 前回より新しい記事のみフィルタ
            const newArticles = articles
                .filter(article => {
                    const isNew = article.pubDate > lastPubDate;
                    console.log(`📄 記事チェック: "${article.title}" - ${article.pubDate.toISOString()} - 新着: ${isNew}`);
                    return isNew;
                })
                .sort((a, b) => a.pubDate.getTime() - b.pubDate.getTime()); // 古い順で投稿

            if (newArticles.length === 0) {
                console.log(`📰 ${feed.id}: 新着記事なし`);
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
                    // Discord API レート制限対策
                    await this.sleep(1000);
                }
            }

            // 最新のpubDateを保存（全記事の中で最も新しい日時）
            const latestPubDate = Math.max(...articles.map(a => a.pubDate.getTime()));
            const latestPubDateISO = new Date(latestPubDate).toISOString();
            await this.kvManager.updateLastPubDate(feed.id, latestPubDateISO);

            // 最終チェック時刻を更新
            await this.kvManager.updateLastChecked(feed.id);

            console.log(`✅ ${feed.id}: ${postedCount}件投稿完了, 最新日時: ${latestPubDateISO}`);
            return postedCount;

        } catch (error) {
            console.error(`❌ ${feed.id} のチェックに失敗:`, error);
            throw error;
        }
    }

    /**
     * 記事をDiscordに投稿（通常テキスト形式）
     */
    private async postArticleToDiscord(article: Article, feed: any): Promise<boolean> {
        try {
            // 日時フォーマット
            const pubDate = new Date(article.pubDate);
            const dateStr = pubDate.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // 通常テキスト形式のメッセージ（サイトタイトル強調なし）
            const message = `${feed.customName || feed.title}\n${article.title}\n${dateStr}\n${article.link}`;

            const success = await sendWebhookMessage(this.env.DISCORD_WEBHOOK_URL, {
                content: message,
                // embedsを削除
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
     * 軽量版RSS新着チェック（/rss run用、2秒以内で完了）
     */
    async quickCheck(): Promise<{ newArticles: number; checkedFeeds: number }> {
        console.log('🔄 軽量RSS新着チェック開始...');

        try {
            const feeds = await this.kvManager.getFeeds();
            const activeFeeds = feeds.filter(feed => feed.status === 'active').slice(0, 1);

            if (activeFeeds.length === 0) {
                console.log('ℹ️ チェック対象のフィードがありません');
                return { newArticles: 0, checkedFeeds: 0 };
            }

            let newArticles = 0;

            for (const feed of activeFeeds) {
                try {
                    const articles = await parseArticles(feed.url, 10);

                    if (articles.length === 0) continue;

                    const lastPubDate = feed.lastPubDate ? new Date(feed.lastPubDate) : new Date(0);
                    console.log(`📅 ${feed.id}: クイックチェック - 前回最終日時 ${lastPubDate.toISOString()}`);

                    const newOnes = articles.filter(article => {
                        const isNew = article.pubDate > lastPubDate;
                        console.log(`📄 記事: "${article.title}" - ${article.pubDate.toISOString()} - 新着: ${isNew}`);
                        return isNew;
                    });

                    console.log(`📰 ${feed.id}: ${articles.length}件中 ${newOnes.length}件が新着`);

                    for (const article of newOnes) {
                        const success = await this.postArticleToDiscord(article, feed);
                        if (success) {
                            newArticles++;
                        }
                    }

                    // 最新のpubDateを保存
                    if (articles.length > 0) {
                        const latestPubDate = Math.max(...articles.map(a => a.pubDate.getTime()));
                        await this.kvManager.updateLastPubDate(feed.id, new Date(latestPubDate).toISOString());
                    }

                    await this.kvManager.updateLastChecked(feed.id);

                } catch (error) {
                    console.error(`❌ フィード ${feed.id} のクイックチェックに失敗:`, error);
                }
            }

            console.log(`✅ 軽量RSS新着チェック完了 - 新着: ${newArticles}件`);
            return { newArticles, checkedFeeds: activeFeeds.length };

        } catch (error) {
            console.error('❌ 軽量RSS新着チェックでエラー:', error);
            throw error;
        }
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
