const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 8080;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "https://discord.com/api/webhooks/1364283423128027199/N4jx0_Y85KPLykWbc3zakkTK_Beygo3Dg1h5Hl1MogKq1QbuE3dpB3PBH9mQVG3qosbj";

// Trait filters - adjust these as needed
const TRAIT_FILTERS = [
  { trait_type: "Body", value: "Silver" },
  { trait_type: "Body", value: "Gold" }
];

// Simple logging to console
function log(message, data) {
  console.log(`[${new Date().toISOString()}] ${message}`, data ? JSON.stringify(data).slice(0, 500) + "..." : "");
}

// Helper to check if attributes match any filter
function matchesTraits(attributes) {
  if (!Array.isArray(attributes)) return false;
  return TRAIT_FILTERS.some(filter =>
    attributes.some(
      attr =>
        attr.trait_type === filter.trait_type &&
        attr.value === filter.value
    )
  );
}

async function postToDiscord(embed) {
  try {
    log("Posting to Discord");
    await axios.post(
      DISCORD_WEBHOOK_URL,
      { embeds: [embed] },
      { headers: { "Content-Type": "application/json" } }
    );
    log("Successfully posted to Discord");
  } catch (error) {
    log("Discord post error", { message: error.message, status: error.response?.status });
  }
}

app.post("/hel-webhook", async (req, res) => {
  // Always respond immediately
  res.status(200).send("ok");

  try {
    log("Webhook received");
    const payload = req.body;

    // Detect if this looks like a test webhook
    const isTestWebhook = payload.type === "test" ||
                         (payload.description && payload.description.includes("test")) ||
                         !payload.events; // Test webhooks often lack an events structure

    if (isTestWebhook) {
      log("Test webhook detected");
      // Handle test webhook - post a simple message
      await postToDiscord({
        title: "Test Webhook Received",
        description: "This is a confirmation that your webhook is properly configured.",
        color: 0x00ff00,
        footer: { text: "Helius Test Webhook" }
      });
      return;
    }

    // Process as regular transaction(s)
    const txs = Array.isArray(payload) ? payload : payload.data ? payload.data : [payload];
    log(`Processing ${txs.length} transactions`);

    for (const tx of txs) {
      // For debugging signature
      const signature = tx.signature || "unknown";
      log(`Processing tx: ${signature}`);

      // Check for compressed NFT sales
      const compressedSales = tx.events?.compressed?.nfts || [];
      log(`Found ${compressedSales.length} compressed NFTs in transaction`);

      for (const nft of compressedSales) {
        const { name, attributes = [], merkleTree } = nft;

        // For debugging trait matching
        log(`NFT: ${name || "Unnamed"}, Has attributes: ${attributes.length > 0}`);

        // Filter by traits if attributes exist
        if (attributes.length > 0 && !matchesTraits(attributes)) {
          log("NFT doesn't match trait filters, skipping");
          continue;
        }

        // Calculate price
        const priceLamports = tx.events?.compressed?.amount || tx.price || tx.amount || 0;
        const priceSol = (priceLamports / 1e9).toFixed(2);

        // Create embed for Discord
        const embed = {
          title: `${name || "NFT"} SOLD`,
          url: `https://solscan.io/tx/${signature}`,
          description: "A listed NFT with target traits just sold!",
          fields: [
            {
              name: "Traits",
              value: attributes.length > 0
                ? attributes.map(attr => `**${attr.trait_type}**: ${attr.value}`).join(", ")
                : "No traits found",
              inline: false
            },
            { name: "Sale Price", value: `${priceSol} SOL`, inline: true },
            { name: "Merkle Tree", value: merkleTree || "Unknown", inline: true }
          ],
          color: 0x64dbff,
          footer: { text: "Powered by Helius" }
        };

        await postToDiscord(embed);
      }
    }
  } catch (error) {
    log("Error processing webhook", { message: error.message, stack: error.stack });
    // Post error to Discord for visibility
    await postToDiscord({
      title: "Webhook Error",
      description: `An error occurred: ${error.message}`,
      color: 0xff0000
    });
  }
});

// Health endpoint
app.get("/", (req, res) => res.send("NFT Webhook running."));

app.listen(PORT, () => {
  log(`Server started on port ${PORT}`);
});
