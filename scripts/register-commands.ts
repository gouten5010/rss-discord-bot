// scripts/register-commands.ts
// Discordスラッシュコマンドを登録するスクリプト

import { config } from 'dotenv';
import { ApplicationCommandOptionType } from 'discord-api-types/v10';

// 環境変数を読み込み
config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;

if (!DISCORD_BOT_TOKEN || !DISCORD_APPLICATION_ID) {
    console.error('❌ Environment variables DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID are required');
    process.exit(1);
}

// Phase 1で実装するコマンド定義
const commands = [
    {
        name: 'add',
        description: 'RSSフィードを追加します',
        options: [
            {
                name: 'url',
                description: 'RSS/AtomフィードのURL',
                type: ApplicationCommandOptionType.String,
                required: true,
            },
            {
                name: 'name',
                description: 'フィードのカスタム名（省略可）',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
        ],
        default_member_permissions: '32', // MANAGE_GUILD permission
    },
    {
        name: 'remove',
        description: 'RSSフィードを削除します',
        options: [
            {
                name: 'identifier',
                description: 'フィードID、URL、または名前',
                type: ApplicationCommandOptionType.String,
                required: true,
            },
        ],
        default_member_permissions: '32', // MANAGE_GUILD permission
    },
    {
        name: 'removeall',
        description: 'すべてのRSSフィードを削除します',
        default_member_permissions: '32', // MANAGE_GUILD permission
    },
    {
        name: 'list',
        description: '登録されているRSSフィード一覧を表示します',
        default_member_permissions: '32', // MANAGE_GUILD permission
    },
    // Phase 2, 3で実装予定のコマンド（コメントアウト）
    /*
    {
      name: 'test',
      description: 'RSSフィードのテスト取得を行います',
      options: [
        {
          name: 'url',
          description: 'テストするRSS/AtomフィードのURL',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
      default_member_permissions: '32',
    },
    {
      name: 'run',
      description: 'RSS新着チェックを即座に実行します',
      default_member_permissions: '32',
    },
    {
      name: 'pause',
      description: 'RSSフィードを一時停止します',
      options: [
        {
          name: 'identifier',
          description: 'フィードID、URL、または名前',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
      default_member_permissions: '32',
    },
    {
      name: 'restart',
      description: 'RSSフィードを再開します',
      options: [
        {
          name: 'identifier',
          description: 'フィードID、URL、または名前',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
      default_member_permissions: '32',
    },
    */
];

/**
 * Discord APIにコマンドを登録
 */
async function registerCommands() {
    const url = `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`;

    try {
        console.log('🔄 Registering Discord slash commands...');

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            },
            body: JSON.stringify(commands),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Discord API error: ${response.status} ${response.statusText}\n${errorText}`);
        }

        const result = await response.json() as Array<{
            name: string;
            description: string;
            id: string;
        }>;
        console.log(`✅ Successfully registered ${result.length} commands:`);

        result.forEach((command) => {
            console.log(`   - /${command.name}: ${command.description}`);
        });

        console.log('\n📋 Commands registered successfully!');
        console.log('You can now use these commands in your Discord server.');

    } catch (error) {
        console.error('❌ Failed to register commands:', error);
        process.exit(1);
    }
}

/**
 * 既存のコマンドを取得（デバッグ用）
 */
async function getExistingCommands() {
    const url = `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
        }

        const commands = await response.json() as Array<{
            name: string;
            description: string;
            id: string;
        }>;
        console.log('📋 Existing commands:');
        commands.forEach((command) => {
            console.log(`   - /${command.name}: ${command.description}`);
        });

        return commands;
    } catch (error) {
        console.error('❌ Failed to get existing commands:', error);
        return [];
    }
}

/**
 * コマンドをすべて削除（クリーンアップ用）
 */
async function clearCommands() {
    const url = `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`;

    try {
        console.log('🗑️ Clearing all Discord slash commands...');

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            },
            body: JSON.stringify([]), // 空配列でコマンドをクリア
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Discord API error: ${response.status} ${response.statusText}\n${errorText}`);
        }

        console.log('✅ All commands cleared successfully!');
    } catch (error) {
        console.error('❌ Failed to clear commands:', error);
        process.exit(1);
    }
}

// メイン処理
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log('🤖 Discord Bot Command Manager\n');

    switch (command) {
        case 'list':
            await getExistingCommands();
            break;
        case 'clear':
            await clearCommands();
            break;
        case 'register':
        default:
            await registerCommands();
            break;
    }
}

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
}

export { registerCommands, getExistingCommands, clearCommands };
