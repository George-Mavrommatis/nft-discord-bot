const express = require('express');
const validateWebhook = require('./middleware/webhook-validator');
const heliusService = require('./services/helius-service');
const discordService = require('./services/discord-service');
const logger = require('./utils/logger');
const config = require('./config/config');

const router = express.Router();

// Health check endpoint
router.get('/', (req, res) => {
  const timestamp = new Date().toISOString();
  logger.info('Health check received');
  res.status(200).send(`Server operational at ${timestamp}`);
});

// Test webhook endpoint - allows manual triggering of test webhooks
router.post('/trigger-test', async (req, res) => {
  try {
    logger.info('Sending test webhook to Helius');
    const result = await heliusService.sendTestWebhook();
    res.status(200).json({ success: true, result });
  } catch (error) {
    logger.error(`Error sending test webhook: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Helius webhook endpoint
router.post('/webhook', validateWebhook, async (req, res) => {
  const timestamp = new Date().toISOString();
  try {
    // If this is a test webhook
    if (req.isTestWebhook) {
      logger.info('Processing test webhook');
      await discordService.sendTestWebhookConfirmation();
      return res.status(200).json({ success: true, type: 'test' });
    }

    // Process real webhook data
    logger.info(`Processing Helius webhook data at ${timestamp}`);

    // Extract transactions from the webhook payload
    const transactions = req.body.accountData || req.body || [];

    // Process transactions to find matching NFT sales
    const results = heliusService.processTransactions(transactions);

    logger.info('Webhook processing summary', {
      matched: results.matched.length,
      skipped: results.skipped.length,
      errors: results.errors.length
    });

    // Send Discord notifications for all matching sales
    for (const sale of results.matched) {
      await discordService.sendNftSaleNotification(sale);
    }

    return res.status(200).json({
      success: true,
      processed: results.matched.length
    });
  } catch (error) {
    logger.error(`Critical webhook error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
