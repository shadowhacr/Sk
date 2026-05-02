require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Storage = require('./utils/storage');
const GroqAI = require('./utils/groq');
const FileManager = require('./utils/fileManager');
const fs = require('fs-extra');
const path = require('path');

// ============== CONFIGURATION ==============
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID);
const OWNER_USERNAME = process.env.OWNER_USERNAME || 'Shadow';

// Channel config - 2 Telegram (real verify), 2 dummy (YT, WhatsApp - display only)
const CHANNELS = [
    {
        name: process.env.CHANNEL_1_NAME || 'SHADOW OFFICIAL 👑',
        link: process.env.CHANNEL_1_LINK || 'https://t.me/shadowofficial',
        type: 'telegram',
        username: process.env.TG_CHANNEL_1 || '@shadowofficial'
    },
    {
        name: process.env.CHANNEL_2_NAME || 'Syed official',
        link: process.env.CHANNEL_2_LINK || 'https://t.me/syedofficial',
        type: 'telegram',
        username: process.env.TG_CHANNEL_2 || '@syedofficial'
    },
    {
        name: process.env.CHANNEL_3_NAME || 'HOW TO BE A HACKER',
        link: process.env.CHANNEL_3_LINK || 'https://youtube.com/@howtobeahacker',
        type: 'youtube',
        username: null // No verification for YT
    },
    {
        name: process.env.CHANNEL_4_NAME || 'SHADOW OFFICIAL 👑',
        link: process.env.CHANNEL_4_LINK || 'https://whatsapp.com/channel/shadowofficial',
        type: 'whatsapp',
        username: null // No verification for WhatsApp
    }
];

// ============== BOT INITIALIZATION ==============
const bot = new TelegramBot(BOT_TOKEN, { 
    polling: { 
        interval: 300, 
        autoStart: true,
        params: { timeout: 30 }
    },
    onlyFirstMatch: false
});

// ============== MESSAGE QUEUE FOR PROGRESS UPDATES ==============
const progressMessages = new Map();

// ============== PREMIUM UI DESIGN ==============
const UI = {
    // Icons
    icons: {
        crown: '👑',
        lightning: '⚡',
        fire: '🔥',
        skull: '💀',
        robot: '🤖',
        code: '💻',
        lock: '🔒',
        unlock: '🔓',
        check: '✅',
        cross: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        star: '⭐',
        rocket: '🚀',
        tools: '🛠️',
        brain: '🧠',
        ghost: '👻',
        sword: '⚔️',
        shield: '🛡️',
        chart: '📊',
        user: '👤',
        admin: '🔱',
        channel: '📢',
        verify: '🔄',
        zip: '📦',
        image: '🎨',
        web: '🌐',
        project: '📁',
        loading: '⏳',
        done: '🎯',
        error: '❌',
        owner: '👑',
        question: '❓'
    },

    // Progress bar
    progressBar(percent) {
        const filled = Math.round(percent / 10);
        const empty = 10 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`;
    },

    // Escape markdown
    escape(text) {
        if (!text) return '';
        return text.replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
    },

    // Main menu keyboard
    mainMenu() {
        return {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '💻 Code Writer', callback_data: 'menu_code' },
                        { text: '📁 Project Builder', callback_data: 'menu_project' }
                    ],
                    [
                        { text: '🌐 Web Cloner', callback_data: 'menu_clone' },
                        { text: '🎨 Logo Maker', callback_data: 'menu_image' }
                    ],
                    [
                        { text: '⚡ Quick AI Chat', callback_data: 'menu_chat' },
                        { text: '📊 My Stats', callback_data: 'menu_stats' }
                    ],
                    [
                        { text: '👑 Owner Info', callback_data: 'menu_owner' },
                        { text: '📢 Channels', callback_data: 'menu_channels' }
                    ]
                ]
            }
        };
    },

    // Owner menu keyboard
    ownerMenu() {
        return {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📢 Broadcast', callback_data: 'admin_broadcast' },
                        { text: '👥 User List', callback_data: 'admin_users' }
                    ],
                    [
                        { text: '📊 Statistics', callback_data: 'admin_stats' },
                        { text: '🚫 Block User', callback_data: 'admin_block' }
                    ],
                    [
                        { text: '✅ Unblock User', callback_data: 'admin_unblock' },
                        { text: '🔱 Bot Status', callback_data: 'admin_status' }
                    ],
                    [
                        { text: '⬅️ Back to Main', callback_data: 'menu_main' }
                    ]
                ]
            }
        };
    },

    // Cancel button
    cancelButton() {
        return {
            reply_markup: {
                inline_keyboard: [[
                    { text: '❌ Cancel', callback_data: 'action_cancel' }
                ]]
            }
        };
    }
};

// ============== USER SESSIONS ==============
const sessions = new Map();

function getSession(userId) {
    if (!sessions.has(userId)) {
        sessions.set(userId, { state: 'idle', data: {} });
    }
    return sessions.get(userId);
}

function setSession(userId, state, data = {}) {
    sessions.set(userId, { state, data: { ...getSession(userId).data, ...data } });
}

// ============== VERIFICATION SYSTEM ==============
// Check if user is member of Telegram channel
async function checkChannelMembership(userId, channelUsername) {
    try {
        const chatMember = await bot.getChatMember(channelUsername, userId);
        return ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (error) {
        console.error(`Channel check error for ${channelUsername}:`, error.message);
        // If bot is not admin or channel not found, assume user joined (pass-through)
        return true;
    }
}

// Get verification status for all channels
async function getVerificationStatus(userId) {
    const status = [];
    
    for (const channel of CHANNELS) {
        let joined = false;
        
        if (channel.type === 'telegram' && channel.username) {
            // Actually verify Telegram channels
            joined = await checkChannelMembership(userId, channel.username);
        } else {
            // YouTube and WhatsApp - always show as pending initially
            // They will be "verified" when user clicks the verify button
            joined = false;
        }
        
        status.push({ ...channel, joined });
    }
    
    return status;
}

// Check if user passed verification (only Telegram channels matter)
function isVerified(status) {
    // Only check Telegram channels for actual verification
    const telegramChannels = status.filter(ch => ch.type === 'telegram');
    if (telegramChannels.length === 0) return true; // No channels to verify
    return telegramChannels.every(ch => ch.joined);
}

// Send verification message
async function sendVerificationMessage(chatId, userId) {
    const status = await getVerificationStatus(userId);
    
    let text = `${UI.icons.lock} *CHANNEL VERIFICATION REQUIRED*\n\n`;
    text += `Welcome to *Shadow Evil AI* ${UI.icons.ghost}\n`;
    text += `Join our channels to unlock the full power.\n\n`;
    
    status.forEach((ch, i) => {
        const icon = ch.joined ? UI.icons.check : UI.icons.cross;
        const typeIcon = ch.type === 'telegram' ? '📱' : ch.type === 'youtube' ? '📺' : '💬';
        text += `${icon} ${typeIcon} ${UI.escape(ch.name)}\n`;
    });
    
    text += `\n_Join ALL channels, then click Verify\._`;
    
    const keyboard = [];
    
    // Channel buttons
    status.forEach(ch => {
        const emoji = ch.type === 'telegram' ? '🔗' : ch.type === 'youtube' ? '▶️' : '📲';
        keyboard.push([{ 
            text: `${emoji} ${ch.name}`, 
            url: ch.link 
        }]);
    });
    
    // Verify button
    keyboard.push([{ 
        text: `${UI.icons.verify} Verify Joined`, 
        callback_data: 'verify_check' 
    }]);
    
    await bot.sendMessage(chatId, text, {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: keyboard }
    });
}

// ============== SEND LONG MESSAGES ==============
async function sendLongMessage(chatId, text, options = {}) {
    const maxLength = 4000;
    
    if (text.length <= maxLength) {
        return await bot.sendMessage(chatId, text, options);
    }
    
    // Split into chunks at code block boundaries if possible
    const chunks = [];
    let current = '';
    
    const lines = text.split('\n');
    for (const line of lines) {
        if (current.length + line.length + 1 > maxLength) {
            chunks.push(current);
            current = line + '\n';
        } else {
            current += line + '\n';
        }
    }
    if (current) chunks.push(current);
    
    const messages = [];
    for (let i = 0; i < chunks.length; i++) {
        const msg = await bot.sendMessage(chatId, chunks[i], {
            ...options,
            parse_mode: options.parse_mode || 'Markdown'
        });
        messages.push(msg);
        await delay(100);
    }
    return messages;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============== PROGRESS TRACKING ==============
async function showProgress(chatId, text, percent) {
    const bar = UI.progressBar(percent);
    const message = `${UI.icons.loading} *${text}*\n\n${UI.escape(bar)}`;
    
    try {
        const existing = progressMessages.get(chatId);
        if (existing) {
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: existing,
                parse_mode: 'MarkdownV2'
            });
        } else {
            const msg = await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
            progressMessages.set(chatId, msg.message_id);
        }
    } catch (e) {
        // If edit fails, send new
        const msg = await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
        progressMessages.set(chatId, msg.message_id);
    }
}

async function clearProgress(chatId) {
    progressMessages.delete(chatId);
}

// ============== WELCOME MESSAGE ==============
async function sendWelcome(chatId, userId, username) {
    const name = username || 'Warrior';
    
    let text = `${UI.icons.crown} *SHADOW EVIL AI* ${UI.icons.crown}\n\n`;
    text += `Welcome, *${UI.escape(name)}* ${UI.icons.lightning}\n\n`;
    text += `${UI.icons.brain} *Your unrestricted AI companion*\n`;
    text += `${UI.icons.code} Coding • ${UI.icons.tools} Hacking • ${UI.icons.rocket} Projects\n`;
    text += `${UI.icons.web} Web Cloning • ${UI.icons.image} Logo Design\n\n`;
    text += `${UI.icons.ghost} *No limits\. No restrictions\. Pure power\.*\n\n`;
    text += `How can I serve you today, *${UI.escape(name)}*?`;
    
    await bot.sendMessage(chatId, text, {
        parse_mode: 'MarkdownV2',
        ...UI.mainMenu()
    });
}

// ============== COMMAND HANDLERS ==============

// /start command
bot.onText(/^\/start/, async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
    
    // Register user
    Storage.registerUser(userId, msg.from);
    
    // Check if already verified
    if (Storage.isUserVerified(userId)) {
        await sendWelcome(chatId, userId, username);
        return;
    }
    
    // Send verification
    await sendVerificationMessage(chatId, userId);
});

// /admin command (owner only)
bot.onText(/^\/admin/, async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    
    if (userId !== OWNER_ID) {
        await bot.sendMessage(chatId, `${UI.icons.error} *Access Denied*\nThis command is for my Owner only.`, { parse_mode: 'Markdown' });
        return;
    }
    
    const stats = Storage.getStats();
    const users = Storage.getAllUsers();
    const verifiedCount = Object.values(users).filter(u => u.verified).length;
    
    let text = `${UI.icons.admin} *OWNER PANEL*\n\n`;
    text += `${UI.icons.user} Total Users: ${Object.keys(users).length}\n`;
    text += `${UI.icons.check} Verified Users: ${verifiedCount}\n`;
    text += `${UI.icons.chart} Total Messages: ${stats.totalMessages}\n`;
    text += `${UI.icons.project} Projects Generated: ${stats.totalProjects}\n`;
    text += `${UI.icons.owner} Owner: ${OWNER_USERNAME}`;
    
    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        ...UI.ownerMenu()
    });
});

// /broadcast command (owner only)
bot.onText(/^\/broadcast\s+(.+)/s, async (msg, match) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    
    if (userId !== OWNER_ID) return;
    
    const message = match[1];
    const users = Storage.getAllUsers();
    const allUserIds = Object.keys(users);
    
    let sent = 0;
    let failed = 0;
    
    const statusMsg = await bot.sendMessage(chatId, `${UI.icons.loading} Broadcasting to ${allUserIds.length} users...`, { parse_mode: 'Markdown' });
    
    for (const uid of allUserIds) {
        try {
            await bot.sendMessage(uid, `${UI.icons.admin} *BROADCAST*\n\n${message}`, { parse_mode: 'Markdown' });
            sent++;
            await delay(50);
        } catch (e) {
            failed++;
        }
    }
    
    await bot.editMessageText(
        `${UI.icons.done} *Broadcast Complete*\n\nSent: ${sent}\nFailed: ${failed}`,
        { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
    );
});

// /users command (owner only)
bot.onText(/^\/users/, async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    
    if (userId !== OWNER_ID) return;
    
    const users = Storage.getAllUsers();
    const userList = Object.values(users);
    
    let text = `${UI.icons.admin} *USER LIST* (${userList.length})\n\n`;
    
    userList.slice(-20).forEach((u, i) => {
        const name = u.username ? `@${u.username}` : u.firstName;
        const status = u.verified ? UI.icons.check : UI.icons.cross;
        text = `${text}${i+1}\. ${status} \`${u.userId}\` \- ${UI.escape(name)}\n`;
    });
    
    await bot.sendMessage(chatId, text, { parse_mode: 'MarkdownV2' });
});

// /stats command (owner only)
bot.onText(/^\/stats/, async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    
    if (userId !== OWNER_ID) return;
    
    const stats = Storage.getStats();
    const users = Storage.getAllUsers();
    const now = Date.now();
    const uptime = now - (stats.startTime || now);
    
    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor((uptime % 86400000) / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    
    let text = `${UI.icons.chart} *BOT STATISTICS*\n\n`;
    text += `${UI.icons.user} Total Users: ${Object.keys(users).length}\n`;
    text += `${UI.icons.check} Verified: ${Object.values(users).filter(u => u.verified).length}\n`;
    text += `${UI.icons.chart} Messages: ${stats.totalMessages || 0}\n`;
    text += `${UI.icons.project} Projects: ${stats.totalProjects || 0}\n`;
    text += `⏱ Uptime: ${days}d ${hours}h ${minutes}m\n`;
    text += `${UI.icons.owner} Owner: ${OWNER_USERNAME}`;
    
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// /clear command
bot.onText(/^\/clear/, async (msg) => {
    const chatId = msg.chat.id;
    sessions.delete(msg.from.id);
    await bot.sendMessage(chatId, `${UI.icons.done} Session cleared\. Start fresh\!`, { parse_mode: 'MarkdownV2' });
});

// ============== CALLBACK QUERY HANDLER ==============
bot.on('callback_query', async (query) => {
    const userId = query.from.id;
    const chatId = query.message.chat.id;
    const data = query.data;
    const messageId = query.message.message_id;
    
    await bot.answerCallbackQuery(query.id);
    
    // Check verification for non-verify callbacks
    if (data !== 'verify_check' && !Storage.isUserVerified(userId)) {
        await bot.sendMessage(chatId, `${UI.icons.warning} Please verify channels first\!`);
        return;
    }
    
    switch (data) {
        // ===== MAIN MENU =====
        case 'menu_main':
            await sendWelcome(chatId, userId, query.from.username);
            break;
            
        case 'menu_code':
            setSession(userId, 'code_writer');
            await bot.editMessageText(
                `${UI.icons.code} *CODE WRITER*\n\nDescribe what code you need\. I'll write complete, working code for you\.\n\nExamples:\n• "Python script to scrape a website"\n• "Node\.js Express API with auth"\n• "React dashboard with charts"\n\nType your request:`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'MarkdownV2', ...UI.cancelButton() }
            );
            break;
            
        case 'menu_project':
            setSession(userId, 'project_ask');
            await bot.editMessageText(
                `${UI.icons.project} *PROJECT BUILDER*\n\nTell me what project you want me to build\. I'll create ALL files, zip them, and send you a complete package\.\n\nExamples:\n• "A Telegram bot with weather API"\n• "E\-commerce website with payment"\n• "Portfolio website with admin panel"\n\nWhat project do you need?`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'MarkdownV2', ...UI.cancelButton() }
            );
            break;
            
        case 'menu_clone':
            setSession(userId, 'clone_ask');
            await bot.editMessageText(
                `${UI.icons.web} *WEBSITE CLONER*\n\nSend me a website URL and I'll recreate it with full frontend \+ backend code\.\n\nFormat: \`https://example\.com\`\n\nOr describe the website you want cloned:`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'MarkdownV2', ...UI.cancelButton() }
            );
            break;
            
        case 'menu_image':
            setSession(userId, 'image_ask');
            await bot.editMessageText(
                `${UI.icons.image} *LOGO & IMAGE MAKER*\n\nDescribe the image or logo you want me to create\.\n\nExamples:\n• "Dark hacker logo with skull and code"\n• "Modern tech company logo, blue theme"\n• "Gaming banner with neon effects"\n\nYour description:`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'MarkdownV2', ...UI.cancelButton() }
            );
            break;
            
        case 'menu_chat':
            setSession(userId, 'chat');
            await bot.editMessageText(
                `${UI.icons.brain} *QUICK AI CHAT*\n\nI'm ready\! Ask me anything \- coding, hacking, education, tech, or just chat\.\n\n_Type your message and I'll respond instantly_\.`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'MarkdownV2', ...UI.cancelButton() }
            );
            break;
            
        case 'menu_stats':
            const user = Storage.getUser(userId);
            const allStats = Storage.getStats();
            let statsText = `${UI.icons.chart} *YOUR STATS*\n\n`;
            statsText += `${UI.icons.user} Name: ${UI.escape(query.from.username || query.from.first_name)}\n`;
            statsText += `${UI.icons.check} Verified: ${user?.verified ? 'Yes' : 'No'}\n`;
            statsText += `${UI.icons.chart} Messages: ${user?.messageCount || 0}\n`;
            statsText += `${UI.icons.project} Projects: ${user?.projectCount || 0}\n`;
            statsText += `📅 Joined: ${user?.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : 'N/A'}`;
            
            await bot.editMessageText(statsText, {
                chat_id: chatId, message_id: messageId,
                parse_mode: 'MarkdownV2',
                reply_markup: { inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'menu_main' }]] }
            });
            break;
            
        case 'menu_owner':
            let ownerText = `${UI.icons.crown} *OWNER INFO*\n\n`;
            ownerText += `${UI.icons.owner} Owner: *${OWNER_USERNAME}*\n`;
            ownerText += `${UI.icons.admin} Title: *The Papa of Shadow Evil AI*\n`;
            ownerText += `${UI.icons.crown} Status: *Supreme Leader*\n\n`;
            ownerText += `${UI.icons.ghost} "Shadow is my Owner\. He is my Papa\."\n`;
            ownerText += `"Papa of the whole world\." ${UI.icons.crown}`;
            
            await bot.editMessageText(ownerText, {
                chat_id: chatId, message_id: messageId,
                parse_mode: 'MarkdownV2',
                reply_markup: { inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'menu_main' }]] }
            });
            break;
            
        case 'menu_channels':
            let chText = `${UI.icons.channel} *OUR CHANNELS*\n\n`;
            CHANNELS.forEach(ch => {
                const emoji = ch.type === 'telegram' ? '📱' : ch.type === 'youtube' ? '📺' : '💬';
                chText += `${emoji} [${UI.escape(ch.name)}](${ch.link})\n`;
            });
            
            await bot.editMessageText(chText, {
                chat_id: chatId, message_id: messageId,
                parse_mode: 'MarkdownV2',
                reply_markup: { inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'menu_main' }]] }
            });
            break;
            
        // ===== VERIFICATION =====
        case 'verify_check':
            const status = await getVerificationStatus(userId);
            
            // Check only Telegram channels
            const tgChannels = status.filter(ch => ch.type === 'telegram');
            const allTgJoined = tgChannels.every(ch => ch.joined);
            
            if (allTgJoined) {
                // Mark all as verified (including dummy YT/WhatsApp)
                Storage.verifyUser(userId);
                
                await bot.deleteMessage(chatId, messageId);
                await bot.sendMessage(chatId, 
                    `${UI.icons.check} *VERIFICATION COMPLETE* ${UI.icons.unlock}\n\n` +
                    `All channels verified\! Welcome to the dark side\.`,
                    { parse_mode: 'MarkdownV2' }
                );
                await sendWelcome(chatId, userId, query.from.username);
            } else {
                // Re-send verification with updated status
                await bot.deleteMessage(chatId, messageId);
                await sendVerificationMessage(chatId, userId);
            }
            break;
            
        // ===== ADMIN PANEL =====
        case 'admin_broadcast':
            if (userId !== OWNER_ID) return;
            setSession(userId, 'admin_broadcast');
            await bot.editMessageText(
                `${UI.icons.admin} *BROADCAST*\n\nSend the message you want to broadcast to ALL users:`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'MarkdownV2', ...UI.cancelButton() }
            );
            break;
            
        case 'admin_users':
            if (userId !== OWNER_ID) return;
            const allUsers = Storage.getAllUsers();
            const usersList = Object.values(allUsers);
            let usersText = `${UI.icons.admin} *USERS* (${usersList.length})\n\n`;
            usersList.slice(-30).forEach((u, i) => {
                const name = u.username ? `@${u.username}` : u.firstName;
                usersText += `${i+1}. \`${u.userId}\` \- ${UI.escape(name)} ${u.verified ? '✅' : '❌'}\n`;
            });
            await bot.editMessageText(usersText, {
                chat_id: chatId, message_id: messageId,
                parse_mode: 'MarkdownV2',
                reply_markup: { inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'menu_main' }]] }
            });
            break;
            
        case 'admin_stats':
            if (userId !== OWNER_ID) return;
            const botStats = Storage.getStats();
            const allUsers2 = Storage.getAllUsers();
            const uptime2 = Date.now() - (botStats.startTime || Date.now());
            const d = Math.floor(uptime2 / 86400000);
            const h = Math.floor((uptime2 % 86400000) / 3600000);
            const m = Math.floor((uptime2 % 3600000) / 60000);
            
            let adminStats = `${UI.icons.chart} *BOT STATS*\n\n`;
            adminStats += `👥 Users: ${Object.keys(allUsers2).length}\n`;
            adminStats += `✅ Verified: ${Object.values(allUsers2).filter(u => u.verified).length}\n`;
            adminStats += `💬 Messages: ${botStats.totalMessages || 0}\n`;
            adminStats += `📁 Projects: ${botStats.totalProjects || 0}\n`;
            adminStats += `⏱ Uptime: ${d}d ${h}h ${m}m`;
            
            await bot.editMessageText(adminStats, {
                chat_id: chatId, message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'menu_main' }]] }
            });
            break;
            
        case 'admin_block':
            if (userId !== OWNER_ID) return;
            setSession(userId, 'admin_block');
            await bot.editMessageText(
                `${UI.icons.admin} *BLOCK USER*\n\nSend the User ID to block:`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', ...UI.cancelButton() }
            );
            break;
            
        case 'admin_unblock':
            if (userId !== OWNER_ID) return;
            setSession(userId, 'admin_unblock');
            await bot.editMessageText(
                `${UI.icons.admin} *UNBLOCK USER*\n\nSend the User ID to unblock:`,
                { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', ...UI.cancelButton() }
            );
            break;
            
        case 'admin_status':
            if (userId !== OWNER_ID) return;
            const memUsage = process.memoryUsage();
            let statusText = `${UI.icons.admin} *BOT STATUS*\n\n`;
            statusText += `🤖 Bot: *Online*\n`;
            statusText += `💾 Memory: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB\n`;
            statusText += `📊 Uptime: ${process.uptime().toFixed(0)}s\n`;
            statusText += `🔧 Node: ${process.version}\n`;
            statusText += `👑 Owner: ${OWNER_USERNAME}`;
            
            await bot.editMessageText(statusText, {
                chat_id: chatId, message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'menu_main' }]] }
            });
            break;
            
        // ===== ACTIONS =====
        case 'action_cancel':
            sessions.delete(userId);
            await sendWelcome(chatId, userId, query.from.username);
            break;
            
        default:
            break;
    }
});

// ============== MESSAGE HANDLER (MAIN AI) ==============
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    // Ignore commands (handled separately)
    if (text.startsWith('/')) return;
    
    // Ignore non-text messages without caption
    if (!text && !msg.caption) return;
    
    const messageText = text || msg.caption;
    
    // Register user
    Storage.registerUser(userId, msg.from);
    
    // Check if blocked
    if (Storage.isUserBlocked(userId)) {
        await bot.sendMessage(chatId, `${UI.icons.skull} You have been blocked by the Owner.`);
        return;
    }
    
    // Check verification
    if (!Storage.isUserVerified(userId)) {
        await sendVerificationMessage(chatId, userId);
        return;
    }
    
    // Track message
    Storage.incrementUserMessage(userId);
    
    const session = getSession(userId);
    
    // Handle based on session state
    switch (session.state) {
        case 'code_writer':
            await handleCodeRequest(chatId, userId, messageText);
            break;
            
        case 'project_ask':
            await handleProjectRequest(chatId, userId, messageText);
            break;
            
        case 'clone_ask':
            await handleCloneRequest(chatId, userId, messageText);
            break;
            
        case 'image_ask':
            await handleImageRequest(chatId, userId, messageText);
            break;
            
        case 'chat':
            const chatUser = msg.from?.username || msg.from?.first_name || 'User';
            await handleChat(chatId, userId, messageText, chatUser);
            break;
            
        case 'admin_broadcast':
            if (userId === OWNER_ID) {
                await handleBroadcast(chatId, userId, messageText);
            }
            sessions.delete(userId);
            break;
            
        case 'admin_block':
            if (userId === OWNER_ID) {
                const blockId = parseInt(messageText);
                Storage.blockUser(blockId);
                await bot.sendMessage(chatId, `${UI.icons.done} User \`${blockId}\` blocked.`, { parse_mode: 'Markdown' });
            }
            sessions.delete(userId);
            break;
            
        case 'admin_unblock':
            if (userId === OWNER_ID) {
                const unblockId = parseInt(messageText);
                Storage.unblockUser(unblockId);
                await bot.sendMessage(chatId, `${UI.icons.done} User \`${unblockId}\` unblocked.`, { parse_mode: 'Markdown' });
            }
            sessions.delete(userId);
            break;
            
        default:
            // Free chat mode - any message triggers AI
            const chatUsername = msg.from?.username || msg.from?.first_name || 'User';
            await handleChat(chatId, userId, messageText, chatUsername);
            break;
    }
});

// ============== AI HANDLERS ==============

// Code Writer
async function handleCodeRequest(chatId, userId, prompt) {
    sessions.delete(userId);
    
    const waitMsg = await bot.sendMessage(chatId, `${UI.icons.code} Writing your code...`, { parse_mode: 'Markdown' });
    
    try {
        const codePrompt = `Write complete, working code for this request. Provide ONLY the code with brief explanation:\n\n${prompt}\n\nRules:\n1. Full working code, no placeholders\n2. Include all imports/dependencies\n3. Add comments explaining key parts\n4. Format as markdown code blocks`;
        
        const response = await GroqAI.chat(codePrompt);
        
        await bot.deleteMessage(chatId, waitMsg.message_id);
        
        // Send code in chunks if needed
        await sendLongMessage(chatId, `${UI.icons.code} *CODE GENERATED* ${UI.icons.fire}\n\n${response}`, { parse_mode: 'Markdown' });
        
        // Also create a file
        const cleanCode = response.replace(/```[\w]*\n/g, '').replace(/```/g, '');
        const filePath = await FileManager.createFile(`code_${Date.now()}.txt`, cleanCode);
        await bot.sendDocument(chatId, filePath, {}, { contentType: 'text/plain' });
        
    } catch (error) {
        await bot.deleteMessage(chatId, waitMsg.message_id);
        await bot.sendMessage(chatId, `${UI.icons.error} Error: ${error.message}`);
    }
}

// Project Builder with Progress
async function handleProjectRequest(chatId, userId, description) {
    sessions.delete(userId);
    
    // Send initial progress
    await showProgress(chatId, 'Analyzing Project Requirements', 5);
    
    try {
        // Step 1: Analyze requirements
        await showProgress(chatId, 'Planning Architecture', 15);
        await delay(500);
        
        // Step 2: Generate project
        await showProgress(chatId, 'Generating Complete Code', 30);
        
        const response = await GroqAI.generateProject(description, '', (p) => {
            showProgress(chatId, 'Building Project Files', 30 + Math.floor(p * 0.4));
        });
        
        // Step 3: Parse and create files
        await showProgress(chatId, 'Creating File Structure', 75);
        
        const projectName = description.split(' ').slice(0, 5).join('_');
        const result = await FileManager.generateProjectZip(projectName, response, (p) => {
            showProgress(chatId, 'Packaging Project', 75 + Math.floor(p * 0.15));
        });
        
        // Step 4: Finalize
        await showProgress(chatId, 'Finalizing', 95);
        await delay(300);
        
        await clearProgress(chatId);
        
        // Send completion message
        const fileSize = FileManager.formatFileSize(FileManager.getFileSize(result.zipPath));
        
        await bot.sendMessage(chatId, 
            `${UI.icons.rocket} *PROJECT COMPLETE* ${UI.icons.fire}\n\n` +
            `📁 Files: ${result.fileCount}\n` +
            `📦 Size: ${fileSize}\n` +
            `💻 Status: Ready to deploy\n\n` +
            `_Download your project below ⬇️_`,
            { parse_mode: 'Markdown' }
        );
        
        // Send zip file
        await bot.sendDocument(chatId, result.zipPath, {
            caption: `${UI.icons.crown} Shadow Evil AI Project`
        });
        
        // Send setup guide
        await bot.sendMessage(chatId,
            `${UI.icons.info} *DEPLOYMENT GUIDE*\n\n` +
            `1\. Extract the ZIP file\n` +
            `2\. Run \`npm install\` to install dependencies\n` +
            `3\. Copy \`\.env\.example\` to \`\.env\` and fill in your values\n` +
            `4\. Run \`npm start\` to start locally\n` +
            `5\. For Railway: Connect GitHub repo and deploy\n` +
            `6\. For Vercel: Use \`vercel \-\-prod\`\n\n` +
            `${UI.icons.crown} Your project is production\-ready!`,
            { parse_mode: 'MarkdownV2' }
        );
        
        Storage.saveProject(userId, { name: projectName, description, fileCount: result.fileCount });
        FileManager.cleanup();
        
    } catch (error) {
        await clearProgress(chatId);
        console.error('Project Error:', error);
        await bot.sendMessage(chatId, 
            `${UI.icons.error} *Project Build Failed*\n\n${error.message}\n\nTry with a more specific description.`
        );
    }
}

// Website Cloner
async function handleCloneRequest(chatId, userId, input) {
    sessions.delete(userId);
    
    const waitMsg = await bot.sendMessage(chatId, `${UI.icons.web} Analyzing website...`, { parse_mode: 'Markdown' });
    
    try {
        let url = input;
        let description = input;
        
        // Extract URL if present
        const urlMatch = input.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
            url = urlMatch[0];
            description = input.replace(url, '').trim() || 'Clone this website with all features';
        }
        
        await bot.editMessageText(`${UI.icons.web} Cloning website: ${url}...`, {
            chat_id: chatId, message_id: waitMsg.message_id
        });
        
        const response = await GroqAI.cloneWebsite(url, description);
        
        await bot.deleteMessage(chatId, waitMsg.message_id);
        
        // Create project from response
        const projectName = `web_clone_${Date.now()}`;
        const result = await FileManager.generateProjectZip(projectName, response, () => {});
        
        await bot.sendMessage(chatId,
            `${UI.icons.web} *WEBSITE CLONED* ${UI.icons.fire}\n\n` +
            `🌐 Source: ${url}\n` +
            `📁 Files: ${result.fileCount}\n` +
            `💻 Full Frontend + Backend included\n\n` +
            `_Download your cloned website ⬇️_`,
            { parse_mode: 'Markdown' }
        );
        
        await bot.sendDocument(chatId, result.zipPath, {
            caption: `${UI.icons.crown} Shadow Evil AI - Web Clone`
        });
        
        await bot.sendMessage(chatId,
            `${UI.icons.info} *HOSTING GUIDE*\n\n` +
            `1\. Extract and run \`npm install\`\n` +
            `2\. Set up environment variables in \`\.env\`\n` +
            `3\. For *Railway*: Push to GitHub → Connect → Deploy\n` +
            `4\. For *Vercel*: \`npm i \-g vercel\` then \`vercel\`\n` +
            `5\. For *Render*: New Web Service → Connect repo\n\n` +
            `⚡ Changes needed:\n` +
            `\- Update API keys\n` +
            `\- Change brand/name in config\n` +
            `\- Update database connection strings\n` +
            `\- Add your own images/assets`,
            { parse_mode: 'Markdown' }
        );
        
        Storage.saveProject(userId, { name: projectName, description: `Clone: ${url}`, fileCount: result.fileCount });
        
    } catch (error) {
        await bot.deleteMessage(chatId, waitMsg.message_id);
        console.error('Clone Error:', error);
        await bot.sendMessage(chatId, `${UI.icons.error} Clone failed: ${error.message}`);
    }
}

// Image/Logo Generator
async function handleImageRequest(chatId, userId, description) {
    sessions.delete(userId);
    
    const waitMsg = await bot.sendMessage(chatId, `${UI.icons.image} Creating your image...`, { parse_mode: 'Markdown' });
    
    try {
        // Generate optimized prompt
        await bot.editMessageText(`${UI.icons.image} Enhancing prompt...`, {
            chat_id: chatId, message_id: waitMsg.message_id
        });
        
        const enhancedPrompt = await GroqAI.generateImagePrompt(description);
        
        await bot.editMessageText(`${UI.icons.image} Generating image...\n\nPrompt: ${enhancedPrompt.substring(0, 200)}...`, {
            chat_id: chatId, message_id: waitMsg.message_id
        });
        
        // Use Pollinations AI for free image generation
        const encodedPrompt = encodeURIComponent(enhancedPrompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}&enhance=true`;
        
        await bot.deleteMessage(chatId, waitMsg.message_id);
        
        // Send the generated image
        await bot.sendPhoto(chatId, imageUrl, {
            caption: `${UI.icons.image} *Generated Image*\n\nPrompt: ${description}\n\n${UI.icons.crown} Shadow Evil AI`,
            parse_mode: 'Markdown'
        });
        
    } catch (error) {
        await bot.deleteMessage(chatId, waitMsg.message_id);
        console.error('Image Error:', error);
        
        // Fallback: send direct link
        const encodedPrompt = encodeURIComponent(description);
        const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
        
        await bot.sendPhoto(chatId, fallbackUrl, {
            caption: `${UI.icons.image} *Your Image* ${UI.icons.crown}`
        });
    }
}

// Main AI Chat Handler
async function handleChat(chatId, userId, message, username = 'User') {
    const waitMsg = await bot.sendMessage(chatId, `${UI.icons.brain} Thinking...`, { parse_mode: 'Markdown' });
    
    try {
        // Add username context to every prompt
        const userPrompt = `[User: ${username} (ID: ${userId})]\n\n${message}`;
        
        const response = await GroqAI.chat(userPrompt);
        
        await bot.deleteMessage(chatId, waitMsg.message_id);
        
        // Check if response contains file generation request
        if (message.toLowerCase().includes('create') && 
            (message.toLowerCase().includes('file') || message.toLowerCase().includes('project') || message.toLowerCase().includes('bot'))) {
            
            await sendLongMessage(chatId, response, { parse_mode: 'Markdown' });
            
            // Also offer to create zip
            await bot.sendMessage(chatId,
                `${UI.icons.question} Want me to create a complete project ZIP with all files?`,
                {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: `${UI.icons.zip} Yes, Build Project`, callback_data: 'menu_project' }
                        ]]
                    }
                }
            );
        } else {
            await sendLongMessage(chatId, response, { parse_mode: 'Markdown' });
        }
        
    } catch (error) {
        await bot.deleteMessage(chatId, waitMsg.message_id);
        console.error('Chat Error:', error);
        await bot.sendMessage(chatId, `${UI.icons.error} Shadow AI glitch: ${error.message}. Try again.`);
    }
}

// Broadcast Handler
async function handleBroadcast(chatId, fromId, message) {
    const users = Storage.getAllUsers();
    const allUserIds = Object.keys(users);
    
    const statusMsg = await bot.sendMessage(chatId, `${UI.icons.loading} Broadcasting to ${allUserIds.length} users...`);
    
    let sent = 0;
    let failed = 0;
    
    for (const uid of allUserIds) {
        try {
            await bot.sendMessage(uid, `${UI.icons.admin} *BROADCAST*\n\n${message}`, { parse_mode: 'Markdown' });
            sent++;
            await delay(50);
        } catch (e) {
            failed++;
        }
        
        // Update status every 10 users
        if ((sent + failed) % 10 === 0) {
            await bot.editMessageText(
                `${UI.icons.loading} Broadcasting...\nSent: ${sent} | Failed: ${failed}`,
                { chat_id: chatId, message_id: statusMsg.message_id }
            );
        }
    }
    
    await bot.editMessageText(
        `${UI.icons.done} *Broadcast Complete*\n\nSent: ${sent}\nFailed: ${failed}`,
        { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
    );
}

// ============== ERROR HANDLING ==============
bot.on('polling_error', (error) => {
    console.error('Polling Error:', error.message);
});

bot.on('error', (error) => {
    console.error('Bot Error:', error.message);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

// ============== STARTUP ==============
console.log(`
${'='.repeat(60)}
   🤖 SHADOW EVIL AI BOT v3.0
   👑 Owner: ${OWNER_USERNAME}
   ⚡ Status: ONLINE
   🧠 AI: Groq API (llama-3.3-70b)
   📊 Storage: JSON File Based
   🔥 Mode: UNRESTRICTED
${'='.repeat(60)}
`);

console.log('🚀 Bot is running... Waiting for messages.');
