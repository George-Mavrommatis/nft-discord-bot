const express = require('express');
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { sendDiscordNotification } = require('../utils/discord');

const router = express.Router();

// Webhook endpoint for Helius
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;

    // Log incoming webhook data
    logger.info('Received webhook payload');
    logger.debug('Webhook payload:', JSON.stringify(payload, null, 2));

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

    // Process each transaction in the payload
    for (const transaction of payload) {
      // Filter for NFT_SALE transactions
      if (transaction.type === 'NFT_SALE') {
        const { nfts, amount, buyer, seller, signature } = transaction.events.nft;

        // Skip if no NFTs in the transaction
        if (!nfts || nfts.length === 0) continue;

        // Filter by collection if merkleTree is specified in config
        if (config.merkleTree && !nfts.some(nft => nft.merkleTree === config.merkleTree)) {
          logger.debug(`Skipping sale: NFT not in target collection ${config.merkleTree}`);
          continue;
        }

        // Filter by minimum SOL value if specified
        const solAmount = amount / 1e9; // Convert lamports to SOL
        if (config.minSolValue && solAmount < config.minSolValue) {
          logger.debug(`Skipping sale: Amount ${solAmount} SOL below minimum threshold ${config.minSolValue} SOL`);
          continue;
        }

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
            await sendDiscordNotification(saleDetails);
            logger.info('Discord notification sent successfully');
          } catch (notificationError) {
            logger.error('Failed to send Discord notification:', notificationError);
          }
        }
      }
    }

    // Respond to the webhook - always return OK to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
