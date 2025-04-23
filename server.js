const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/config');
const routes = require('./routes');
const logger = require('./utils/logger');

// Initialize express app
const app = express();

// Security middleware
app.use(helmet());

// Parse JSON bodies
app.use(express.json({
  verify: (req, res, buf) => {
    // Store raw body for webhook signature verification if needed
    req.rawBody = buf.toString();
  }
}));

// Request logging
app.use(morgan('combined', { stream: { write: message => logger.info(message) } }));

// Apply routes
app.use('/', routes);

// Start server
app.listen(config.port, () => {
  logger.info(`Server started on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Monitoring collection: ${config.merkleTree}`);
  logger.info(`Minimum SOL value: ${config.minSolValue}`);
  logger.info(`Rate limit: ${config.rateLimit.maxRequests}/minute`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
  // In production, you might want to use a process manager like PM2 to restart the application
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

module.exports = app;
