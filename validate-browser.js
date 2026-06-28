const { chromium } = require("playwright-core");

(async () => {
  try {
    console.log("Connecting to CDP at localhost:9222...");
    const browser = await chromium.connectOverCDP("http://localhost:9222");
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("https://example.com", { waitUntil: "networkidle" });
    const title = await page.title();
    await page.screenshot({ path: "browser-satellite-test.png", fullPage: true });
    const stats = require("fs").statSync("browser-satellite-test.png");
    console.log("\u2705 Page title:", title);
    console.log("\u2705 Screenshot saved:", stats.size, "bytes");
    console.log("\u2705 Browser satellite is OPERATIONAL");
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error("\u274c Browser satellite FAILED:", err.message);
    process.exit(1);
  }
})();
