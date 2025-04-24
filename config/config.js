require('dotenv').config();

// Add at the end of your config.js file or in server.js startup
function validateConfig() {
  const requiredVars = ['heliusApiKey', 'discordWebhookUrl', 'merkleTree'];

  for (const key of requiredVars) {
    if (!config[key]) {
      console.error(`Error: Required configuration "${key}" is missing`);
      process.exit(1); // Exit with error
    }
  }

  console.log('Configuration validated successfully');
}

const config = {
  // Server config
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Helius config
  heliusApiKey: process.env.HELIUS_API_KEY,
  webhookSecret: process.env.WEBHOOK_SECRET,

  // Discord config
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,

  // NFT collection config
  merkleTree: "88fLq9b2Hk1TLj3H9MQiQL1x5n8BAdvqk8SGMgbzmfSH",
  traitFilters: [
    { trait_type: "Body", value: "Silver" },
    { trait_type: "Body", value: "Gold" }
  ],
  minSolValue: 0.01,

  // Rate limiting
  rateLimit: {
    maxRequests: 8,
    windowMs: 60000, // 1 minute
  },

  // Known marketplaces
  marketplaces: {
    'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K': 'Magic Eden',
    '5SKmrbAxnHV2sgqydDXKlGjk3z8ZVF5KsemPgYQPs1e': 'Hyperspace'
  },

  // Logging
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    timestamps: true
  }
};

module.exports = config;
module.exports.validateConfig = validateConfig;  
