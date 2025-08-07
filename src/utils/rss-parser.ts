// src/utils/rss-parser.ts
// RSS/Atom フィードの解析（Phase 1: 基本版）

/**
 * Phase 1: フィード情報の基本取得
 * Phase 2: 完全なRSS/Atomパーサーを実装予定
 */

export interface FeedInfo {
    title: string;
    description?: string;
    itemCount: number;
}

/**
 * フィードの基本情報を取得（Phase 1版）
 * Phase 2でより詳細な解析機能を実装
 */
export async function parseFeedInfo(url: string): Promise<FeedInfo | null> {
    try {
        console.log(`Fetching feed: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'RSS-Discord-Bot/1.0',
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
            },
            // タイムアウト設定
            signal: AbortSignal.timeout(10000) // 10秒
        });

        if (!response.ok) {
            console.error(`HTTP error: ${response.status} ${response.statusText}`);
            throw new Error('FETCH_FAILED');
        }

        const contentType = response.headers.get('content-type');
        console.log(`Content-Type: ${contentType}`);

        const xmlText = await response.text();

        if (!xmlText.trim()) {
            console.error('Empty response body');
            throw new Error('FETCH_FAILED');
        }

        // 基本的なXMLチェック
        if (!xmlText.includes('<') || !xmlText.includes('>')) {
            console.error('Invalid XML format');
            throw new Error('INVALID_URL');
        }

        // Phase 1: 簡易解析
        const feedInfo = parseBasicFeedInfo(xmlText);

        if (!feedInfo) {
            console.error('Failed to parse feed info');
            throw new Error('INVALID_URL');
        }

        console.log(`Feed parsed successfully: ${feedInfo.title} (${feedInfo.itemCount} items)`);
        return feedInfo;

    } catch (error) {
        console.error(`Feed parsing failed for ${url}:`, error);

        if (error instanceof Error) {
            // 既知のエラーはそのまま投げる
            if (['FETCH_FAILED', 'INVALID_URL'].includes(error.message)) {
                throw error;
            }
        }

        // 未知のエラーはFETCH_FAILEDとして扱う
        throw new Error('FETCH_FAILED');
    }
}

/**
 * XMLからフィードの基本情報を抽出（Phase 1版）
 * Phase 2でより高度な解析機能を実装
 */
function parseBasicFeedInfo(xmlText: string): FeedInfo | null {
    try {
        // RSS 2.0 の検出
        if (xmlText.includes('<rss') || xmlText.includes('<channel>')) {
            return parseRSSBasic(xmlText);
        }

        // Atom の検出
        if (xmlText.includes('<feed') || xmlText.includes('xmlns="http://www.w3.org/2005/Atom"')) {
            return parseAtomBasic(xmlText);
        }

        // RSS 1.0 の検出
        if (xmlText.includes('xmlns="http://purl.org/rss/1.0/"')) {
            return parseRSS10Basic(xmlText);
        }

        console.error('Unknown feed format');
        return null;

    } catch (error) {
        console.error('Basic feed parsing failed:', error);
        return null;
    }
}

/**
 * RSS 2.0 の基本解析
 */
function parseRSSBasic(xmlText: string): FeedInfo | null {
    try {
        // channelタイトルを抽出
        const titleMatch = xmlText.match(/<channel>[\s\S]*?<title[^>]*>(.*?)<\/title>/i);
        const title = titleMatch ? cleanText(titleMatch[1]) : 'Unknown RSS Feed';

        // 説明を抽出
        const descMatch = xmlText.match(/<channel>[\s\S]*?<description[^>]*>(.*?)<\/description>/i);
        const description = descMatch ? cleanText(descMatch[1]) : undefined;

        // アイテム数をカウント
        const itemMatches = xmlText.match(/<item[^>]*>/gi);
        const itemCount = itemMatches ? itemMatches.length : 0;

        return {
            title,
            description,
            itemCount
        };
    } catch (error) {
        console.error('RSS parsing failed:', error);
        return null;
    }
}

/**
 * Atom の基本解析
 */
function parseAtomBasic(xmlText: string): FeedInfo | null {
    try {
        // フィードタイトルを抽出
        const titleMatch = xmlText.match(/<title[^>]*>(.*?)<\/title>/i);
        const title = titleMatch ? cleanText(titleMatch[1]) : 'Unknown Atom Feed';

        // 説明を抽出
        const subtitleMatch = xmlText.match(/<subtitle[^>]*>(.*?)<\/subtitle>/i);
        const description = subtitleMatch ? cleanText(subtitleMatch[1]) : undefined;

        // エントリ数をカウント
        const entryMatches = xmlText.match(/<entry[^>]*>/gi);
        const itemCount = entryMatches ? entryMatches.length : 0;

        return {
            title,
            description,
            itemCount
        };
    } catch (error) {
        console.error('Atom parsing failed:', error);
        return null;
    }
}

/**
 * RSS 1.0 の基本解析
 */
function parseRSS10Basic(xmlText: string): FeedInfo | null {
    try {
        // channelタイトルを抽出
        const titleMatch = xmlText.match(/<channel[^>]*>[\s\S]*?<title[^>]*>(.*?)<\/title>/i);
        const title = titleMatch ? cleanText(titleMatch[1]) : 'Unknown RSS 1.0 Feed';

        // 説明を抽出
        const descMatch = xmlText.match(/<channel[^>]*>[\s\S]*?<description[^>]*>(.*?)<\/description>/i);
        const description = descMatch ? cleanText(descMatch[1]) : undefined;

        // アイテム数をカウント
        const itemMatches = xmlText.match(/<item[^>]*>/gi);
        const itemCount = itemMatches ? itemMatches.length : 0;

        return {
            title,
            description,
            itemCount
        };
    } catch (error) {
        console.error('RSS 1.0 parsing failed:', error);
        return null;
    }
}

/**
 * HTMLタグを除去し、エンティティをデコードする
 */
function cleanText(text: string): string {
    return text
        .replace(/<[^>]*>/g, '') // HTMLタグを除去
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ') // 連続する空白を1つに
        .trim();
}
