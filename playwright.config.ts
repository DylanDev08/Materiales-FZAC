import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "https://materiales-fzac-8xmp.onrender.com",
    storageState: process.env.PLAYWRIGHT_AUTH_STATE || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-iphone-13",
      testMatch: /mobile-ui\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    },
    {
      name: "mobile-pixel-7",
      testMatch: /mobile-ui\.spec\.ts/,
      use: { ...devices["Pixel 7"] }
    },
    {
      name: "mobile-galaxy-s20",
      testMatch: /mobile-ui\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true
      }
    },
    {
      name: "mobile-compact-360",
      testMatch: /mobile-ui\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 740 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true
      }
    }
  ]
});
