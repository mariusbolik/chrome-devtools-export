import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.pw.ts",
  fullyParallel: true,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
  },
});
