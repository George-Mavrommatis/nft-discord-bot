const express = require('express');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const helmet = require('helmet');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const routes = require('./routes');
const logger = require('./utils/logger');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// Parse JSON bodies with size limit
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Apply rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  logger.info('Health check received');
  res.status(200).send('OK');
});

// Apply routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Uncaught Exception:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Monitoring collection: ${config.merkleTree}`);
  logger.info(`Minimum SOL value: ${config.minSolValue}`);

  // Validate required configuration
  const requiredConfigs = ['heliusApiKey', 'discordWebhookUrl', 'merkleTree'];
  for (const key of requiredConfigs) {
    if (!config[key]) {
      logger.error(`Missing required configuration: ${key}`);
      process.exit(1);
    }
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise: promise,
    reason: reason
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', {
    message: err.message,
    stack: err.stack
  });
  // Give the logger time to log the error before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

module.exports = app;
