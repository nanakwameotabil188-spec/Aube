import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * Uses the Edge already installed on the machine (`channel: 'msedge'`) rather
 * than downloading Playwright's own Chromium. The admin panel is what these
 * tests drive, and the point is to test this app on a browser a person would
 * actually use — not to add a browser build step and a few hundred megabytes to
 * a project that already has a working headless-Edge harness in `scripts/`.
 *
 * Credentials come from the environment and are deliberately required rather
 * than defaulted. The admin password must never live in this file or in
 * package.json, where it would be committed.
 *
 * The server is started by Playwright rather than assumed to be running, so the
 * suite cannot pass against a stale build left over from a previous run. That
 * staleness is not hypothetical — it is how an admin change appears to work and
 * then turns out not to have been deployed.
 */
const PORT = Number(process.env.E2E_PORT ?? 4310);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL,
    channel: 'msedge',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Uploaded media is asserted by fetching it, so a stray cache would read as
    // a successful upload of something that was never written.
    bypassCSP: true,
  },

  projects: [{ name: 'edge', use: { ...devices['Desktop Edge'] } }],

  /*
   * Build, then serve.
   *
   * `next start` runs whatever is already in `.next`, so a suite pointed at it
   * without a build silently tests the previous revision. That is not a
   * hypothetical: a layout change appeared not to work because the running
   * server predated the edit. Building here is what makes a red result mean
   * something.
   */
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
