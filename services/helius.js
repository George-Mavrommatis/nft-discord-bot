const axios = require('axios');
const logger = require('../utils/logger');

const setupHeliusWebhook = async () => {
  const webhookURL = `${process.env.BASE_URL}/webhook`;
  try {
    const response = await axios.post(
      `https://api.helius.xyz/v0/webhooks?api-key=${process.env.HELIUS_API_KEY}`,
      {
        webhookURL,
        transactionTypes: ['NFT_SALE'],
        accountAddresses: [process.env.COLLECTION_ADDRESS],
        webhookType: 'enhanced',
        authHeader: process.env.AUTH_TOKEN
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    logger.info('Helius webhook setup successfully:', response.data);
  } catch (error) {
    logger.error('Failed to set up Helius webhook:', error.message);
  }
};

module.exports = { setupHeliusWebhook };
