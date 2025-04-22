
```js
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
  { trait_type: "Background", value: "Pink" },
  { trait_type: "Eyes", value: "Laser" },
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
          description: `**Tx:** [View](https://solscan.io/tx/${event.signature})`,
          fields: [
            {name: "Buyer", value: event.buyer, inline:true},
            {name: "Seller", value: event.seller, inline:true},
            {name: "Price", value: `${(event.price/1e9).toFixed(2)} SOL`, inline:true},
            {name: "Traits", value: metadata.attributes && metadata.attributes.map(a=>`${a.trait_type}: ${a.value}`).join(', ') || "None"},
          ],
          image: { url: metadata.image || "" },
          footer: {text: "Powered by Helius"}
        }]
      };
      await axios.post(DISCORD_WEBHOOK_URL, saleMsg);
    }
  }
  res.status(200).send("ok");
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
```
**Setup Steps:**
1. Replace `YOUR_DISCORD_WEBHOOK_URL` with your Discord channel webhook (see [here](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)).
2. Deploy this server somewhere public (e.g., Render, Heroku, Digital Ocean, Fly.io, or your own VPS).
3. In Helius, set your webhook’s **Target URL** to `https://your-app-url.com/hel-webhook`.
4. Update `TRAIT_FILTERS` to your desired two traits.

---

## **3. Testing**

- Sell/list NFTs matching your traits on Solana, monitor Discord channel.
- Only trait-matching sales post; everything else is filtered out.

---

## **4. Optional: Extensions**

- Format messages better (rarity info, marketplace link, etc).
- Support multiple collections or multiple trait combinations.
- Add error handling/logging for production.

---

**Let me know which two traits you're interested in, and your comfort level (do you want a deploy guide for a specific host, or help converting to Python or another stack?).** I'm happy to expand with exactly what you need!
