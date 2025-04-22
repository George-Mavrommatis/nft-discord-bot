const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// CONFIGURATION
const CONFIG = {
  TRAIT_FILTERS: [
    { trait_type: "Body", value: "Silver" },
    { trait_type: "Body", value: "Gold" }
  ],
  MERKLE_TREE: "88fLq9b2Hk1TLj3H9MQiQL1x5n8BAdvqk8SGMgbzmfSH",
  MIN_SOL_VALUE: 0.01,
  RATE_LIMIT: 8,
  DEBUG: true,
  MARKETPLACES: {
    'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K': 'Magic Eden',
    '5SKmrbAxnHV2sgqydDXKlGjk3z8ZVF5KsemPgYQPs1e': 'Hyperspace'
  }
};

// Rate limiting
const recentMessages = new Set();
setInterval(() => recentMessages.clear(), 60000);

// Enhanced logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

function hasTargetTrait(attributes) {
  if (!Array.isArray(attributes)) return false;
  return CONFIG.TRAIT_FILTERS.some(filter =>
    attributes.some(attr =>
      attr.trait_type === filter.trait_type &&
      attr.value === filter.value
    )
  );
}

app.post("/hel-webhook", async (req, res) => {
  const timestamp = new Date().toISOString();
  try {
    if (CONFIG.DEBUG) {
      console.log(`[${timestamp}] RAW BODY KEYS:`, Object.keys(req.body));
    }

    // Handle test webhook
    if (req.body?.type === "test") {
      console.log(`[${timestamp}] TEST WEBHOOK RECEIVED`);
      await axios.post(DISCORD_WEBHOOK_URL, {
        embeds: [{ title: "Test Received ✅", color: 65280 }]
      });
      return res.status(200).json({ success: true });
    }

    // Process compressed NFT transactions
    const transactions = req.body?.accountData || [];
    console.log(`[${timestamp}] Processing ${transactions.length} transactions`);

    // Validate transactions
    if (transactions.length === 0) {
      console.log(`[${timestamp}] WARNING: Empty transaction list`);
      console.log(`[${timestamp}] Payload sample:`, {
        signatures: req.body.signatures?.slice(0, 2),
        accounts: transactions.map(t => t.account)?.slice(0, 2)
      });
      return res.status(400).json({ error: "No transactions found" });
    }

    for (const tx of transactions) {
      try {
        if (recentMessages.size >= CONFIG.RATE_LIMIT) {
          console.log(`[${timestamp}] Rate limit exceeded`);
          break;
        }

        const nftEvent = tx.events?.nft;
        if (!nftEvent) {
          console.log(`[${timestamp}] No NFT event found`);
          continue;
        }

        const cNFT = nftEvent.nfts?.[0];
        if (!cNFT) {
          console.log(`[${timestamp}] No compressed NFT data`);
          continue;
        }

        // Collection verification
        const collectionId = cNFT.merkleTree;
        if (collectionId !== CONFIG.MERKLE_TREE) {
          console.log(`[${timestamp}] Skipping collection ${collectionId}`);
          continue;
        }

        // Metadata extraction
        const metadata = cNFT.metadata || {};
        const attributes = metadata.attributes || [];
        const price = nftEvent.amount ? (nftEvent.amount / 1e9).toFixed(2) : 0;

        // Price filter
        if (price < CONFIG.MIN_SOL_VALUE) {
          console.log(`[${timestamp}] Skipping low value sale: ${price} SOL`);
          continue;
        }

        // Trait verification
        if (!hasTargetTrait(attributes)) {
          console.log(`[${timestamp}] No matching traits found`);
          continue;
        }

        // Marketplace detection
        const marketplace = CONFIG.MARKETPLACES[nftEvent.source] || 'Unknown';

        // Build Discord message
        const discordMsg = {
          embeds: [{
            title: `💎 ${metadata.name || "cNFT"} Sold!`,
            description: `**${price} SOL** on ${marketplace}\n[View Transaction](https://solscan.io/tx/${tx.signature})`,
            color: 0x00FF00,
            fields: [
              { name: "Buyer", value: `\`${nftEvent.buyer?.slice(0, 8)}...\``, inline: true },
              { name: "Seller", value: `\`${nftEvent.seller?.slice(0, 8)}...\``, inline: true },
              { name: "Traits", value: attributes.map(a => `• ${a.trait_type}: ${a.value}`).join('\n') || 'None' }
            ],
            thumbnail: { url: metadata.image || "" },
            footer: { text: "Bongo's Silver/Gold Sales Monitor" }
          }]
        };

        // Send to Discord
        console.log(`[${timestamp}] Posting sale: ${metadata.name}`);
        await axios.post(DISCORD_WEBHOOK_URL, discordMsg);
        recentMessages.add(tx.signature);

      } catch (txError) {
        console.error(`[${timestamp}] TX Error:`, txError.message);
      }
    }

    res.status(200).json({ processed: true });
  } catch (error) {
    console.error(`[${timestamp}] CRITICAL ERROR:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] Health check received`);
  res.send(`Server operational at ${ts}`);
});

// Start server
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server STARTED on port ${PORT}`);
  console.log(`[CONFIG] Monitoring collection: ${CONFIG.MERKLE_TREE}`);
  console.log(`[CONFIG] Minimum value alert: ${CONFIG.MIN_SOL_VALUE} SOL`);
  console.log(`[CONFIG] Rate limit: ${CONFIG.RATE_LIMIT}/minute`);
});
