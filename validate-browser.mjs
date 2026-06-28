import { writeFileSync } from "fs";
import { chromium } from "playwright-core";

const BROWSER_SERVER = "http://127.0.0.1:19003";
const TOKEN = "pulse-validate-2026";
const CDP_URL = "http://127.0.0.1:19012";

console.log("=== Pulse Browser Satellite Smoke Test ===");
console.log(`Browser control server: ${BROWSER_SERVER}`);
console.log(`CDP endpoint: ${CDP_URL}`);

let browser;
try {
  // Test 1: Connect to the running browser via CDP
  console.log("\n[Test 1] Connecting to browser via CDP...");
  browser = await chromium.connectOverCDP(CDP_URL);
  console.log("✅ CDP connection established");

  // Test 2: Get browser version
  const version = browser.version();
  console.log(`✅ Browser version: ${version}`);

  // Test 3: Open a page and navigate
  console.log("\n[Test 2] Opening page and navigating...");
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://example.com", { timeout: 15000 });
  const title = await page.title();
  console.log(`✅ Page title: ${title}`);

  // Test 4: Screenshot
  console.log("\n[Test 3] Taking screenshot...");
  const screenshotPath = "/Users/aliahnaf/SourceControl/openclaw/browser-satellite-test.png";
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`✅ Screenshot saved: ${screenshotPath}`);

  await context.close();
  console.log("\n=== ALL TESTS PASSED ✅ ===");
  console.log("Browser satellite is fully operational.");
} catch (err) {
  console.error(`\n❌ Test failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
} finally {
  if (browser) await browser.close().catch(() => {});
}
