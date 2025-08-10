// src/utils/kv-storage.ts
// KVストレージの管理機能

import { Env, FeedInfo, FeedsMetadata, KV_KEYS } from '../types';

/**
 * KVストレージ管理クラス
 */
export class KVStorageManager {
    private kv: KVNamespace;

    constructor(env: Env) {
        this.kv = env.RSS_STORAGE;
    }

    /**
     * 新しいフィードIDを生成
     */
    private async generateFeedId(): Promise<string> {
        const counter = await this.kv.get(KV_KEYS.FEEDS_COUNTER);
        const nextId = counter ? parseInt(counter, 10) + 1 : 1;

        await this.kv.put(KV_KEYS.FEEDS_COUNTER, nextId.toString());

        return `feed-${String(nextId).padStart(3, '0')}`;
    }

    /**
     * フィードメタデータを取得
     */
    async getFeedsMetadata(): Promise<FeedsMetadata> {
        try {
            const data = await this.kv.get(KV_KEYS.FEEDS_METADATA);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Failed to get feeds metadata:', error);
            return {};
        }
    }

    /**
     * フィードメタデータを保存
     */
    async saveFeedsMetadata(metadata: FeedsMetadata): Promise<void> {
        try {
            await this.kv.put(KV_KEYS.FEEDS_METADATA, JSON.stringify(metadata));
        } catch (error) {
            console.error('Failed to save feeds metadata:', error);
            throw error;
        }
    }

    /**
     * フィードを追加
     */
    async addFeed(url: string, title: string, customName?: string): Promise<FeedInfo> {
        // 既存フィードの重複チェック
        const existingFeed = await this.findFeedByUrl(url);
        if (existingFeed) {
            throw new Error('FEED_EXISTS');
        }

        const feedId = await this.generateFeedId();
        const feedInfo: FeedInfo = {
            id: feedId,
            url,
            title,
            customName,
            status: 'active',
            addedAt: new Date().toISOString(),
        };

        const metadata = await this.getFeedsMetadata();
        metadata[feedId] = feedInfo;
        await this.saveFeedsMetadata(metadata);

        console.log(`Feed added: ${feedId} (${url})`);
        return feedInfo;
    }

    /**
     * フィードを削除
     */
    async removeFeed(identifier: string): Promise<boolean> {
        const metadata = await this.getFeedsMetadata();
        let feedToRemove: FeedInfo | null = null;
        let feedIdToRemove: string | null = null;

        // IDまたはURLで検索
        for (const [feedId, feedInfo] of Object.entries(metadata)) {
            if (feedId === identifier || feedInfo.url === identifier || feedInfo.customName === identifier) {
                feedToRemove = feedInfo;
                feedIdToRemove = feedId;
                break;
            }
        }

        if (!feedToRemove || !feedIdToRemove) {
            return false;
        }

        // フィード情報を削除
        delete metadata[feedIdToRemove];
        await this.saveFeedsMetadata(metadata);

        // 既読記事リストも削除
        await this.clearReadArticles(feedIdToRemove);

        console.log(`Feed removed: ${feedIdToRemove} (${feedToRemove.url})`);
        return true;
    }

    /**
     * すべてのフィードを削除
     */
    async removeAllFeeds(): Promise<number> {
        const metadata = await this.getFeedsMetadata();
        const feedCount = Object.keys(metadata).length;

        if (feedCount === 0) {
            return 0;
        }

        // すべてのフィードの既読記事リストを削除
        for (const feedId of Object.keys(metadata)) {
            await this.clearReadArticles(feedId);
        }

        // メタデータとカウンターをリセット
        await this.kv.put(KV_KEYS.FEEDS_METADATA, JSON.stringify({}));
        await this.kv.put(KV_KEYS.FEEDS_COUNTER, '0');

        console.log(`All feeds removed: ${feedCount} feeds`);
        return feedCount;
    }

    /**
     * フィード一覧を取得
     */
    async getFeeds(): Promise<FeedInfo[]> {
        const metadata = await this.getFeedsMetadata();
        return Object.values(metadata).sort((a, b) => a.id.localeCompare(b.id));
    }

    /**
     * URLでフィードを検索
     */
    async findFeedByUrl(url: string): Promise<FeedInfo | null> {
        const metadata = await this.getFeedsMetadata();

        for (const feedInfo of Object.values(metadata)) {
            if (feedInfo.url === url) {
                return feedInfo;
            }
        }

        return null;
    }

    /**
     * IDまたは名前でフィードを検索
     */
    async findFeedByIdentifier(identifier: string): Promise<FeedInfo | null> {
        const metadata = await this.getFeedsMetadata();

        // まずIDで検索
        if (metadata[identifier]) {
            return metadata[identifier];
        }

        // URLまたはカスタム名で検索
        for (const feedInfo of Object.values(metadata)) {
            if (feedInfo.url === identifier || feedInfo.customName === identifier) {
                return feedInfo;
            }
        }

        return null;
    }

    /**
     * フィードの状態を更新
     */
    async updateFeedStatus(identifier: string, status: 'active' | 'paused'): Promise<boolean> {
        const metadata = await this.getFeedsMetadata();
        let updated = false;

        for (const [feedId, feedInfo] of Object.entries(metadata)) {
            if (feedId === identifier || feedInfo.url === identifier || feedInfo.customName === identifier) {
                metadata[feedId].status = status;
                updated = true;
                break;
            }
        }

        if (updated) {
            await this.saveFeedsMetadata(metadata);
            console.log(`Feed status updated: ${identifier} -> ${status}`);
        }

        return updated;
    }

    /**
     * フィードの最終チェック時刻を更新
     */
    async updateLastChecked(feedId: string): Promise<void> {
        const metadata = await this.getFeedsMetadata();

        if (metadata[feedId]) {
            metadata[feedId].lastChecked = new Date().toISOString();
            await this.saveFeedsMetadata(metadata);
        }
    }

    async updateLastPubDate(feedId: string, pubDate: string): Promise<void> {
        const metadata = await this.getFeedsMetadata();
        if (metadata[feedId]) {
            metadata[feedId].lastPubDate = pubDate;
            await this.saveFeedsMetadata(metadata);
            console.log(`Last pubDate updated for ${feedId}: ${pubDate}`);
        }
    }

    /**
     * 既読記事リストを取得
     */
    async getReadArticles(feedId: string): Promise<string[]> {
        try {
            const key = `${KV_KEYS.READ_ARTICLES_PREFIX}${feedId}`;
            const data = await this.kv.get(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error(`Failed to get read articles for ${feedId}:`, error);
            return [];
        }
    }

    /**
     * 既読記事リストを保存
     */
    async saveReadArticles(feedId: string, articleHashes: string[]): Promise<void> {
        try {
            const key = `${KV_KEYS.READ_ARTICLES_PREFIX}${feedId}`;
            // 最新1000件まで保持
            const limitedHashes = articleHashes.slice(-1000);
            await this.kv.put(key, JSON.stringify(limitedHashes));
        } catch (error) {
            console.error(`Failed to save read articles for ${feedId}:`, error);
        }
    }

    /**
     * 既読記事リストをクリア
     */
    async clearReadArticles(feedId: string): Promise<void> {
        try {
            const key = `${KV_KEYS.READ_ARTICLES_PREFIX}${feedId}`;
            await this.kv.delete(key);
        } catch (error) {
            console.error(`Failed to clear read articles for ${feedId}:`, error);
        }
    }

    /**
     * 既読記事を追加
     */
    async addReadArticle(feedId: string, articleHash: string): Promise<void> {
        const readArticles = await this.getReadArticles(feedId);

        if (!readArticles.includes(articleHash)) {
            readArticles.push(articleHash);
            await this.saveReadArticles(feedId, readArticles);
        }
    }

    /**
     * KVストレージの統計情報を取得
     */
    async getStorageStats(): Promise<{
        totalFeeds: number;
        activeFeeds: number;
        pausedFeeds: number;
        lastUpdated: string;
    }> {
        const feeds = await this.getFeeds();

        return {
            totalFeeds: feeds.length,
            activeFeeds: feeds.filter(f => f.status === 'active').length,
            pausedFeeds: feeds.filter(f => f.status === 'paused').length,
            lastUpdated: new Date().toISOString(),
        };
    }
}
