const config = {
  development: {
    API_URL: 'http://localhost:3000',
    WS_URL: 'ws://localhost:3000'
  },
  production: {
    API_URL: 'https://cloud-storage-backend.onrender.com',
    WS_URL: 'wss://cloud-storage-backend.onrender.com'
  }
};

const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';

export const API_CONFIG = isLocalhost ? config.development : config.production;
