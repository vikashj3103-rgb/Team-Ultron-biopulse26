/** Demo identities and synthetic clinical workflows enabled during development or demo evaluation. */
export const DEMO_MODE_ENABLED = Boolean(
  import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true'
);
