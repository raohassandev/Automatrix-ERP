/**
 * Feature flags derived from environment variables.
 */
export const isGoogleAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);
