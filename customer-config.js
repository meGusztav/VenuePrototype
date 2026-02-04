// customer-config.js
// IMPORTANT: put your actual Supabase values here.
// In GitHub Pages this is fine: anon key is safe to expose. NEVER expose service role key.
window.APP_CONFIG = {
  SUPABASE_URL: "https://zyxxvgdgglpbluuiacps.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_hdzZLLQp19vAcmfDdFyzAA_b9pxwMFy",

  CURRENCY_SYMBOL: "₱",
  VERIFIED_DAYS: 7,
  LIKELY_DAYS: 30,

  // For blocks overlap queries, we only consider these as conflicts.
  CONFLICT_BLOCK_TYPES: ["confirmed", "unavailable", "maintenance", "hold"],

  // Limits
  MAX_VENUES_FETCH: 500,
  MAX_COMPARE: 4,
  MAX_MULTI_INQUIRY: 5
};