const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

// Initialize a queue for message handling
const messageQueue = {
  messages: [],
  processing: false,

  // Add a message to the queue
  add: function(message) {
    this.messages.push(message);
    if (!this.processing) {
      this.processQueue();
    }
  },

  // Process messages in the queue
  processQueue: async function() {
    if (this.messages.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const message = this.messages.shift();

    try {
      await discordService.sendMessage(message);
      // Wait a short time to avoid rate limiting
      setTimeout(() => this.processQueue(), 1000);
    } catch (error) {
      logger.error(`Error sending Discord message: ${error.message}`);
      // If rate limited, wait longer
      if (error.response && error.response.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 10;
        logger.warn(`Discord rate limited. Retrying after ${retryAfter} seconds`);
        setTimeout(() => this.processQueue(), retryAfter * 1000);
      } else {
        // For other errors, continue with next message after delay
        setTimeout(() => this.processQueue(), 2000);
      }
    }
  }
};

const discordService = {
  /**
   * Send a message to Discord
   */
  async sendMessage(message) {
    try {
      logger.debug('Sending Discord message');
      const response = await axios.post(config.DISCORD_WEBHOOK_URL, message);
      logger.debug('Discord response', { status: response.status });
      return response;
    } catch (error) {
      // Log the error details
      logger.error('Discord Error', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  },

  /**
   * Send a simple notification for NFT sales
   */
  async sendSimpleSaleNotification(sale) {
    try {
      const message = {
        content: `NFT Sale: ${sale.name} sold for ${sale.price} SOL on ${sale.marketplace}!`,
      };

      messageQueue.add(message);
      return true;
    } catch (error) {
      logger.error(`Error creating simple sale notification: ${error.message}`);
      return false;
    }
  },

  /**
   * Send a rich notification for NFT sales with embed
   */
  async sendNftSaleNotification(sale) {
    try {
      const embed = {
        title: `${sale.metadata.name} Sold!`,
        description: `Price: ${sale.price} SOL`,
        color: 0x00ff00, // Green
        thumbnail: {
          url: sale.metadata.image
        },
        fields: [
          {
            name: 'Marketplace',
            value: sale.marketplace,
            inline: true
          }
        ],
        footer: {
          text: `Transaction: ${sale.signature.substring(0, 8)}...`
        },
        timestamp: new Date().toISOString()
      };

      // Add attributes as fields if available
      if (sale.metadata.attributes && Array.isArray(sale.metadata.attributes)) {
        sale.metadata.attributes.forEach(attr => {
          if (attr.trait_type && attr.value) {
            embed.fields.push({
              name: attr.trait_type,
              value: attr.value.toString(),
              inline: true
            });
          }
        });
      }

      const message = {
        embeds: [embed]
      };

      messageQueue.add(message);
      return true;
    } catch (error) {
      logger.error(`Error creating NFT sale notification: ${error.message}`);
      return false;
    }
  },

  /**
   * Send test webhook confirmation
   */
  async sendTestWebhookConfirmation() {
    try {
      logger.info('Preparing test webhook confirmation message');

      const testMsg = {
        embeds: [{
          title: "Helius Test Webhook Received ✅",
          description: "Your webhook is configured correctly and ready to receive data.",
          color: 65280 // Green color
        }]
      };

      // Add message to queue instead of direct send
      messageQueue.add(testMsg);
      return true;
    } catch (error) {
      logger.error(`Error sending test webhook confirmation: ${error.message}`);
      return false;
    }
  }
};

module.exports = discordService;
