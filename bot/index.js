require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const CHANNEL_ID = process.env.CHANNEL_ID;
let storageChannel = null;

// API Server untuk Render
const app = express();
const PORT = process.env.PORT || 3001;  // Render akan menyediakan PORT

app.use(cors());
app.use(express.json({ limit: '25mb' }));

client.once('ready', async () => {
  console.log(`✅ Bot ${client.user.tag} siap!`);
  
  try {
    storageChannel = await client.channels.fetch(CHANNEL_ID);
    console.log(`✅ Channel storage: ${storageChannel.name}`);
  } catch (error) {
    console.error('❌ Gagal fetch channel:', error);
  }
});

// ========== FUNGSI UTAMA BOT ==========

async function uploadFile(filename, buffer) {
  try {
    if (!storageChannel) {
      storageChannel = await client.channels.fetch(CHANNEL_ID);
    }

    const attachment = new AttachmentBuilder(buffer, { name: filename });
    const message = await storageChannel.send({
      content: `📁 ${filename}`,
      files: [attachment]
    });

    return {
      success: true,
      messageId: message.id,
      filename: filename,
      timestamp: message.createdTimestamp,
      size: buffer.length
    };
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error.message };
  }
}

async function getAllFiles() {
  try {
    if (!storageChannel) {
      storageChannel = await client.channels.fetch(CHANNEL_ID);
    }

    const messages = await storageChannel.messages.fetch({ limit: 100 });
    const files = [];

    messages.forEach(msg => {
      if (msg.attachments.size > 0) {
        msg.attachments.forEach(attachment => {
          files.push({
            messageId: msg.id,
            filename: attachment.name,
            url: attachment.url,
            size: attachment.size,
            timestamp: msg.createdTimestamp,
            isImage: attachment.contentType?.startsWith('image/') || false
          });
        });
      }
    });

    return files.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Get files error:', error);
    return [];
  }
}

async function deleteFile(messageId) {
  try {
    if (!storageChannel) {
      storageChannel = await client.channels.fetch(CHANNEL_ID);
    }

    const message = await storageChannel.messages.fetch(messageId);
    await message.delete();
    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return { success: false, error: error.message };
  }
}

// ========== API ENDPOINTS ==========

app.post('/upload', async (req, res) => {
  try {
    const { filename, data } = req.body;
    
    if (!filename || !data) {
      return res.status(400).json({ error: 'Filename dan data diperlukan' });
    }

    const buffer = Buffer.from(data.split(',')[1] || data, 'base64');
    
    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(400).json({ error: 'File terlalu besar (max 25MB)' });
    }

    const result = await uploadFile(filename, buffer);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/files', async (req, res) => {
  try {
    const files = await getAllFiles();
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteFile(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint untuk Render
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    botReady: client.isReady(),
    timestamp: new Date().toISOString()
  });
});

// Jalankan server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Bot API berjalan di port ${PORT}`);
});

// Login bot dengan error handling
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('❌ Gagal login bot:', error);
  process.exit(1);
});

// Handle process exit
process.on('SIGTERM', () => {
  console.log('🛑 Menerima SIGTERM, mematikan bot...');
  client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});
