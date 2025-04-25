const axios = require('axios');
const logger = require('./logger');

async function sendDiscordNotification(saleDetails) {
  const { price, buyer, seller, signature, nfts } = saleDetails;
  const nftInfo = nfts.map(nft =>
    `**Name**: ${nft.name}\n**Collection**: ${nft.collection}\nTraits: ${nft.traits.map(trait => `\`${trait.attribute_type}: ${trait.value}\``).join(', ')}`
  ).join('\n\n');

  const message = {
    embeds: [
      {
        title: `📢 New NFT Sale`,
        color: 0x1e90ff,
        fields: [
          { name: 'Price (SOL)', value: `**${price}**`, inline: true },
          { name: 'Buyer', value: buyer, inline: true },
          { name: 'Seller', value: seller, inline: true },
          { name: 'NFT Info', value: nftInfo },
          {
            name: 'Transaction',
            value: `[View on Solana Explorer](https://explorer.solana.com/tx/${signature})`
          }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    await axios.post(process.env.DISCORD_WEBHOOK_URL, message, {
      headers: { 'Content-Type': 'application/json' }
    });
    logger.info('General Discord notification sent successfully.');
  } catch (error) {
    logger.error(`Failed to send Discord notification: ${error.message}`);
  }
}

async function sendFlashyDiscordNotification(saleDetails) {
  const { price, buyer, seller, signature, nfts } = saleDetails;

  const message = {
    embeds: [
      {
        title: `✨🚀 Flashy NFT Sale Alert 🚀✨`,
        description: `A spectacular NFT was just sold!`,
        color: 0xf1c40f,
        fields: [
          { name: 'Price (SOL)', value: `**${price}**`, inline: true },
          { name: 'Buyer', value: buyer, inline: true },
          { name: 'Seller', value: seller, inline: true },
          {
            name: 'Transaction',
            value: `[View on Solana Explorer](https://explorer.solana.com/tx/${signature})`
          }
        ],
        thumbnail: {
          url: 'https://cdn-icons-png.flaticon.com/512/868/868786.png' // Replace with an appropriate image
        },
        footer: {
          text: 'Trait: Body - Silver/Gold',
          icon_url: 'https://i.imgur.com/AfFp7pu.png'
        },
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    await axios.post(process.env.DISCORD_WEBHOOK_URL, message, {
      headers: { 'Content-Type': 'application/json' }
    });
    logger.info('Flashy Discord notification sent successfully.');
  } catch (error) {
    logger.error(`Failed to send flashy Discord notification: ${error.message}`);
  }
}

module.exports = { sendDiscordNotification, sendFlashyDiscordNotification };
