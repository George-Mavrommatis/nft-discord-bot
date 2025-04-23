const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const rateLimiter = require('../utils/rate-limiter');

// Simple message queue for Discord
class MessageQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  add(message) {
    this.queue.push(message);
    if (!this.processing) {
      this.process();
    }
  }

  async process() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const message = this.queue.shift();

    try {
      if (rateLimiter.canConsume()) {
        await this.sendMessage(message);
      } else {
        // If we can't consume a rate limit token, put message back and wait
        this.queue.unshift(message);
        setTimeout(() => this.process(), 1000);
        return;
      }
    } catch (error) {
      logger.error(`Discord error: ${error.message}`);
      // If it's a rate limit error, put message back in the queue
      if (error.response && error.response.status === 429) {
        this.queue.unshift(message);
        const retryAfter = error.response.headers['retry-after'] * 1000 || 5000;
        setTimeout(() => this.process(), retryAfter);
        return;
      }
    }

    // Process next message
    setImmediate(() => this.process());
  }

  async sendSimpleSaleNotification(saleData) {
    const { name, price, signature } = saleData;

    const discordMsg = {
      content: `A ${name} has been sold but it ain't Silver or Gold!`
    };

    try {
      logger.info(`Posting simple sale notification for ${signature}`);
      await axios.post(config.DISCORD_WEBHOOK_URL, discordMsg);
      // If you're tracking recent messages
      if (this.recentMessages) this.recentMessages.add(signature);
      return true;
    } catch (error) {
      logger.error('Discord Error', { error: error.message, signature });
      return false;
    }
  }


  // Change this in sendMessage method
  async sendMessage(message) {
    try {
      logger.debug('Sending Discord message', { message });
      // Use the same variable name as in other methods
      const response = await axios.post(config.DISCORD_WEBHOOK_URL, message);
      logger.debug('Discord response', { status: response.status });
      return response;
    } catch (error) {
      // Improve error logging
      logger.error('Discord message error', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      // Rethrow for rate limit handling
      throw error;
    }
  }  
}

const messageQueue = new MessageQueue();

const discordService = {
  /**
   * Format and send NFT sale notification to Discord
   */
  async sendNftSaleNotification(saleData) {
    const { metadata, price, marketplace, signature, nftEvent } = saleData;

    const discordMsg = {
      embeds: [{
        title: `💎 ${metadata.name || "cNFT"} Sold!`,
        description: `**${price} SOL** on ${marketplace}\n[View Transaction](https://solscan.io/tx/${signature})`,
        color: 0x00FF00,
        fields: [
          { name: "Buyer", value: `\`${nftEvent.buyer?.slice(0, 8)}...\``, inline: true },
          { name: "Seller", value: `\`${nftEvent.seller?.slice(0, 8)}...\``, inline: true },
          { name: "Traits", value: metadata.attributes.map(a => `• ${a.trait_type}: ${a.value}`).join('\n') || 'None' }
        ],
        thumbnail: { url: metadata.image || "" },
        footer: { text: "Bongo's Silver/Gold Sales Monitor" }
      }]
    };

    // Add to queue for sending
    messageQueue.add(discordMsg);
    return true;
  },

  /**
   * Send test webhook confirmation to Discord
   */
  async sendTestWebhookConfirmation() {
    const testMsg = {
      embeds: [{
        title: "Helius Test Webhook Received ✅",
        description: "Your webhook is configured correctly and ready to receive data.",
        color: 65280
      }]
    };

    messageQueue.add(testMsg);
    return true;
  }
};

module.exports = discordService;
