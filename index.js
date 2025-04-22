const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8080;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Configure the traits you want to filter for
// Only NFTs with at least one of these traits will trigger Discord notifications
const TRAIT_FILTERS = [
  { trait_type: "Body", value: "Silver" },
  { trait_type: "Body", value: "Gold" }
  // Add more traits as needed
];

// Check if NFT has any of our desired traits
function hasDesiredTraits(attributes) {
  if (!attributes || !Array.isArray(attributes)) return false;

  return TRAIT_FILTERS.some(filter =>
    attributes.some(attr =>
      attr.trait_type === filter.trait_type &&
      attr.value === filter.value
    )
  );
}

// Post message to Discord
async function postToDiscord(embedData) {
  try {
    await axios({
      method: 'post',
      url: DISCORD_WEBHOOK_URL,
      data: { embeds: [embedData] },
      headers: { 'Content-Type': 'application/json' }
    });
    return true;
  } catch (error) {
    console.error("Error posting to Discord:", error.message);
    return false;
  }
}

// Process compressed NFT sale
function processCompressedNftSale(tx) {
  try {
    // Extract data for compressed NFTs
    const compressedData = tx.events?.compressed;
    if (!compressedData) return null;

    const nft = compressedData.nfts?.[0];
    if (!nft) return null;

    // Check if NFT has desired traits
    if (!hasDesiredTraits(nft.attributes)) return null;

    // Extract price in SOL
    const price = (compressedData.amount / 1e9).toFixed(2);

    // Format matched traits for display
    const matchedTraits = nft.attributes
      .filter(attr =>
        TRAIT_FILTERS.some(filter =>
          filter.trait_type === attr.trait_type &&
          filter.value === attr.value
        )
      )
      .map(attr => `${attr.trait_type}: ${attr.value}`)
      .join(', ');

    // Create embed for Discord
    return {
      title: `${nft.name} Sold!`,
      description: `A rare NFT with matching traits was just sold!`,
      color: 0x5865F2, // Discord blue color
      thumbnail: { url: nft.image },
      fields: [
        { name: "Price", value: `${price} SOL`, inline: true },
        { name: "Collection", value: nft.collection?.name || "Unknown", inline: true },
        { name: "Matching Traits", value: matchedTraits, inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: "Powered by Helius made by Kingb0ng0" }
    };
  } catch (error) {
    console.error("Error processing compressed NFT:", error);
    return null;
  }
}

// Process standard NFT sale
function processStandardNftSale(tx) {
  try {
    // Handle traditional NFT sale format
    if (tx.type !== 'NFT_SALE') return null;

    const nft = tx.nft;
    if (!nft) return null;

    // Check if NFT has desired traits
    if (!hasDesiredTraits(nft.metadata?.attributes)) return null;

    // Extract price in SOL
    const price = (tx.amount / 1e9).toFixed(2);

    // Format matched traits for display
    const matchedTraits = nft.metadata?.attributes
      .filter(attr =>
        TRAIT_FILTERS.some(filter =>
          filter.trait_type === attr.trait_type &&
          filter.value === attr.value
        )
      )
      .map(attr => `${attr.trait_type}: ${attr.value}`)
      .join(', ');

    // Create embed for Discord
    return {
      title: `${nft.metadata?.name || "NFT"} Sold!`,
      description: `A rare NFT with matching traits was just sold!`,
      color: 0x5865F2,
      thumbnail: { url: nft.metadata?.image },
      fields: [
        { name: "Price", value: `${price} SOL`, inline: true },
        { name: "Collection", value: nft.metadata?.collection?.name || "Unknown", inline: true },
        { name: "Matching Traits", value: matchedTraits, inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: "Powered by Helius" }
    };
  } catch (error) {
    console.error("Error processing standard NFT:", error);
    return null;
  }
}

// Main webhook handler
app.post("/hel-webhook", async (req, res) => {
  // Always respond to Helius immediately with 200 OK
  res.status(200).send("ok");

  try {
    const payload = req.body;

    // Handle different data formats
    const transactions = Array.isArray(payload) ? payload :
                         payload.data && Array.isArray(payload.data) ? payload.data :
                         [payload];

    // Process each transaction
    for (const tx of transactions) {
      // Try processing as compressed NFT first
      let embedData = processCompressedNftSale(tx);

      // If not a compressed NFT sale, try as standard NFT sale
      if (!embedData) {
        embedData = processStandardNftSale(tx);
      }

      // If we have valid embed data (meaning we found a matching NFT sale), post to Discord
      if (embedData) {
        await postToDiscord(embedData);
      }
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    // Already sent 200 response to Helius
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.send("NFT Webhook service is running!");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
