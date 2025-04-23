const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');

const heliusService = {
  /**
   * Verify if a webhook signature is valid
   */
  verifyWebhookSignature(signature, payload) {
    if (!config.webhookSecret) {
      logger.warn('No webhook secret configured, skipping signature verification');
      return true;
    }

    try {
      // Create hmac with secret
      const hmac = crypto.createHmac('sha256', config.webhookSecret);

      // Update with payload (should be the raw body string)
      hmac.update(payload);

      // Get the digest in hex format
      const digest = hmac.digest('hex');

      // Verify signature matches digest
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
      );
    } catch (error) {
      logger.error('Error verifying webhook signature', { error: error.message });
      return false;
    }
  },

  /**
   * Process webhook transactions to find matching NFT sales
   */
   processTransactions(transactions) {
     const results = {
       matched: [],      // Silver/Gold sales
       otherSales: [],   // Other sales
       skipped: [],      // Items to skip (non-sales, wrong collection, etc.)
       errors: []
     };


     // Check for target traits
  const hasTargetTrait = config.traitFilters.some(filter =>
    attributes.some(attr =>
      attr.trait_type === filter.trait_type &&
      attr.value === filter.value
    )
  );

  // After your trait verification check
  if (!hasTargetTrait(attributes)) {
    console.log(`[${timestamp}] Non-matching trait sale found`);

    // Send a simple message for non-matching sales
    const simpleSaleMsg = {
      content: `A ${metadata.name || "Wegen"} has been sold but it ain't Silver or Gold!`
    };

    try {
      console.log(`[${timestamp}] Posting simple sale notification`);
      await axios.post(DISCORD_WEBHOOK_URL, simpleSaleMsg);
      recentMessages.add(tx.signature);
    } catch (discordError) {
      console.error(`[${timestamp}] Discord Error:`, discordError.message);
    }

    continue; // Continue to next transaction
  }

  if (hasTargetTrait) {
    // Add to matched results for rich embeds
    results.matched.push({
      signature: tx.signature,
      metadata,
      price,
      marketplace,
      nftEvent
    });
  } else {
    // Add to otherSales for simple notifications
    results.otherSales.push({
      signature: tx.signature,
      name: metadata.name || "Wegen",
      price
    });
  }


    if (!Array.isArray(transactions) || transactions.length === 0) {
      return results;
    }

    for (const tx of transactions) {
      try {
        // Extract NFT event
        const nftEvent = tx.events?.nft;
        if (!nftEvent) {
          results.skipped.push({ reason: 'No NFT event', signature: tx.signature });
          continue;
        }

        // Extract compressed NFT data
        const cNFT = nftEvent.nfts?.[0];
        if (!cNFT) {
          results.skipped.push({ reason: 'No compressed NFT data', signature: tx.signature });
          continue;
        }

        // Verify collection
        const collectionId = cNFT.merkleTree;
        if (collectionId !== config.merkleTree) {
          results.skipped.push({
            reason: 'Collection mismatch',
            signature: tx.signature,
            collection: collectionId
          });
          continue;
        }

        // Extract metadata
        const metadata = cNFT.metadata || {};
        const attributes = metadata.attributes || [];
        const price = nftEvent.amount ? (nftEvent.amount / 1e9).toFixed(2) : 0;

        // Verify minimum price
        if (parseFloat(price) < config.minSolValue) {
          results.skipped.push({
            reason: 'Below minimum price',
            signature: tx.signature,
            price
          });
          continue;
        }

        // Check for target traits
        const hasTargetTrait = config.traitFilters.some(filter =>
          attributes.some(attr =>
            attr.trait_type === filter.trait_type &&
            attr.value === filter.value
          )
        );


// all trait sales
        if (!hasTargetTrait) {
          results.skipped.push({
            reason: 'No matching traits',
            signature: tx.signature
          });
          continue;
        }

        // Determine marketplace
        const marketplace = config.marketplaces[nftEvent.source] || 'Unknown';

        // Add to matched results
        results.matched.push({
          signature: tx.signature,
          metadata,
          price,
          marketplace,
          nftEvent
        });
      } catch (error) {
        results.errors.push({
          signature: tx.signature,
          error: error.message
        });
      }
    }

    return results;
  },

  /**
   * Send a test webhook to Helius
   */
  async sendTestWebhook() {
    if (!config.heliusApiKey) {
      throw new Error('Helius API key not configured');
    }

    try {
      const response = await axios.post(
        `https://api.helius.xyz/v0/webhooks/test?api-key=${config.heliusApiKey}`
      );
      return response.data;
    } catch (error) {
      logger.error('Error sending test webhook', { error: error.message });
      throw error;
    }
  }
};

module.exports = heliusService;
