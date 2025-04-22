const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080; // Render uses 8080 by default
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

app.post("/hel-webhook", async (req, res) => { // Changed endpoint
  const timestamp = new Date().toISOString();
  try {
    console.log(`[${timestamp}] RAW BODY:`, JSON.stringify(req.body));

    // 1. Handle Helius test webhook
    if (req.body?.type === "test") { // Updated test detection
      console.log(`[${timestamp}] TEST WEBHOOK RECEIVED`);
      await axios.post(DISCORD_WEBHOOK_URL, {
        embeds: [{ title: "Test Received ✅", color: 65280 }]
      });
      return res.status(200).json({ success: true });
    }

    // 2. Process transactions
    const transactions = req.body?.data || [];
    console.log(`[${timestamp}] Processing ${transactions.length} transactions`);

    for (const tx of transactions) {
      const collectionId = tx.events?.nft?.nfts?.[0]?.merkleTree; // Updated path

      if (collectionId !== CONFIG.MERKLE_TREE) {
        console.log(`[${timestamp}] Skipping - Wrong collection`);
        continue;
      }
        // Trait filter
        const attributes = metadata.attributes || [];
        if (!hasTargetTrait(attributes)) {
          console.log(`[${timestamp}] Skipping - No matching traits`);
          continue;
        }

        // Post to Discord
        await axios.post(DISCORD_WEBHOOK_URL, {
          embeds: [{
            title: `MATCH FOUND ${metadata.name}`,
            description: `Silver/Gold NFT sold!`,
            fields: [
              {name: "Traits", value: attributes.map(a => `${a.trait_type}: ${a.value}`).join('\n')}
            ]
          }]
        });
      }
    }

    res.status(200).json({ processed: true });
  } catch (error) {
    console.error(`[${timestamp}] CRITICAL ERROR:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Health check with timestamp
app.get("/", (req, res) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] Health check received`);
  res.send(`Server operational at ${ts}`);
});

// Start server with confirmation
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server STARTED on port ${PORT}`);
  console.log(`[CONFIG] Monitoring collection: ${CONFIG.MERKLE_TREE}`);
  console.log(`[CONFIG] Looking for traits:`, CONFIG.TRAIT_FILTERS);
});
