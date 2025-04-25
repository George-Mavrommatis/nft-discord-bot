// utils/discord.js
const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

async function sendDiscordNotification(saleDetails) {
  try {
    logger.info(`Preparing Discord notification for sale: ${saleDetails.signature}`);

    // Check webhook URL
    if (!config.discordWebhookUrl) {
      logger.error('Discord webhook URL not configured');
      return false;
    }

    // Format the Discord message
    const embedColor = 0x9945FF; // Solana purple
    const message = {
      embeds: [{
        title: `NFT Sale - ${(saleDetails.price).toFixed(2)} SOL`,
        color: embedColor,
        fields: [
          {
            name: 'Collection',
            value: saleDetails.nfts[0]?.collection?.name || 'Unknown',
            inline: true
          },
          {
            name: 'NFT',
            value: saleDetails.nfts[0]?.name || 'Unknown',
            inline: true
          },
          {
            name: 'Price',
            value: `${saleDetails.price.toFixed(2)} SOL`,
            inline: true
          },
          {
            name: 'Buyer',
            value: `\`${saleDetails.buyer.substring(0, 8)}...\``,
            inline: true
          },
          {
            name: 'Seller',
            value: `\`${saleDetails.seller.substring(0, 8)}...\``,
            inline: true
          }
        ],
        url: `https://explorer.solana.com/tx/${saleDetails.signature}`,
        timestamp: new Date().toISOString()
      }]
    };

    // Send the Discord notification with detailed error logging
    logger.info(`Sending Discord notification to: ${config.discordWebhookUrl.substring(0, 20)}...`);
    const response = await axios.post(config.discordWebhookUrl, message);

    if (response.status === 204) {
      logger.info(`Discord notification sent successfully for sale: ${saleDetails.signature}`);
      return true;
    } else {
      logger.warn(`Unexpected Discord response: ${response.status}`);
      return false;
    }
  } catch (error) {
    logger.error('Error sending Discord notification:', error.message);
    if (error.response) {
      logger.error('Discord API response:', error.response.status, error.response.data);
    }
    throw error; // Re-throw to be caught by the calling function
  }
}

module.exports = { sendDiscordNotification };
