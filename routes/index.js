const express = require('express');
const axios = require('axios');
const config = require('../config');

const router = express.Router();

// Webhook endpoint for Helius
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;

    // Log incoming webhook data
    console.log('Received webhook:', JSON.stringify(payload, null, 2));

    // Process the payload
    // (You'll implement your Solana cNFT sales filtering logic here)

    // Respond to the webhook
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
