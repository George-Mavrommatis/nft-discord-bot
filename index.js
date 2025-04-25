require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { sendDiscordNotification, sendFlashyDiscordNotification } = require('./utils/discord');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Health Check Endpoint
app.get('/', (req, res) => res.status(200).send('Bot is running!'));

// Webhook Endpoint
app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;

    // Respond quickly to avoid retry calls
    res.status(200).send('OK');

    if (!Array.isArray(payload) || payload.length === 0) {
      logger.info('Empty or invalid payload received.');
      return;
    }

    for (const transaction of payload) {
      if (transaction.type === 'NFT_SALE') {
        const { amount, buyer, seller, signature, nfts } = transaction.events.nft;
        const solAmount = amount / 1e9;

        const saleDetails = {
          price: solAmount,
          buyer,
          seller,
          signature,
          nfts: nfts.map(nft => ({
            name: nft.name,
            collection: nft.collection?.name || 'Unknown',
            traits: nft.attributes || []
          }))
        };

        // General Notification for all sales
        await sendDiscordNotification(saleDetails);

        // Special Notification for Silver/Gold traits
        const matchingTraits = ['Silver', 'Gold'];
        const hasMatchingTrait = saleDetails.nfts.some(nft =>
          nft.traits.some(trait => trait.attribute_type === 'Body' && matchingTraits.includes(trait.value))
        );

        if (hasMatchingTrait) {
          logger.info(`Trait Match Detected (Silver/Gold) - Sending Special Notification`);
          await sendFlashyDiscordNotification(saleDetails);
        }
      }
    }
  } catch (error) {
    logger.error(`Error processing webhook: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});

// Start the Server
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
