const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

/**
 * Send a notification to Discord about a cNFT sale
 * @param {Object} saleDetails - Details of the sale
 * @returns {Promise<void>}
 */
async function sendDiscordNotification(saleDetails) {
  const { price, buyer, seller, signature, nfts } = saleDetails;

  // Format the NFT names for display
  const nftNames = nfts.map(nft => nft.name).join(', ');
  const collectionName = nfts[0]?.collection || 'Unknown Collection';

  // Create Discord embed
  const embed = {
    title: '🎉 New cNFT Sale',
    color: 0x6b46c1, // Purple color
    fields: [
      { name: 'NFT', value: nftNames, inline: false },
      { name: 'Collection', value: collectionName, inline: false },
      { name: 'Price', value: `${price.toFixed(3)} SOL`, inline: true },
      { name: 'Buyer', value: `[${buyer.substring(0, 8)}...](https://explorer.solana.com/address/${buyer})`, inline: true },
      { name: 'Seller', value: `[${seller.substring(0, 8)}...](https://explorer.solana.com/address/${seller})`, inline: true }
    ],
    footer: {
      text: 'Powered by Helius'
    },
    timestamp: new Date(),
    url: `https://explorer.solana.com/tx/${signature}`
  };

  // Send to Discord
  try {
    await axios.post(config.discordWebhookUrl, {
      embeds: [embed]
    });
    return true;
  } catch (error) {
    logger.error('Discord notification error:', error.message);
    throw error;
  }
}

module.exports = {
  sendDiscordNotification
};
