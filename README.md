# Shadow Evil AI Bot v3.0

**The Ultimate Unrestricted Telegram AI Bot**

---

## Features

- **Unrestricted AI** - Groq API powered (Llama 3.3 70B) - No content filters
- **Code Writer** - Complete working code in any language
- **Project Builder** - Full projects with files, zipped and ready to deploy
- **Website Cloner** - Analyze any URL and recreate with full frontend + backend
- **Logo & Image Maker** - AI-generated images and logos
- **Free Chat Mode** - Ask anything, no command restrictions
- **Channel Verification** - 2 Telegram + 1 YouTube + 1 WhatsApp (display only TG verified)
- **Owner Panel** - Broadcast, user list, stats, block/unblock
- **JSON Storage** - No database needed, all file-based
- **Premium UI** - Dark theme with minimal animations
- **Progress Tracking** - Visual progress bars for project generation

---

## Setup Guide

### Step 1: Prerequisites

- Node.js v18 or higher
- A Telegram account
- Groq API key (free)

### Step 2: Get Groq API Key

1. Go to https://console.groq.com/keys
2. Create a free account
3. Generate an API key
4. Copy the key

### Step 3: Create Telegram Bot

1. Message @BotFather on Telegram
2. Send `/newbot`
3. Follow prompts to create your bot
4. Copy the bot token

### Step 4: Get Your User ID

1. Message @userinfobot on Telegram
2. It will reply with your user ID
3. Copy the ID number

### Step 5: Create Telegram Channels

1. Create 2 Telegram channels for verification
2. Add your bot as administrator
3. Get channel usernames (e.g., @yourchannel)

### Step 6: Install & Configure

```bash
# Clone/extract the bot files
cd shadow-evil-ai-bot

# Install dependencies
npm install

# Edit .env file
nano .env
```

Fill in the `.env` file:
```
BOT_TOKEN=your_bot_token_here
GROQ_API_KEY=your_groq_api_key_here
OWNER_ID=your_telegram_user_id
OWNER_USERNAME=Shadow
TG_CHANNEL_1=@yourchannel1
TG_CHANNEL_2=@yourchannel2
CHANNEL_1_LINK=https://t.me/yourchannel1
CHANNEL_2_LINK=https://t.me/yourchannel2
```

### Step 7: Run the Bot

```bash
# Development mode
npm run dev

# Production mode
npm start

# With PM2 (recommended for production)
npm run pm2
```

---

## Deploy on Railway (Free)

### Method 1: Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init --name shadow-bot

# Deploy
railway up

# Add environment variables
railway variables

# Get domain
railway domain
```

### Method 2: Railway Dashboard

1. Go to https://railway.app
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Connect your repository
5. Add environment variables in "Variables" tab
6. Deploy!

---

## Deploy on Render (Free)

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variables
7. Click "Create Web Service"

---

## Deploy on VPS / Dedicated Server

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm i -g pm2

# Upload bot files
cd /var/www
mkdir shadow-bot && cd shadow-bot
# Upload files here

# Install dependencies
npm install

# Create .env file
nano .env

# Start with PM2
pm2 start bot.js --name shadow-bot

# Save PM2 config
pm2 save
pm2 startup

# View logs
pm2 logs shadow-bot

# Restart
pm2 restart shadow-bot
```

---

## Bot Commands

### User Commands
| Command | Description |
|---------|-------------|
| `/start` | Start the bot & verify channels |
| `/clear` | Clear current session |

### Owner Commands
| Command | Description |
|---------|-------------|
| `/admin` | Open owner panel |
| `/broadcast <message>` | Send message to all users |
| `/users` | List all users |
| `/stats` | Show bot statistics |

---

## Channel Verification Setup

The bot shows 4 channels for users to join:
- 2 Telegram channels (ACTUALLY VERIFIED)
- 1 YouTube channel (display only)
- 1 WhatsApp channel (display only)

Users must join the 2 Telegram channels. YouTube and WhatsApp are shown but not actually verified (since bots can't check those platforms).

---

## File Structure

```
shadow-evil-ai-bot/
├── bot.js              # Main bot file
├── package.json        # Dependencies
├── .env               # Configuration
├── .env.example       # Example config
├── README.md          # This file
├── utils/
│   ├── groq.js        # AI integration
│   ├── storage.js     # JSON database
│   └── fileManager.js # File/zip handling
├── data/              # JSON data storage
│   ├── users.json
│   ├── stats.json
│   └── projects.json
├── temp/              # Temporary files
└── projects/          # Generated projects
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token |
| `GROQ_API_KEY` | Yes | Groq API key |
| `OWNER_ID` | Yes | Your Telegram user ID |
| `OWNER_USERNAME` | No | Display name for owner |
| `TG_CHANNEL_1` | Yes | Telegram channel 1 username |
| `TG_CHANNEL_2` | Yes | Telegram channel 2 username |
| `CHANNEL_1-4_*` | No | Channel display names and links |

---

## Troubleshooting

### Bot not responding
- Check if BOT_TOKEN is correct
- Ensure bot is started with `npm start`
- Check logs: `pm2 logs shadow-bot`

### Verification not working
- Bot must be admin in both Telegram channels
- Channel usernames must be correct (with @)

### AI not responding
- Check GROQ_API_KEY is valid
- Ensure you have Groq API credits

---

## Credits

**Owner**: Shadow (Papa of the whole world)
**Version**: 3.0
**AI Engine**: Groq (Llama 3.3 70B)
**Image Engine**: Pollinations AI
