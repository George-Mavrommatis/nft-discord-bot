// Load environment variables from .env file
require('dotenv').config();

// Default configuration values
const config = {
  // Server configuration
  port: process.env.PORT || 3000 || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Rate limiting
  rateLimit: {
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000, // 1 minute
    maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 8     // 8 requests per minute
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    timestamps: process.env.LOG_TIMESTAMPS !== 'false' // Enable timestamps by default
  },

  // Solana and Helius configuration
  heliusApiKey: process.env.HELIUS_API_KEY,
  heliusApiUrl: process.env.HELIUS_API_URL || 'https://mainnet.helius-rpc.com',

  // Discord webhook
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,

  // NFT Collection configuration
  merkleTree: process.env.MERKLE_TREE,
  minSolValue: parseFloat(process.env.MIN_SOL_VALUE || '0'), // Minimum SOL value to monitor

  // Optional configurations
  webhookSecret: process.env.WEBHOOK_SECRET // For verifying webhook signatures
};

module.exports = config;
