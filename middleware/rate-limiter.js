const rateLimit = require('express-rate-limit');
const config = require('../config');

// Create configurable rate limiter
const createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || config.rateLimit.windowMs,
    max: options.max || config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: options.message || 'Too many requests from this IP, please try again later'
  });
};

module.exports = createRateLimiter;
