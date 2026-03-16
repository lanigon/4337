import { test, expect } from "@playwright/test";

const BASE_URL = "https://web-ten-blond-30.vercel.app";

test.describe("Debug: Full site inspection", () => {
  test("check home page for errors", async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
      if (msg.type() === "warning") warnings.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    console.log("=== HOME PAGE ===");
    console.log("Title:", await page.title());
    console.log("URL:", page.url());
    console.log("Errors:", errors.length ? errors : "none");
    console.log("Warnings:", warnings.length ? warnings.slice(0, 5) : "none");

    // Check if redirects or loads correctly
    await expect(page.locator("h1")).toBeVisible();
  });

  test("check agent page load + all elements", async ({ page }) => {
    const errors: string[] = [];
    const networkErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(`PAGE ERROR: ${err.message}`));
    page.on("requestfailed", (req) => {
      networkErrors.push(`FAILED: ${req.url()} - ${req.failure()?.errorText}`);
    });

    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    console.log("=== AGENT PAGE ===");
    console.log("JS Errors:", errors.length ? errors : "none");
    console.log("Network Errors:", networkErrors.length ? networkErrors : "none");

    // Check all critical elements render
    const checks = [
      { name: "h1 title", selector: "h1" },
      { name: "flow nodes", selector: ".flow-node" },
      { name: "Setup tab", selector: 'button:text-is("Setup")' },
      { name: "Sessions tab", selector: 'button:text-is("Sessions")' },
      { name: "Agent tab", selector: 'button:text-is("Agent")' },
      { name: "Security tab", selector: 'button:text-is("Security")' },
      { name: "Connect button", selector: 'button:has-text("Connect MetaMask")' },
      { name: "Console", selector: ".terminal" },
    ];

    for (const c of checks) {
      const el = page.locator(c.selector).first();
      const visible = await el.isVisible().catch(() => false);
      console.log(`  ${visible ? "✓" : "✗"} ${c.name}`);
    }

    // Take screenshot
    await page.screenshot({ path: "tests/screenshots/agent-page.png", fullPage: true });
  });

  test("check all tabs render without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(`PAGE ERROR: ${err.message}`));

    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    const tabs = ["Setup", "Sessions", "Agent", "Security"];
    for (const tab of tabs) {
      errors.length = 0;
      await page.locator(`button:text-is("${tab}")`).click();
      await page.waitForTimeout(500);

      const content = await page.locator(".min-h-\\[400px\\]").textContent();
      console.log(`\n=== TAB: ${tab} ===`);
      console.log(`  Content length: ${content?.length || 0} chars`);
      console.log(`  JS errors: ${errors.length ? errors.join("; ") : "none"}`);

      await page.screenshot({
        path: `tests/screenshots/tab-${tab.toLowerCase()}.png`,
        fullPage: true
      });
    }
  });

  test("simulate wallet connection attempt", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(`PAGE ERROR: ${err.message}`));

    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    // Click connect (will fail since no wallet, but should not crash)
    const connectBtn = page.locator('button:has-text("Connect MetaMask")');
    await connectBtn.click();
    await page.waitForTimeout(2000);

    console.log("=== AFTER CONNECT CLICK ===");
    console.log("JS Errors:", errors.length ? errors : "none");

    // Check page didn't crash
    await expect(page.locator("h1")).toContainText("Agent Wallet");

    // Check console terminal for messages
    const terminal = await page.locator(".terminal").textContent();
    console.log("Terminal content:", terminal?.slice(0, 200));

    await page.screenshot({ path: "tests/screenshots/after-connect.png", fullPage: true });
  });

  test("check CSS and layout issues", async ({ page }) => {
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    // Check viewport rendering
    const viewport = page.viewportSize();
    console.log("=== LAYOUT CHECK ===");
    console.log("Viewport:", viewport);

    // Check for overflow issues
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    console.log(`Body scroll width: ${bodyWidth}, Window width: ${windowWidth}`);
    if (bodyWidth > windowWidth) {
      console.log("⚠️  HORIZONTAL OVERFLOW DETECTED");
    }

    // Check flow nodes are visible and not cut off
    const flowNodes = page.locator(".flow-node");
    const count = await flowNodes.count();
    console.log(`Flow nodes: ${count}`);

    for (let i = 0; i < count; i++) {
      const box = await flowNodes.nth(i).boundingBox();
      const text = await flowNodes.nth(i).textContent();
      console.log(`  Node ${i}: "${text}" - ${box ? `${box.x},${box.y} ${box.width}x${box.height}` : "NOT VISIBLE"}`);
    }

    // Check terminal renders correctly
    const terminalBox = await page.locator(".terminal").boundingBox();
    console.log(`Terminal: ${terminalBox ? `${terminalBox.width}x${terminalBox.height}` : "NOT VISIBLE"}`);

    // Mobile viewport check
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: "tests/screenshots/mobile.png", fullPage: true });

    const mobileBodyWidth = await page.evaluate(() => document.body.scrollWidth);
    console.log(`Mobile: body width=${mobileBodyWidth}, viewport=375`);
    if (mobileBodyWidth > 375) {
      console.log("⚠️  MOBILE HORIZONTAL OVERFLOW");
    }
  });

  test("check wagmi/biconomy bundle loads correctly", async ({ page }) => {
    const resources: { url: string; status: number; size: number }[] = [];
    const failed: string[] = [];

    page.on("response", (resp) => {
      if (resp.url().includes("_next")) {
        resources.push({
          url: resp.url().split("/").pop() || "",
          status: resp.status(),
          size: 0,
        });
      }
    });
    page.on("requestfailed", (req) => {
      failed.push(req.url());
    });

    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    console.log("=== RESOURCES ===");
    console.log(`Total chunks loaded: ${resources.length}`);
    console.log(`Failed requests: ${failed.length ? failed : "none"}`);

    // Check if wagmi/biconomy imports work (no runtime errors)
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    console.log(`Runtime errors: ${errors.length ? errors : "none"}`);
  });
});
