const express = require('express');
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
router.post('/webhook', async (req, res) => {
  console.log('WEBHOOK RECEIVED: ', new Date().toISOString());
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body sample:', JSON.stringify(req.body).substring(0, 500) + '...');

  const timestamp = new Date().toISOString();
  try {
    // Check if this is a test webhook from Helius
    // This logic needs to inspect the actual webhook payload
    const isTestWebhook = detectTestWebhook(req.body);

    if (isTestWebhook) {
      logger.info('Processing test webhook');
      await discordService.sendTestWebhookConfirmation();
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
  // Remove this line - it's unreachable and would cause "headers already sent" error
  // res.status(200).json({ success: true });
});

// Helper function to detect if the webhook is a test webhook from Helius
function detectTestWebhook(webhookData) {
  // Implement logic to detect a test webhook
  // For example, test webhooks may have specific properties or values
  // Based on Helius documentation or by examining the test webhook payload

  // Simple example (you'll need to adjust this based on actual test webhook format)
  if (Array.isArray(webhookData)) {
    return webhookData.some(tx =>
      tx.type === 'TEST_WEBHOOK' ||
      (tx.description && tx.description.includes('test'))
    );
  }
  return false;
}

module.exports = router;
