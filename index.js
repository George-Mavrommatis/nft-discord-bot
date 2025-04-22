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
  DEBUG: true
};

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
    console.log(`[${timestamp}] RAW BODY:`, JSON.stringify(req.body).slice(0, 200) + "...");

    // Handle test webhook
    if (req.body?.type === "test") {
      console.log(`[${timestamp}] TEST WEBHOOK RECEIVED`);
      await axios.post(DISCORD_WEBHOOK_URL, {
        embeds: [{ title: "Test Received ✅", color: 65280 }]
      });
      return res.status(200).json({ success: true });
    }

    // Process cNFT transactions
    const transactions = req.body?.data || [];
    console.log(`[${timestamp}] Processing ${transactions.length} transactions`);

    for (const tx of transactions) {
      try {
        // Extract cNFT data from transaction
        const nftEvent = tx.events?.nft;
        if (!nftEvent) {
          console.log(`[${timestamp}] No NFT event found`);
          continue;
        }

        // Get first cNFT in transaction (usually only one)
        const cNFT = nftEvent.nfts?.[0];
        if (!cNFT) {
          console.log(`[${timestamp}] No NFT data found`);
          continue;
        }

        // Verify collection
        const collectionId = cNFT.merkleTree;
        if (collectionId !== CONFIG.MERKLE_TREE) {
          console.log(`[${timestamp}] Skipping - Wrong collection: ${collectionId}`);
          continue;
        }

        // Extract metadata
        const metadata = cNFT.metadata || {};
        const attributes = metadata.attributes || [];
        const price = nftEvent.amount ? (nftEvent.amount / 1e9).toFixed(2) : 'Unknown';

        // Check traits
        if (!hasTargetTrait(attributes)) {
          console.log(`[${timestamp}] Skipping - No matching traits`);
          continue;
        }

        // Build Discord message
        const discordMsg = {
          embeds: [{
            title: `🎉 ${metadata.name || "cNFT"} Sold!`,
            description: `**${price} SOL** | [View Transaction](https://solscan.io/tx/${tx.signature})`,
            color: 0x00FF00,
            fields: [
              { name: "Buyer", value: `\`${nftEvent.buyer?.slice(0, 8)}...\``, inline: true },
              { name: "Seller", value: `\`${nftEvent.seller?.slice(0, 8)}...\``, inline: true },
              { name: "Traits", value: attributes.map(a => `• ${a.trait_type}: ${a.value}`).join('\n') || 'None' }
            ],
            thumbnail: { url: metadata.image || "" },
            footer: { text: "cNFT Sales Bot | Bongo's Silver/Gold Sales" }
          }]
        };

        // Send to Discord
        console.log(`[${timestamp}] Posting to Discord: ${metadata.name}`);
        await axios.post(DISCORD_WEBHOOK_URL, discordMsg);

      } catch (txError) {
        console.error(`[${timestamp}] Transaction processing error:`, txError);
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
  console.log(`[CONFIG] Looking for traits:`, CONFIG.TRAIT_FILTERS);
});
