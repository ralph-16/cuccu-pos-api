// vitest.config.js
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    testTimeout: 15000, // real network calls to Supabase need more than the 5s default
    hookTimeout: 15000,
  },
});