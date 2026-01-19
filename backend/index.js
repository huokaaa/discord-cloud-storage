require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_API_URL = process.env.BOT_API_URL; // Akan diatur di Render

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '25mb' }));

// Konfigurasi multer tanpa disk storage (gunakan memory)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// ========== ROUTES ==========

// Upload file ke Discord via Bot API
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diupload' });
    }

    // Convert buffer ke base64
    const base64Data = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`;

    // Kirim ke Bot API
    const response = await axios.post(`${BOT_API_URL}/upload`, {
      filename: req.file.originalname,
      data: dataUrl
    }, {
      timeout: 30000 // 30 detik timeout
    });

    res.json(response.data);
  } catch (error) {
    console.error('Upload error:', error.message);
    
    let errorMessage = 'Gagal mengupload file';
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Bot API tidak dapat diakses';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Timeout saat mengupload';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// Get semua file dari Discord
app.get('/files', async (req, res) => {
  try {
    const response = await axios.get(`${BOT_API_URL}/files`, {
      timeout: 10000
    });
    res.json(response.data);
  } catch (error) {
    console.error('Get files error:', error.message);
    res.status(500).json({ 
      error: 'Gagal mengambil daftar file',
      details: error.message 
    });
  }
});

// Delete file
app.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.delete(`${BOT_API_URL}/delete/${id}`, {
      timeout: 10000
    });
    res.json(response.data);
  } catch (error) {
    console.error('Delete error:', error.message);
    res.status(500).json({ 
      error: 'Gagal menghapus file',
      details: error.message 
    });
  }
});

// Health check untuk Render
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    bot_api_url: BOT_API_URL
  });
});

// Jalankan server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server berjalan di port ${PORT}`);
  console.log(`🤖 Bot API URL: ${BOT_API_URL}`);
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});
