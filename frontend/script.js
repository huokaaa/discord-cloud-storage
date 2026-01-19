// Import config
import { API_CONFIG } from './config.js';

class CloudStorage {
    constructor() {
        this.API_URL = API_CONFIG.API_URL;
        this.files = [];
        this.currentFile = null;
        
        console.log(`🌐 Menggunakan API URL: ${this.API_URL}`);
        
        this.initElements();
        this.initEventListeners();
        this.loadFiles();
        this.loadTheme();
        
        // Auto-refresh setiap 30 detik
        setInterval(() => this.loadFiles(), 30000);
    }
    
    initElements() {
        // File input
        this.fileInput = document.getElementById('fileInput');
        this.selectFilesBtn = document.getElementById('selectFilesBtn');
        this.dropArea = document.getElementById('dropArea');
        
        // UI Elements
        this.filesGrid = document.getElementById('filesGrid');
        this.loading = document.getElementById('loading');
        this.emptyState = document.getElementById('emptyState');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.searchInput = document.getElementById('searchInput');
        this.themeToggle = document.getElementById('themeToggle');
        this.storageCount = document.getElementById('storageCount');
        this.toast = document.getElementById('toast');
        
        // Modal
        this.previewModal = document.getElementById('previewModal');
        this.previewImage = document.getElementById('previewImage');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.closeModal = document.querySelector('.close');
    }
    
    initEventListeners() {
        // File selection
        this.selectFilesBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
        
        // Drag and drop
        this.dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropArea.style.borderColor = '#3b82f6';
            this.dropArea.style.transform = 'scale(1.02)';
        });
        
        this.dropArea.addEventListener('dragleave', () => {
            this.dropArea.style.borderColor = '';
            this.dropArea.style.transform = '';
        });
        
        this.dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropArea.style.borderColor = '';
            this.dropArea.style.transform = '';
            this.handleFiles(e.dataTransfer.files);
        });
        
        // Refresh
        this.refreshBtn.addEventListener('click', () => {
            this.refreshBtn.querySelector('i').classList.add('fa-spin');
            this.loadFiles().finally(() => {
                setTimeout(() => {
                    this.refreshBtn.querySelector('i').classList.remove('fa-spin');
                }, 500);
            });
        });
        
        // Search
        this.searchInput.addEventListener('input', () => this.filterFiles());
        
        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Modal
        this.closeModal.addEventListener('click', () => this.closePreview());
        window.addEventListener('click', (e) => {
            if (e.target === this.previewModal) {
                this.closePreview();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closePreview();
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                this.searchInput.focus();
            }
        });
    }
    
    async loadFiles() {
        this.showLoading(true);
        
        try {
            const response = await fetch(`${this.API_URL}/files`, {
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            this.files = await response.json();
            this.renderFiles();
            this.updateStorageCount();
            this.showToast('File berhasil dimuat', 'success');
        } catch (error) {
            console.error('Error loading files:', error);
            this.showToast('Gagal memuat file. Coba refresh halaman.', 'error');
            this.filesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-wifi-slash"></i>
                    <h3>Koneksi Error</h3>
                    <p>Tidak dapat terhubung ke server</p>
                    <button class="btn-primary" onclick="cloudStorage.loadFiles()">
                        <i class="fas fa-redo"></i> Coba Lagi
                    </button>
                </div>
            `;
        } finally {
            this.showLoading(false);
        }
    }
    
    renderFiles() {
        if (this.files.length === 0) {
            this.filesGrid.innerHTML = '';
            this.emptyState.style.display = 'block';
            return;
        }
        
        this.emptyState.style.display = 'none';
        this.filesGrid.innerHTML = '';
        
        this.files.forEach(file => {
            const fileCard = this.createFileCard(file);
            this.filesGrid.appendChild(fileCard);
        });
    }
    
    createFileCard(file) {
        const card = document.createElement('div');
        card.className = 'file-card';
        card.dataset.id = file.messageId;
        
        const isImage = file.isImage || 
                       file.filename.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
        
        const fileIcon = this.getFileIcon(file.filename);
        const fileSize = this.formatFileSize(file.size);
        const fileDate = new Date(file.timestamp).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        card.innerHTML = `
            <div class="file-icon">
                <i class="${fileIcon}"></i>
            </div>
            
            ${isImage ? `
                <img src="${file.url}" 
                     alt="${file.filename}" 
                     class="file-preview"
                     loading="lazy"
                     onerror="this.style.display='none'">
            ` : ''}
            
            <div class="file-info">
                <div class="file-name" title="${file.filename}">${file.filename}</div>
                <div class="file-size">${fileSize}</div>
                <div class="file-date">${fileDate}</div>
            </div>
            
            <div class="file-actions">
                <button class="action-btn preview" onclick="cloudStorage.previewFile('${file.messageId}')">
                    <i class="fas fa-eye"></i> Preview
                </button>
                <button class="action-btn delete" onclick="cloudStorage.deleteFile('${file.messageId}')">
                    <i class="fas fa-trash"></i> Hapus
                </button>
            </div>
        `;
        
        return card;
    }
    
    async handleFiles(fileList) {
        const files = Array.from(fileList);
        
        // Validasi ukuran file
        const oversizedFiles = files.filter(file => file.size > 25 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            this.showToast('Beberapa file melebihi 25MB', 'error');
            return;
        }
        
        // Upload files satu per satu
        for (const [index, file] of files.entries()) {
            await this.uploadFile(file, index + 1, files.length);
        }
        
        // Refresh daftar file
        setTimeout(() => this.loadFiles(), 1000);
    }
    
    async uploadFile(file, current = 1, total = 1) {
        const formData = new FormData();
        formData.append('file', file);
        
        this.showUploadProgress(true);
        
        try {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    const text = total > 1 
                        ? `Mengupload ${file.name} (${current}/${total})...`
                        : `Mengupload ${file.name}...`;
                    this.updateProgress(percent, text);
                }
            });
            
            const uploadPromise = new Promise((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error(`Upload failed: ${xhr.status}`));
                    }
                };
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.ontimeout = () => reject(new Error('Request timeout'));
            });
            
            xhr.open('POST', `${this.API_URL}/upload`);
            xhr.timeout = 300000; // 5 menit timeout
            xhr.send(formData);
            
            await uploadPromise;
            this.showToast(`${file.name} berhasil diupload!`, 'success');
            
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast(`Gagal mengupload ${file.name}: ${error.message}`, 'error');
        } finally {
            if (current === total) {
                this.showUploadProgress(false);
            }
        }
    }
    
    async deleteFile(messageId) {
        if (!confirm('Apakah Anda yakin ingin menghapus file ini?')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.API_URL}/delete/${messageId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Delete failed');
            
            // Animasi penghapusan
            const card = document.querySelector(`.file-card[data-id="${messageId}"]`);
            if (card) {
                card.style.opacity = '0.5';
                card.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    card.style.transition = 'all 0.3s ease';
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(-20px)';
                    setTimeout(() => card.remove(), 300);
                }, 100);
            }
            
            // Update files array
            this.files = this.files.filter(f => f.messageId !== messageId);
            this.updateStorageCount();
            
            this.showToast('File berhasil dihapus', 'success');
        } catch (error) {
            console.error('Delete error:', error);
            this.showToast('Gagal menghapus file', 'error');
        }
    }
    
    previewFile(messageId) {
        const file = this.files.find(f => f.messageId === messageId);
        if (!file) return;
        
        const isImage = file.isImage || 
                       file.filename.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
        
        if (isImage) {
            this.previewImage.src = file.url;
            this.downloadBtn.onclick = () => window.open(file.url, '_blank');
            this.previewModal.style.display = 'block';
        } else {
            // Untuk file non-image, langsung download
            window.open(file.url, '_blank');
        }
    }
    
    closePreview() {
        this.previewModal.style.display = 'none';
        this.previewImage.src = '';
    }
    
    filterFiles() {
        const searchTerm = this.searchInput.value.toLowerCase();
        
        if (!searchTerm) {
            this.renderFiles();
            return;
        }
        
        const filtered = this.files.filter(file => 
            file.filename.toLowerCase().includes(searchTerm)
        );
        
        if (filtered.length === 0) {
            this.filesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Tidak ditemukan</h3>
                    <p>Tidak ada file yang cocok dengan pencarian</p>
                </div>
            `;
            this.emptyState.style.display = 'none';
        } else {
            this.filesGrid.innerHTML = '';
            filtered.forEach(file => {
                const fileCard = this.createFileCard(file);
                this.filesGrid.appendChild(fileCard);
            });
        }
    }
    
    updateStorageCount() {
        const count = this.files.length;
        const totalSize = this.files.reduce((sum, file) => sum + (file.size || 0), 0);
        const sizeText = this.formatFileSize(totalSize);
        this.storageCount.textContent = `${count} file (${sizeText})`;
    }
    
    showLoading(show) {
        this.loading.style.display = show ? 'block' : 'none';
        if (show) {
            this.filesGrid.style.opacity = '0.5';
            this.filesGrid.style.pointerEvents = 'none';
        } else {
            this.filesGrid.style.opacity = '1';
            this.filesGrid.style.pointerEvents = 'all';
        }
    }
    
    showUploadProgress(show) {
        this.uploadProgress.style.display = show ? 'block' : 'none';
        if (!show) {
            this.updateProgress(0, '');
        }
    }
    
    updateProgress(percent, text) {
        this.progressFill.style.width = `${percent}%`;
        this.progressText.textContent = text;
    }
    
    showToast(message, type = 'info') {
        this.toast.textContent = message;
        this.toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }
    
    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            // Images
            jpg: 'fas fa-file-image',
            jpeg: 'fas fa-file-image',
            png: 'fas fa-file-image',
            gif: 'fas fa-file-image',
            webp: 'fas fa-file-image',
            bmp: 'fas fa-file-image',
            svg: 'fas fa-file-image',
            
            // Documents
            pdf: 'fas fa-file-pdf',
            doc: 'fas fa-file-word',
            docx: 'fas fa-file-word',
            txt: 'fas fa-file-alt',
            rtf: 'fas fa-file-alt',
            
            // Spreadsheets
            xls: 'fas fa-file-excel',
            xlsx: 'fas fa-file-excel',
            csv: 'fas fa-file-csv',
            
            // Presentations
            ppt: 'fas fa-file-powerpoint',
            pptx: 'fas fa-file-powerpoint',
            
            // Archives
            zip: 'fas fa-file-archive',
            rar: 'fas fa-file-archive',
            '7z': 'fas fa-file-archive',
            tar: 'fas fa-file-archive',
            gz: 'fas fa-file-archive',
            
            // Code
            js: 'fas fa-file-code',
            html: 'fas fa-file-code',
            css: 'fas fa-file-code',
            json: 'fas fa-file-code',
            xml: 'fas fa-file-code',
            
            // Audio
            mp3: 'fas fa-file-audio',
            wav: 'fas fa-file-audio',
            ogg: 'fas fa-file-audio',
            
            // Video
            mp4: 'fas fa-file-video',
            avi: 'fas fa-file-video',
            mkv: 'fas fa-file-video',
            mov: 'fas fa-file-video',
        };
        
        return icons[ext] || 'fas fa-file';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-mode');
        this.themeToggle.innerHTML = isDark ? 
            '<i class="fas fa-sun"></i>' : 
            '<i class="fas fa-moon"></i>';
        
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
    
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        const isDark = savedTheme === 'dark';
        
        document.body.classList.toggle('dark-mode', isDark);
        this.themeToggle.innerHTML = isDark ? 
            '<i class="fas fa-sun"></i>' : 
            '<i class="fas fa-moon"></i>';
    }
}

// Inisialisasi aplikasi saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
    window.cloudStorage = new CloudStorage();
});