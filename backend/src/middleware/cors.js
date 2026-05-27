const cors = require('cors');
const config = require('../config');

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      config.frontendUrl,
      'http://localhost:4000',
      'http://localhost:5000',
      'https://devrhythm.vercel.app'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['Authorization', 'X-Total-Count']
};

module.exports = cors(corsOptions);