

// Install dependencies: express, axios, dotenv (optional)
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

require('dotenv').config();
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const PORT = process.env.PORT || 8080;

// Example: Only notify if trait_type = "Background" is "Pink" OR "Eyes" is "Laser"
const TRAIT_FILTERS = [
  { trait_type: "Background", value: "Silver" },
  { trait_type: "Background", value: "Gold" },
];

// Utility: Checks if any desired trait is present in NFT's attributes
function matchesTraits(attributes) {
  return TRAIT_FILTERS.some(filter =>
    attributes.some(att => att.trait_type === filter.trait_type && att.value === filter.value)
  );
}

app.post("/hel-webhook", async (req, res) => {
  // Helius sends batch of events in "data"
  const events = req.body.data;
  for (const event of events) {
    const metadata = event.nft?.metadata || {};
    if (matchesTraits(metadata.attributes || [])) {
      // Format message for Discord
      const saleMsg = {
        embeds: [{
          title: (metadata.name || "NFT") + " SOLD",
          description: "**Tx:** [View](https://solscan.io/tx/"+event.signature+")",
          fields: [
            { name: "Buyer", value: event.buyer, inline: true },
            { name: "Seller", value: event.seller, inline: true },
            { name: "Price", value: "$" + (event.price/1e9).toFixed(2) + " SOL", inline: true },
            { name: "Traits", value: metadata.attributes && metadata.attributes.map(function(a) {
                return a.trait_type + ": " + a.value;
              }).join(", ") || "None" }
          ],
          image: { url: metadata.image || "" },
          footer: { text: "Powered by Helius made by Kingb0ng0" }
        }]
      };
      await axios.post(DISCORD_WEBHOOK_URL, saleMsg);
    }
  }
  res.status(200).send("ok");
});

app.listen(PORT, () => console.log("Listening on " + PORT));
