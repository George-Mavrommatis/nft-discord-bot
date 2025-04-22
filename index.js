const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 8080;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Set your trait filters here (example: trait_type/value pairs)
const TRAIT_FILTERS = [
  { trait_type: "Body", value: "Silver" },
  { trait_type: "Body", value: "Gold" }
];

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
  await axios.post(
    DISCORD_WEBHOOK_URL,
    { embeds: [embed] },
    { headers: { "Content-Type": "application/json" } }
  );
}

app.post("/hel-webhook", async (req, res) => {
  res.status(200).send("ok");

  const payload = req.body;

  // Handle both array and singleton
  const txs = Array.isArray(payload) ? payload : payload.data ? payload.data : [payload];

  for (const tx of txs) {
    // Look for compressed NFT sale event structure
    const compressedSales = tx.events?.compressed?.nfts ?? [];
    for (const nft of compressedSales) {
      const { name, id, metadataUri, attributes = [], merkleTree } = nft;
      if (!matchesTraits(attributes)) continue;

      // Try to get price from events or tx object
      const priceLamports = tx.events?.compressed?.amount || tx.price || tx.amount || 0;
      const priceSol = (priceLamports / 1e9).toFixed(2);

      // Build Discord embed
      const embed = {
        title: `${name || "NFT"} SOLD`,
        url: tx.signature ? `https://solscan.io/tx/${tx.signature}` : undefined,
        description: `A listed NFT with target traits just sold!`,
        fields: [
          { name: "Traits", value: attributes.map(attr => `**${attr.trait_type}**: ${attr.value}`).join(", "), inline: false },
          { name: "Sale Price", value: `${priceSol} SOL`, inline: true },
          { name: "Merkle Tree", value: merkleTree || "Unknown", inline: true }
        ],
        image: metadataUri ? { url: metadataUri } : undefined,
        color: 0x64dbff, // blue
        footer: { text: "Powered by Helius made by Kingb0ng0" }
      };

      await postToDiscord(embed);
    }
  }
});

// Health endpoint
app.get("/", (req, res) => res.send("NFT Webhook running."));

app.listen(PORT, () => {});
