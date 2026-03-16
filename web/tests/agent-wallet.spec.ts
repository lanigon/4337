import { test, expect } from "@playwright/test";

const BASE_URL = "https://web-ten-blond-30.vercel.app";

test.describe("Agent Wallet Page", () => {
  test("home page loads with agent wallet link", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator("h1")).toContainText("Morph");
    const agentLink = page.locator('a[href="/agent"]');
    await expect(agentLink).toBeVisible();
    await expect(agentLink).toContainText("Agent Wallet");
  });

  test("agent page loads with all tabs", async ({ page }) => {
    await page.goto(`${BASE_URL}/agent`);

    // Header
    await expect(page.locator("h1")).toContainText("Agent Wallet");
    await expect(
      page.getByText("ERC-4337 + Session Keys + ERC-8004")
    ).toBeVisible();

    // Architecture flow nodes
    await expect(page.locator(".flow-node")).toHaveCount(6);
    await expect(page.locator(".flow-node.active")).toContainText("Agent");

    // All 5 tabs present
    for (const tab of ["Setup", "Identity", "Sessions", "Agent", "Security"]) {
      await expect(
        page.locator(`button:text-is("${tab}")`)
      ).toBeVisible();
    }

    // Console present
    await expect(page.getByText("Console")).toBeVisible();
  });

  test("setup tab shows connect button when not connected", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/agent`);

    await expect(
      page.locator('button:has-text("Connect MetaMask")')
    ).toBeVisible();

    await expect(page.getByText("How it works")).toBeVisible();
    await expect(
      page.getByText("Smart Account is deployed on first transaction")
    ).toBeVisible();
  });

  test("identity tab loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/agent`);
    await page.locator('button:text-is("Identity")').click();

    await expect(
      page.getByText("Register Agent Identity")
    ).toBeVisible();
    await expect(page.getByText("Reputation System")).toBeVisible();
    await expect(page.getByText("IdentityRegistry:")).toBeVisible();
  });

  test("sessions tab loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/agent`);
    await page.locator('button:text-is("Sessions")').click();

    await expect(
      page.getByText("Create Session Key (On-Chain)")
    ).toBeVisible();
    await expect(page.getByText("Target Contract")).toBeVisible();
    await expect(page.getByText("Expiry")).toBeVisible();
    await expect(
      page.locator('button:has-text("Grant Session Key")')
    ).toBeVisible();
  });

  test("agent tab shows no sessions message", async ({ page }) => {
    await page.goto(`${BASE_URL}/agent`);
    // Click the Agent tab (not the flow node)
    await page.locator('button:text-is("Agent")').click();

    await expect(
      page.getByText("No active sessions")
    ).toBeVisible();
  });

  test("security tab shows contract list", async ({ page }) => {
    await page.goto(`${BASE_URL}/agent`);
    await page.locator('button:text-is("Security")').click();

    await expect(
      page.getByText("Deployed Contracts")
    ).toBeVisible();
    await expect(
      page.getByText("ENTRYPOINT", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("SESSION KEY MANAGER", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("IDENTITY REGISTRY", { exact: true })
    ).toBeVisible();
  });

  test("tab switching works correctly", async ({ page }) => {
    await page.goto(`${BASE_URL}/agent`);

    // Setup tab is active by default
    const setupBtn = page.locator('button:text-is("Setup")');
    await expect(setupBtn).toHaveClass(/tab-active/);

    // Click Sessions tab
    await page.locator('button:text-is("Sessions")').click();
    await expect(
      page.locator('button:text-is("Sessions")')
    ).toHaveClass(/tab-active/);
    await expect(
      page.getByText("Create Session Key (On-Chain)")
    ).toBeVisible();

    // Click back to Setup
    await setupBtn.click();
    await expect(setupBtn).toHaveClass(/tab-active/);
    await expect(
      page.locator('button:has-text("Connect MetaMask")')
    ).toBeVisible();
  });

  test("other pages still work", async ({ page }) => {
    await page.goto(`${BASE_URL}/agent-wallet`);
    await expect(page.locator("body")).not.toBeEmpty();

    await page.goto(`${BASE_URL}/biconomy`);
    await expect(
      page.getByRole("heading", { name: "Biconomy AA Wallet Demo" })
    ).toBeVisible();
  });
});
