const express = require('express');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const helmet = require('helmet');
const winston = require('winston');
const config = require('./config');
const routes = require('./routes');

// Initialize logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    config.logging.timestamps ? winston.format.timestamp() : winston.format.simple(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// Parse JSON bodies
app.use(express.json());

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
