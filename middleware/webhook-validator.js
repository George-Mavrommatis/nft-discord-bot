const logger = require('../utils/logger');
const heliusService = require('../services/helius-service');
const config = require('../config/config');

/**
 * Middleware to validate webhook payloads
 */
const validateWebhook = (req, res, next) => {
  try {
    // Store the raw body for signature verification
    let rawBody = '';

    // Log request information
    logger.debug(`Received webhook request: ${req.method} ${req.path}`, {
      headers: req.headers,
      query: req.query
    });

    // Check if it's a test webhook
    if (req.body && req.body.type === 'test') {
      logger.info('Received test webhook event');
      req.isTestWebhook = true;
      return next();
    }

    // Validate basic structure for Helius enhanced webhooks
    if (!req.body || (!req.body.accountData && !Array.isArray(req.body))) {
      return res.status(400).json({
        error: 'Invalid webhook payload structure'
      });
    }

    // For signature verification if needed
    if (config.webhookSecret && req.headers['x-signature']) {
      const signature = req.headers['x-signature'];

      // This verification would need the raw request body
      // For simplicity, we're assuming the body is already parsed
      // In a complete implementation, you'd capture the raw body before parsing
      if (!heliusService.verifyWebhookSignature(signature, JSON.stringify(req.body))) {
        logger.warn('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    next();
  } catch (error) {
    logger.error(`Webhook validation error: ${error.message}`);
    res.status(500).json({ error: 'Webhook validation failed' });
  }
};
console.log('Received webhook data:', JSON.stringify(data, null, 2));

// Use the sendTestWebhook function in your heliusService.js
const testResult = await heliusService.sendTestWebhook();
console.log('Test webhook result:', testResult);

module.exports = validateWebhook;
