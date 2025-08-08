// src/commands/add.ts
// /add コマンドの処理

import { APIInteractionResponse } from 'discord-api-types/v10';
import { Env, InteractionRequest, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../types';
import { KVStorageManager } from '../utils/kv-storage';
import { createSuccessResponse, createErrorResponse } from '../utils/discord';
import { parseFeedInfo } from '../utils/rss-parser';

/**
 * /add コマンドの処理
 * フィードを追加する
 */
export async function handleAddCommand(interaction: InteractionRequest, env: Env): Promise<APIInteractionResponse> {
    const options = interaction.data?.options;

    if (!options || options.length === 0) {
        return createErrorResponse('URLが指定されていません。');
    }

    // パラメータの取得
    const urlOption = options.find(opt => opt.name === 'url');
    const nameOption = options.find(opt => opt.name === 'name');

    if (!urlOption || typeof urlOption.value !== 'string') {
        return createErrorResponse('有効なURLを指定してください。');
    }

    const feedUrl = urlOption.value.trim();
    const customName = nameOption && typeof nameOption.value === 'string'
        ? nameOption.value.trim()
        : undefined;

    console.log(`Adding feed: ${feedUrl}${customName ? ` (Custom name: ${customName})` : ''}`);
    console.log('All options received:', JSON.stringify(options, null, 2));
    console.log('Parsed options:', {
        urlOption: urlOption ? { name: urlOption.name, value: urlOption.value } : null,
        nameOption: nameOption ? { name: nameOption.name, value: nameOption.value } : null,
        customName
    });

    try {
        // URLの基本的なバリデーション
        if (!isValidUrl(feedUrl)) {
            return createErrorResponse('有効なURLを指定してください。');
        }

        // フィード情報の取得と検証
        const feedInfo = await parseFeedInfo(feedUrl);
        if (!feedInfo) {
            return createErrorResponse(ERROR_MESSAGES.INVALID_URL);
        }

        // KVストレージに保存
        const kvManager = new KVStorageManager(env);
        const addedFeed = await kvManager.addFeed(feedUrl, feedInfo.title, customName);

        console.log(`Feed added successfully: ${addedFeed.id}`);

        // 成功レスポンス
        const message = customName
            ? `${SUCCESS_MESSAGES.FEED_ADDED}\n\n**ID**: ${addedFeed.id}\n**名前**: ${customName}\n**サイト**: ${feedInfo.title}\n**URL**: ${feedUrl}`
            : `${SUCCESS_MESSAGES.FEED_ADDED}\n\n**ID**: ${addedFeed.id}\n**サイト**: ${feedInfo.title}\n**URL**: ${feedUrl}`;

        return createSuccessResponse(message, false); // 公開メッセージ

    } catch (error) {
        console.error('Add command failed:', error);

        // エラーの種類に応じたレスポンス
        if (error instanceof Error) {
            if (error.message === 'FEED_EXISTS') {
                return createErrorResponse(ERROR_MESSAGES.FEED_EXISTS);
            }
            if (error.message === 'FETCH_FAILED') {
                return createErrorResponse(ERROR_MESSAGES.FETCH_FAILED);
            }
        }

        return createErrorResponse(ERROR_MESSAGES.INTERNAL_ERROR);
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

/**
 * フィード情報の基本構造
 */
interface FeedParseResult {
    title: string;
    description?: string;
    itemCount: number;
}

// Phase 1では簡易実装、Phase 2で本格的なRSSパーサーを実装
export { FeedParseResult };
