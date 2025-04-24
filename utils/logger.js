const winston = require('winston');
const config = require('../config/config');

// Add fallback values if config.logging is undefined
const logLevel = config.logging?.level || 'info';
const logFormat = config.logging?.format || 'json';

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.json(),
  defaultMeta: { service: 'solana-cnft-monitor' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

module.exports = logger;
