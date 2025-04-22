const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "https://discord.com/api/webhooks/1364283423128027199/N4jx0_Y85KPLykWbc3zakkTK_Beygo3Dg1h5Hl1MogKq1QbuE3dpB3PBH9mQVG3qosbj";

// Example: Only notify if trait_type = "Background" is "Pink" OR "Eyes" is "Laser"
const TRAIT_FILTERS = [
  { trait_type: "Body", value: "Silver" },
  { trait_type: "Body", value: "Gold" },
];

// Utility: Checks if any desired trait is present in NFT's attributes
function matchesTraits(attributes) {
  return TRAIT_FILTERS.some(filter =>
    attributes.some(att => att.trait_type === filter.trait_type && att.value === filter.value)
  );
}

app.post("/hel-webhook", async (req, res) => {
  try {
    console.log("Webhook received:", JSON.stringify(req.body).slice(0, 500) + "...");

    // Handle both formats: array of transactions or {data: [transactions]}
    const transactions = Array.isArray(req.body) ? req.body : (req.body.data || []);

    console.log(`Processing ${transactions.length} transactions`);

    // Process each transaction
    for (const tx of transactions) {
      console.log(`Transaction type: ${tx.type || 'unknown'}`);

      // For debugging: Post every NFT sale to Discord temporarily
      // This helps us see if we're getting data but filtering is wrong
      if (tx.type === 'NFT_SALE' || (tx.events && tx.events.nft)) {
        const nftData = tx.events?.nft || {};
        const nftInfo = nftData.nfts?.[0] || {};
        const metadata = nftInfo.metadata || {};
        const attributes = metadata.attributes || [];

        console.log(`Found NFT sale: ${metadata.name || 'Unknown NFT'}`);
        console.log(`Attributes: ${JSON.stringify(attributes)}`);

        // Debug message to Discord
        const debugMsg = {
          embeds: [{
            title: `⚠️ DEBUG: ${metadata.name || "Unknown NFT"} SOLD`,
            description: `**Tx:** [View](https://solscan.io/tx/${tx.signature||nftData.signature})`,
            fields: [
              {name: "Buyer", value: nftData.buyer || tx.buyer || "Unknown", inline:true},
              {name: "Seller", value: nftData.seller || tx.seller || "Unknown", inline:true},
              {name: "Price", value: `${((nftData.amount || tx.price || 0)/1e9).toFixed(2)} SOL`, inline:true},
              {name: "Has Matching Traits?", value: matchesTraits(attributes) ? "YES" : "No", inline:false},
              {name: "All Traits", value: attributes.map(a=>`${a.trait_type}: ${a.value}`).join(', ') || "None"},
            ],
            image: { url: metadata.image || "" },
            footer: {text: "DEBUG MODE - All Sales Shown"}
          }]
        };

        try {
          await axios.post(DISCORD_WEBHOOK_URL, debugMsg);
          console.log("Posted to Discord:", tx.signature || nftData.signature);
        } catch (error) {
          console.error("Error posting to Discord:", error.message);
        }
      }
    }

    res.status(200).send("ok");
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).send("Error processing webhook");
  }
});

// Add a simple GET endpoint to test if service is running
app.get("/", (req, res) => {
  res.send("NFT Webhook service is running!");
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
