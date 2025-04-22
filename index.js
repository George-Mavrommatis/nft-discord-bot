const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: '10mb' })); // Increase limit for large payloads

const PORT = process.env.PORT || 8080;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Function to safely post to Discord
async function postToDiscord(message) {
  try {
    const response = await axios({
      method: 'post',
      url: DISCORD_WEBHOOK_URL,
      data: message,
      headers: { 'Content-Type': 'application/json' }
    });
    console.log("Successfully posted to Discord, status:", response.status);
    return true;
  } catch (error) {
    console.error("Error posting to Discord:", error.message);
    if (error.response) {
      console.error("  Status:", error.response.status);
    }
    return false;
  }
}

// Helper to extract SOL price from various formats
function extractPrice(tx) {
  // Try all possible price fields
  const priceInLamports = tx.price || tx.amount ||
                         tx.events?.nft?.amount ||
                         tx.tokenTransfers?.[0]?.amount ||
                         0;

  return (priceInLamports / 1e9).toFixed(2); // Convert lamports to SOL
}

app.post("/hel-webhook", async (req, res) => {
  try {
    console.log("Webhook received at", new Date().toISOString());

    // Always respond with 200 OK immediately
    res.status(200).send("ok");

    // Log the raw data
    console.log("Received data:", JSON.stringify(req.body).slice(0, 500) + "...");

    // First post a notification that we received something
    await postToDiscord({
      content: `Received webhook data from Helius at ${new Date().toISOString()}!`
    });

    // Handle all possible data structures
    let transactions = [];
    const payload = req.body;

    if (Array.isArray(payload)) {
      transactions = payload;
    } else if (payload.data && Array.isArray(payload.data)) {
      transactions = payload.data;
    } else if (payload.type || payload.signature) {
      // Single transaction object
      transactions = [payload];
    } else {
      // Unknown format, try to process the whole payload
      transactions = [payload];
    }

    console.log(`Processing ${transactions.length} transaction objects`);

    // Process each transaction
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      console.log(`Transaction ${i+1}/${transactions.length} type:`, tx.type || "unknown");

      // Try to post basic information for EVERY transaction
      try {
        // Super simple message with transaction signature
        const txSignature = tx.signature || tx.id || "unknown";

        await postToDiscord({
          content: `NFT Activity Detected!\nTransaction: ${txSignature}\nType: ${tx.type || "unknown"}\nTimestamp: ${new Date().toISOString()}`
        });

        // If it's specifically an NFT_SALE, try to extract more details
        if (tx.type === 'NFT_SALE' || tx.events?.nft || tx.nft) {
          const price = extractPrice(tx);
          const solscanLink = `https://solscan.io/tx/${txSignature}`;

          // Try to get NFT name from any possible location
          let nftName = "Unknown NFT";
          if (tx.nft?.metadata?.name) nftName = tx.nft.metadata.name;
          else if (tx.events?.nft?.nfts?.[0]?.metadata?.name) nftName = tx.events.nft.nfts[0].metadata.name;
          else if (tx.description) nftName = tx.description;

          // Post a more detailed message
          await postToDiscord({
            content: `NFT SALE: ${nftName}\nPrice: ${price} SOL\nView Transaction: ${solscanLink}`
          });
        }
      } catch (error) {
        console.error(`Error processing transaction ${i+1}:`, error.message);
      }
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    // Already sent 200 response
  }
});

// Add a simple GET endpoint for health checks
app.get("/", (req, res) => {
  res.send("NFT Webhook service is running!");
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));  
