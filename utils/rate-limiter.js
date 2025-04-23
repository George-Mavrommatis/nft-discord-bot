const config = require('../config/config');

class TokenBucketRateLimiter {
  constructor(maxTokens, refillRate) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate; // tokens per ms
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  canConsume() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

// Create a rate limiter with max tokens and tokens refilled per minute
const rateLimiter = new TokenBucketRateLimiter(
  config.rateLimit.maxRequests,
  config.rateLimit.maxRequests / config.rateLimit.windowMs
);

module.exports = rateLimiter;
