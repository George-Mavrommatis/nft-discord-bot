const express = require('express');
const heliusService = require('./services/helius-service');
const discordService = require('./services/discord-service');
const logger = require('./utils/logger');
const config = require('./config/config');

// Create the router
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
router.post('/webhook', async (req, res) => {
  console.log('WEBHOOK RECEIVED: ', new Date().toISOString());
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body sample:', JSON.stringify(req.body).substring(0, 500) + '...');

  const timestamp = new Date().toISOString();
  try {
    // Check if this is a test webhook from Helius
    const isTestWebhook = detectHeliusTestWebhook(req.body);

    if (isTestWebhook) {
      logger.info('Processing test webhook - sending Discord notification');
      const result = await discordService.sendTestWebhookConfirmation();
      logger.info('Test webhook Discord notification result:', result);
      return res.status(200).json({ success: true, type: 'test' });
    }

    // Process real webhook data
    logger.info(`Processing Helius webhook data at ${timestamp}`);

    // Extract transactions from the webhook payload
    const transactions = req.body || [];

    // Process transactions to find matching NFT sales
    const results = heliusService.processTransactions(transactions);

    logger.info('Webhook processing summary', {
      matched: results.matched.length,
      otherSales: results.otherSales.length,
      skipped: results.skipped.length,
      errors: results.errors.length
    });

    // Send Discord notifications for all matching sales (rich embeds)
    for (const sale of results.matched) {
      await discordService.sendNftSaleNotification(sale);
    }

    // Send simple notifications for other sales
    for (const sale of results.otherSales) {
      await discordService.sendSimpleSaleNotification(sale);
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

// Helper function to detect test webhooks from Helius
function detectHeliusTestWebhook(data) {
  // Check if this is a test webhook from Helius
  console.log("Checking if webhook is a test webhook");

  // Log the full data for debugging
  console.log("Full webhook data:", JSON.stringify(data, null, 2));

  // Common test webhook indicators
  if (Array.isArray(data)) {
    for (const tx of data) {
      if (tx.type === 'TEST' ||
          tx.description === 'Test Webhook' ||
          (tx.source && tx.source === 'HELIUS_DASHBOARD_TEST')) {
        console.log("Test webhook detected!");
        return true;
      }
    }
  }

  // For single-object payloads
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (data.type === 'TEST' ||
        data.description === 'Test Webhook' ||
        (data.source && data.source === 'HELIUS_DASHBOARD_TEST')) {
      console.log("Test webhook detected!");
      return true;
    }
  }

  return false;
}

module.exports = router;
