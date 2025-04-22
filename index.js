const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// CONFIGURATION
const CONFIG = {
  // Only notify for these traits
  TRAIT_FILTERS: [
    { trait_type: "Body", value: "Silver" },
    { trait_type: "Body", value: "Gold" }
  ],
  // Merkle tree for the collection
  MERKLE_TREE: "88fLq9b2Hk1TLj3H9MQiQL1x5n8BAdvqk8SGMgbzmfSH",
  // Enable detailed logging
  DEBUG: true
};

/**
 * Checks if NFT has any of our target traits
 */
function hasTargetTrait(attributes) {
  if (!attributes || !Array.isArray(attributes)) return false;

  return CONFIG.TRAIT_FILTERS.some(filter =>
    attributes.some(attr =>
      attr.trait_type === filter.trait_type &&
      attr.value === filter.value
    )
  );
}

/**
 * Formats SOL amount from lamports
 */
function formatSol(lamports) {
  return (lamports / 1e9).toFixed(2);
}

/**
 * Get matching trait that triggered notification
 */
function getMatchingTrait(attributes) {
  for (const filter of CONFIG.TRAIT_FILTERS) {
    const match = attributes.find(attr =>
      attr.trait_type === filter.trait_type &&
      attr.value === filter.value
    );
    if (match) return `${match.trait_type}: ${match.value}`;
  }
  return null;
}

/**
 * Create Discord embed for a sale
 */
function createSaleEmbed(sale) {
  const nft = sale.nft || {};
  const metadata = nft.metadata || {};
  const attributes = metadata.attributes || [];
  const matchingTrait = getMatchingTrait(attributes);

  // Choose emoji based on trait
  let emoji = "🔥";
  if (matchingTrait && matchingTrait.includes("Gold")) emoji = "🏆";
  if (matchingTrait && matchingTrait.includes("Silver")) emoji = "🥈";

  return {
    embeds: [{
      title: `${emoji} ${metadata.name || "cNFT"} SOLD`,
      description: `**Price: ${formatSol(sale.amount)} SOL**\n[View Transaction](https://solscan.io/tx/${sale.signature})`,
      color: matchingTrait?.includes("Gold") ? 16766720 : 10070709, // Gold or Silver color
      fields: [
        { name: "Buyer", value: `\`${sale.buyer.slice(0, 8)}...\``, inline: true },
        { name: "Seller", value: `\`${sale.seller.slice(0, 8)}...\``, inline: true },
        { name: "Marketplace", value: sale.source || "Unknown", inline: true },
        { name: "Special Trait", value: matchingTrait || "None", inline: false },
      ],
      thumbnail: { url: metadata.image || "" },
      timestamp: new Date().toISOString(),
      footer: { text: "Bongo's SG Sales Bot • Silver/Gold Sales Only" }
    }]
  };
}

/**
 * Create Discord embed for test webhook
 */
function createTestEmbed() {
  return {
    embeds: [{
      title: "Test Webhook Received",
      description: "This is a confirmation that your webhook is properly configured.",
      color: 65280, // Green
      footer: { text: "Helius Test Webhook" }
    }]
  };
}

/**
 * Main webhook handler
 */
app.post("/webhook", async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Webhook received`);

  try {
    // Check if this is a test webhook
    if (req.body.webhookId === "test") {
      console.log(`[${timestamp}] Test webhook detected`);
      console.log(`[${timestamp}] Posting to Discord`);

      await axios.post(DISCORD_WEBHOOK_URL, createTestEmbed())
        .catch(error => {
          console.log(`[${timestamp}] Discord post error ${JSON.stringify(error.response?.data || error.message)}`);
        });

      return res.status(200).send({ success: true });
    }

    // Handle cNFT sale events
    const payload = Array.isArray(req.body) ? req.body : (req.body.data || []);

    if (CONFIG.DEBUG) {
      console.log(`[${timestamp}] Processing ${payload.length} events`);
    }

    for (const event of payload) {
      // Skip non-sales
      if (event.type !== "NFT_SALE") {
        continue;
      }

      const nftData = event.events?.nft || {};

      // Skip if not from our collection
      if (nftData.merkleTree !== CONFIG.MERKLE_TREE) {
        if (CONFIG.DEBUG) {
          console.log(`[${timestamp}] Skipping - not from target collection`);
        }
        continue;
      }

      // Get the NFT metadata (first one if multiple)
      const nft = nftData.nfts?.[0] || {};
      const metadata = nft.metadata || {};
      const attributes = metadata.attributes || [];

      if (CONFIG.DEBUG) {
        console.log(`[${timestamp}] Processing sale for: ${metadata.name}`);
      }

      // Check if NFT has target traits
      if (!hasTargetTrait(attributes)) {
        if (CONFIG.DEBUG) {
          console.log(`[${timestamp}] Skipping - no matching traits`);
        }
        continue;
      }

      // Create the embed for Discord
      const embed = createSaleEmbed({
        nft: nft,
        amount: nftData.amount || 0,
        buyer: nftData.buyer || "Unknown",
        seller: nftData.seller || "Unknown",
        signature: event.signature || nftData.signature,
        source: nftData.source || "Unknown"
      });

      // Post to Discord
      console.log(`[${timestamp}] Posting sale to Discord`);
      await axios.post(DISCORD_WEBHOOK_URL, embed)
        .catch(error => {
          console.log(`[${timestamp}] Discord post error ${JSON.stringify(error.response?.data || error.message)}`);
        });
    }

    res.status(200).send({ success: true });
  } catch (error) {
    console.log(`[${timestamp}] Error processing webhook: ${error.message}`);
    res.status(500).send({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Helius cNFT Sales Bot is running!");
});

// Start the server
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server started on port ${PORT}`);
});
