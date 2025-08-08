// src/utils/rss-parser.ts
// RSS/Atom フィードの解析（Phase 2: 完全版）

export interface FeedInfo {
    title: string;
    description?: string;
    itemCount: number;
}

export interface Article {
    title: string;
    link: string;
    pubDate: Date;
    description: string;
    content?: string;
    guid?: string;
}

/**
 * フィードの基本情報を取得
 */
export async function parseFeedInfo(url: string): Promise<FeedInfo | null> {
    try {
        console.log(`Fetching feed: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'RSS-Discord-Bot/2.0',
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
            },
            signal: AbortSignal.timeout(10000)
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

        if (!xmlText.includes('<') || !xmlText.includes('>')) {
            console.error('Invalid XML format');
            throw new Error('INVALID_URL');
        }

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
            if (['FETCH_FAILED', 'INVALID_URL'].includes(error.message)) {
                throw error;
            }
        }

        throw new Error('FETCH_FAILED');
    }
}

/**
 * フィードから記事一覧を取得（Phase 2: 新着記事検出用）
 */
export async function parseArticles(url: string, maxArticles: number = 5): Promise<Article[]> {
    try {
        console.log(`Fetching articles from: ${url} (max: ${maxArticles})`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'RSS-Discord-Bot/2.0',
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
            },
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const xmlText = await response.text();
        const articles = parseArticlesFromXML(xmlText);

        // 新しい順にソートして指定数まで取得
        const sortedArticles = articles
            .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
            .slice(0, maxArticles);

        console.log(`Parsed ${sortedArticles.length} articles from ${url}`);
        return sortedArticles;

    } catch (error) {
        console.error(`Failed to parse articles from ${url}:`, error);
        return [];
    }
}

/**
 * XMLから記事一覧を抽出
 */
function parseArticlesFromXML(xmlText: string): Article[] {
    const articles: Article[] = [];

    try {
        // RSS 2.0 の検出
        if (xmlText.includes('<rss') || xmlText.includes('<channel>')) {
            return parseRSSArticles(xmlText);
        }

        // Atom の検出
        if (xmlText.includes('<feed') || xmlText.includes('xmlns="http://www.w3.org/2005/Atom"')) {
            return parseAtomArticles(xmlText);
        }

        // RSS 1.0 の検出
        if (xmlText.includes('xmlns="http://purl.org/rss/1.0/"')) {
            return parseRSS10Articles(xmlText);
        }

        console.log('Unknown feed format, attempting RSS fallback');
        return parseRSSArticles(xmlText);

    } catch (error) {
        console.error('Failed to parse articles from XML:', error);
        return [];
    }
}

/**
 * RSS 2.0 記事解析
 */
function parseRSSArticles(xmlText: string): Article[] {
    const articles: Article[] = [];
    const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi);

    if (!itemMatches) return articles;

    for (const itemXml of itemMatches) {
        try {
            const title = extractXMLContent(itemXml, 'title');
            const link = extractXMLContent(itemXml, 'link');
            const pubDateStr = extractXMLContent(itemXml, 'pubDate');
            const description = extractXMLContent(itemXml, 'description');
            const content = extractXMLContent(itemXml, 'content:encoded') ||
                extractXMLContent(itemXml, 'content');
            const guid = extractXMLContent(itemXml, 'guid');

            if (!title || !link) continue;

            articles.push({
                title: cleanText(title),
                link: link.trim(),
                pubDate: pubDateStr ? new Date(pubDateStr) : new Date(),
                description: cleanText(description || ''),
                content: content ? cleanText(content) : undefined,
                guid: guid || link
            });
        } catch (error) {
            console.error('Failed to parse RSS item:', error);
        }
    }

    return articles;
}

/**
 * Atom記事解析
 */
function parseAtomArticles(xmlText: string): Article[] {
    const articles: Article[] = [];
    const entryMatches = xmlText.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi);

    if (!entryMatches) return articles;

    for (const entryXml of entryMatches) {
        try {
            const title = extractXMLContent(entryXml, 'title');
            let link = extractXMLContent(entryXml, 'link');

            // Atom の link は href 属性を持つ場合がある
            if (!link) {
                const linkMatch = entryXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
                link = linkMatch ? linkMatch[1] : '';
            }

            const publishedStr = extractXMLContent(entryXml, 'published') ||
                extractXMLContent(entryXml, 'updated');
            const summary = extractXMLContent(entryXml, 'summary');
            const content = extractXMLContent(entryXml, 'content');
            const id = extractXMLContent(entryXml, 'id');

            if (!title || !link) continue;

            articles.push({
                title: cleanText(title),
                link: link.trim(),
                pubDate: publishedStr ? new Date(publishedStr) : new Date(),
                description: cleanText(summary || content || ''),
                content: content ? cleanText(content) : undefined,
                guid: id || link
            });
        } catch (error) {
            console.error('Failed to parse Atom entry:', error);
        }
    }

    return articles;
}

/**
 * RSS 1.0記事解析
 */
function parseRSS10Articles(xmlText: string): Article[] {
    // RSS 1.0は基本的にRSS 2.0と同じ構造
    return parseRSSArticles(xmlText);
}

/**
 * XMLからフィードの基本情報を抽出
 */
function parseBasicFeedInfo(xmlText: string): FeedInfo | null {
    try {
        if (xmlText.includes('<rss') || xmlText.includes('<channel>')) {
            return parseRSSBasic(xmlText);
        }

        if (xmlText.includes('<feed') || xmlText.includes('xmlns="http://www.w3.org/2005/Atom"')) {
            return parseAtomBasic(xmlText);
        }

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

function parseRSSBasic(xmlText: string): FeedInfo | null {
    try {
        const titleMatch = xmlText.match(/<channel>[\s\S]*?<title[^>]*>(.*?)<\/title>/i);
        const title = titleMatch ? cleanText(titleMatch[1]) : 'Unknown RSS Feed';

        const descMatch = xmlText.match(/<channel>[\s\S]*?<description[^>]*>(.*?)<\/description>/i);
        const description = descMatch ? cleanText(descMatch[1]) : undefined;

        const itemMatches = xmlText.match(/<item[^>]*>/gi);
        const itemCount = itemMatches ? itemMatches.length : 0;

        return { title, description, itemCount };
    } catch (error) {
        console.error('RSS parsing failed:', error);
        return null;
    }
}

function parseAtomBasic(xmlText: string): FeedInfo | null {
    try {
        const titleMatch = xmlText.match(/<title[^>]*>(.*?)<\/title>/i);
        const title = titleMatch ? cleanText(titleMatch[1]) : 'Unknown Atom Feed';

        const subtitleMatch = xmlText.match(/<subtitle[^>]*>(.*?)<\/subtitle>/i);
        const description = subtitleMatch ? cleanText(subtitleMatch[1]) : undefined;

        const entryMatches = xmlText.match(/<entry[^>]*>/gi);
        const itemCount = entryMatches ? entryMatches.length : 0;

        return { title, description, itemCount };
    } catch (error) {
        console.error('Atom parsing failed:', error);
        return null;
    }
}

function parseRSS10Basic(xmlText: string): FeedInfo | null {
    try {
        const titleMatch = xmlText.match(/<channel[^>]*>[\s\S]*?<title[^>]*>(.*?)<\/title>/i);
        const title = titleMatch ? cleanText(titleMatch[1]) : 'Unknown RSS 1.0 Feed';

        const descMatch = xmlText.match(/<channel[^>]*>[\s\S]*?<description[^>]*>(.*?)<\/description>/i);
        const description = descMatch ? cleanText(descMatch[1]) : undefined;

        const itemMatches = xmlText.match(/<item[^>]*>/gi);
        const itemCount = itemMatches ? itemMatches.length : 0;

        return { title, description, itemCount };
    } catch (error) {
        console.error('RSS 1.0 parsing failed:', error);
        return null;
    }
}

function extractXMLContent(xml: string, tagName: string): string {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
}

/**
 * HTMLタグを除去し、エンティティをデコードする
 */
function cleanText(text: string): string {
    return text
        .replace(/<[^>]*>/g, '') // HTMLタグを除去
        // 数値文字参照をデコード
        .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#([0-9]+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)))
        // 名前付き文字参照をデコード
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ') // 連続する空白を1つに
        .trim();
}
