const express = require('express');
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { sendDiscordNotification } = require('../utils/discord');

const router = express.Router();

// Add root route handler for health checks
router.get('/', (req, res) => {
  res.status(200).send('Solana cNFT Sales Monitor is running');
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint for Discord notifications
router.get('/test-discord', async (req, res) => {
  try {
    if (!config.discordWebhookUrl) {
      return res.status(400).json({ error: 'Discord webhook URL not configured' });
    }

    // Test sale details
    const testSaleDetails = {
      price: 1.25,
      buyer: '5xgEQzLJC1Rtk93fcnFNMwJPzRmG7iJYdogAsg8UPTg1',
      seller: '7yQo6MchZU4ESZz6Lh9E6yzZHK1oZ1SJmFPPJcXb5E3R',
      signature: '4yQW8LYtGx8zNqN3MELSw5jYCX1TWkkYFNKmXrQZNtBZAzTCGN8XKYkuZwJQoEnjzKnTcJkKBtGGzFEes6GwAuHe',
      nfts: [{
        name: 'Test NFT',
        collection: { name: 'Test Collection' },
        merkleTree: config.merkleTree
      }]
    };

    logger.info('Attempting to send test Discord notification');
    const result = await sendDiscordNotification(testSaleDetails);

    if (result) {
      return res.status(200).json({ success: true, message: 'Discord test successful' });
    } else {
      return res.status(500).json({ success: false, message: 'Discord test failed' });
    }
  } catch (error) {
    logger.error('Error testing Discord webhook:', error);
    return res.status(500).json({
      error: 'Discord test failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Webhook endpoint for Helius
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;

    // Log incoming webhook data
    logger.info('Received webhook payload');

    // Verify webhook signature if configured
    if (config.webhookSecret) {
      const signature = req.headers['x-webhook-signature'];
      if (signature !== config.webhookSecret) {
        logger.warn('Invalid webhook signature received');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Check if payload is an array and has data
    if (!Array.isArray(payload) || payload.length === 0) {
      logger.info('Empty or invalid payload received');
      return res.status(200).send('OK');
    }

    // IMPORTANT: Respond to the webhook immediately before processing
    // This follows best practices to acknowledge receipt quickly
    res.status(200).send('OK');

    // Process asynchronously after responding
    processWebhookPayload(payload).catch(error => {
      logger.error('Error in async webhook processing:', error);
    });

  } catch (error) {
    logger.error('Error processing webhook:', error);
    // If we haven't sent a response yet
    if (!res.headersSent) {
      res.status(500).send('Internal Server Error');
    }
  }
});

// Asynchronous processing function
async function processWebhookPayload(payload) {
  logger.debug(`Processing ${payload.length} transactions from webhook`);
  let nftSaleCount = 0;
  let matchingCollectionCount = 0;
  let aboveMinSolCount = 0;


  // Inside your webhook handler - add this after parsing the payload
  for (const transaction of payload) {
    if (transaction.type === 'NFT_SALE') {
      const { nfts, amount, buyer, seller, signature } = transaction.events.nft;
      const solAmount = amount / 1e9; // Convert lamports to SOL

      // Log ALL sale details regardless of filters
      logger.info(`NFT Sale Details:
        Price: ${solAmount} SOL
        Collection Merkle Trees: ${nfts.map(nft => nft.merkleTree).join(', ')}
        Target Collection: ${config.merkleTree}
        Meets Collection Filter: ${nfts.some(nft => nft.merkleTree === config.merkleTree)}
        Meets Price Filter: ${solAmount >= config.minSolValue}
        Signature: ${signature}
      `);

      // Continue with your normal filtering...
    }
  }
  
  // Process each transaction in the payload
  for (const transaction of payload) {
    // Filter for NFT_SALE transactions
    if (transaction.type === 'NFT_SALE') {
      nftSaleCount++;
      const { nfts, amount, buyer, seller, signature } = transaction.events.nft;

      // Skip if no NFTs in the transaction
      if (!nfts || nfts.length === 0) {
        logger.debug('Skipping: No NFTs in transaction');
        continue;
      }

      // Filter by collection if merkleTree is specified in config
      if (config.merkleTree && !nfts.some(nft => nft.merkleTree === config.merkleTree)) {
        logger.debug(`Skipping sale: NFT not in target collection ${config.merkleTree}`);
        continue;
      }
      matchingCollectionCount++;

      // Filter by minimum SOL value if specified
      const solAmount = amount / 1e9; // Convert lamports to SOL
      if (config.minSolValue && solAmount < config.minSolValue) {
        logger.debug(`Skipping sale: Amount ${solAmount} SOL below minimum threshold ${config.minSolValue} SOL`);
        continue;
      }
      aboveMinSolCount++;

      // Process the valid cNFT sale
      logger.info(`Valid cNFT sale detected: ${solAmount} SOL, Signature: ${signature}`);

      // Format sale details for notification
      const saleDetails = {
        price: solAmount,
        buyer,
        seller,
        signature,
        nfts: nfts.map(nft => ({
          name: nft.name,
          collection: nft.collection?.name || 'Unknown',
          merkleTree: nft.merkleTree
        }))
      };

      // Send notification to Discord if webhook URL is configured
      if (config.discordWebhookUrl) {
        try {
          logger.info(`Sending Discord notification for sale: ${signature}`);
          const notificationResult = await sendDiscordNotification(saleDetails);
          if (notificationResult) {
            logger.info('Discord notification sent successfully');
          } else {
            logger.warn('Discord notification failed to send');
          }
        } catch (notificationError) {
          logger.error('Failed to send Discord notification:', notificationError);
        }
      } else {
        logger.warn('Discord webhook URL not configured, skipping notification');
      }
    }
  }

  logger.info(`Processed webhook: Found ${nftSaleCount} NFT sales, ${matchingCollectionCount} matching collection, ${aboveMinSolCount} above min SOL threshold`);
}

module.exports = router;
