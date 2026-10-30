/** Demo identities and synthetic clinical workflows must never ship in production. */
export const DEMO_MODE_ENABLED = Boolean(
  import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'
);
