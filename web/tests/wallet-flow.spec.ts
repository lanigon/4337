import { test, expect } from "@playwright/test";

const BASE_URL = "https://web-ten-blond-30.vercel.app";
const MORPH_CHAIN_ID = 2818;
const MORPH_CHAIN_HEX = "0x" + MORPH_CHAIN_ID.toString(16); // 0xb02
const TEST_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

/**
 * Inject a mock window.ethereum that behaves like MetaMask.
 * This lets wagmi's injected() connector connect without a real wallet.
 */
async function injectMockWallet(
  page: import("@playwright/test").Page,
  opts: { chainId?: string; address?: string } = {}
) {
  const chainId = opts.chainId || MORPH_CHAIN_HEX;
  const address = (opts.address || TEST_ADDRESS).toLowerCase();

  await page.addInitScript(
    ({ chainId, address }) => {
      let currentChainId = chainId;
      let connected = false;
      const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

      const mockProvider = {
        isMetaMask: true,
        isConnected: () => connected,
        selectedAddress: null as string | null,

        on(event: string, fn: (...args: unknown[]) => void) {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(fn);
          return mockProvider;
        },
        removeListener(event: string, fn: (...args: unknown[]) => void) {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((f) => f !== fn);
          }
          return mockProvider;
        },
        removeAllListeners() {
          Object.keys(listeners).forEach((k) => delete listeners[k]);
        },
        emit(event: string, ...args: unknown[]) {
          (listeners[event] || []).forEach((fn) => fn(...args));
        },

        async request({
          method,
          params,
        }: {
          method: string;
          params?: unknown[];
        }): Promise<unknown> {
          switch (method) {
            case "eth_requestAccounts":
              connected = true;
              mockProvider.selectedAddress = address;
              setTimeout(() => {
                mockProvider.emit("accountsChanged", [address]);
                mockProvider.emit("connect", { chainId: currentChainId });
              }, 50);
              return [address];

            case "eth_accounts":
              return connected ? [address] : [];

            case "eth_chainId":
              return currentChainId;

            case "net_version":
              return String(parseInt(currentChainId, 16));

            case "wallet_switchEthereumChain": {
              const target = (params as [{ chainId: string }])?.[0]?.chainId;
              if (target) {
                currentChainId = target;
                setTimeout(() => {
                  mockProvider.emit("chainChanged", currentChainId);
                }, 50);
              }
              return null;
            }

            case "wallet_addEthereumChain":
              return null;

            case "eth_getBalance":
              // 0.01 ETH
              return "0x2386F26FC10000";

            case "eth_blockNumber":
              return "0x100";

            case "eth_gasPrice":
              return "0x6FC23AC00"; // ~30 gwei

            case "eth_estimateGas":
              return "0x5208"; // 21000

            case "eth_getCode":
              return "0x";

            case "eth_call":
              return "0x";

            case "personal_sign":
            case "eth_signTypedData_v4":
              // Return a dummy signature
              return (
                "0x" +
                "ab".repeat(32) +
                "cd".repeat(32) +
                "1b"
              );

            case "eth_sendTransaction":
              return "0x" + "ab".repeat(32);

            case "wallet_getPermissions":
              return [{ parentCapability: "eth_accounts" }];

            case "wallet_requestPermissions":
              return [{ parentCapability: "eth_accounts" }];

            default:
              console.log("[MockWallet] unhandled:", method, params);
              return null;
          }
        },
      };

      // Install as window.ethereum
      Object.defineProperty(window, "ethereum", {
        value: mockProvider,
        writable: false,
        configurable: true,
      });

      // Also announce via EIP-6963
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: {
              uuid: "mock-metamask-uuid",
              name: "MetaMask",
              icon: "data:image/svg+xml,<svg/>",
              rdns: "io.metamask",
            },
            provider: mockProvider,
          },
        })
      );
    },
    { chainId, address }
  );
}

test.describe("Wallet Connection Flow", () => {
  test("connect wallet on Morph mainnet", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await injectMockWallet(page, { chainId: MORPH_CHAIN_HEX });
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    // Click connect
    const connectBtn = page.locator('button:has-text("Connect MetaMask")');
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // Wait for connection
    await page.waitForTimeout(2000);

    console.log("Errors after connect:", errors.length ? errors : "none");

    // Should show address (truncated)
    await page.screenshot({
      path: "tests/screenshots/connected-morph.png",
      fullPage: true,
    });

    // Check if connected state shows
    const pageText = await page.locator("body").textContent();
    console.log("Has disconnect:", pageText?.includes("Disconnect"));
    console.log("Has address:", pageText?.includes("0xd8dA"));
    console.log(
      "Has Step 2:",
      pageText?.includes("Smart Account") || pageText?.includes("Step 2")
    );
  });

  test("connect wallet on wrong chain → show switch button", async ({
    page,
  }) => {
    // Connect on Ethereum mainnet (chain 1)
    await injectMockWallet(page, { chainId: "0x1" });
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Connect MetaMask")').click();
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: "tests/screenshots/wrong-chain.png",
      fullPage: true,
    });

    // Should show "Switch to Morph" button AND "Disconnect" button
    const switchBtn = page.locator('button:has-text("Switch to Morph")');
    const disconnectBtn = page.locator('button:has-text("Disconnect")');

    const hasSwitchBtn = await switchBtn.isVisible().catch(() => false);
    const hasDisconnectBtn = await disconnectBtn.isVisible().catch(() => false);

    console.log("Switch to Morph visible:", hasSwitchBtn);
    console.log("Disconnect visible:", hasDisconnectBtn);

    // Should show wrong chain warning
    const hasWarning = await page
      .locator("text=Wrong chain")
      .isVisible()
      .catch(() => false);
    console.log("Wrong chain warning:", hasWarning);

    // Both buttons should be visible
    expect(hasDisconnectBtn).toBe(true);
  });

  test("switch chain flow", async ({ page }) => {
    // Start on wrong chain
    await injectMockWallet(page, { chainId: "0x1" });
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Connect MetaMask")').click();
    await page.waitForTimeout(2000);

    // Click "Switch to Morph"
    const switchBtn = page.locator('button:has-text("Switch to Morph")');
    if (await switchBtn.isVisible()) {
      await switchBtn.click();
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: "tests/screenshots/after-switch.png",
        fullPage: true,
      });

      // After switch, should no longer show wrong chain warning
      const stillWrongChain = await page
        .locator("text=Wrong chain")
        .isVisible()
        .catch(() => false);
      console.log("Still showing wrong chain after switch:", stillWrongChain);
    }
  });

  test("disconnect flow", async ({ page }) => {
    await injectMockWallet(page, { chainId: MORPH_CHAIN_HEX });
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    // Connect
    await page.locator('button:has-text("Connect MetaMask")').click();
    await page.waitForTimeout(2000);

    // Disconnect
    const disconnectBtn = page.locator('button:has-text("Disconnect")');
    if (await disconnectBtn.isVisible()) {
      await disconnectBtn.click();
      await page.waitForTimeout(1000);

      // Should show Connect button again
      const connectVisible = await page
        .locator('button:has-text("Connect MetaMask")')
        .isVisible();
      console.log("Connect button visible after disconnect:", connectVisible);
      expect(connectVisible).toBe(true);

      await page.screenshot({
        path: "tests/screenshots/after-disconnect.png",
        fullPage: true,
      });
    }
  });

  test("full flow: connect → create account → check UI", async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    await injectMockWallet(page, { chainId: MORPH_CHAIN_HEX });
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    // Step 1: Connect
    await page.locator('button:has-text("Connect MetaMask")').click();
    await page.waitForTimeout(2000);

    // Should see Step 2 with "Create Smart Account" button
    const createBtn = page.locator('button:has-text("Create Smart Account")');
    const createVisible = await createBtn.isVisible().catch(() => false);
    console.log("Create Smart Account button visible:", createVisible);

    if (createVisible) {
      // Click Create Smart Account
      await createBtn.click();
      await page.waitForTimeout(3000);

      await page.screenshot({
        path: "tests/screenshots/after-create-account.png",
        fullPage: true,
      });

      // Check terminal output
      const terminal = await page.locator(".terminal").textContent();
      console.log("Terminal:", terminal?.slice(0, 500));
    }

    // Check all tabs still work
    for (const tab of ["Sessions", "Agent", "Security"]) {
      await page.locator(`button:text-is("${tab}")`).click();
      await page.waitForTimeout(300);
      const content = await page
        .locator(".min-h-\\[400px\\]")
        .textContent();
      console.log(`${tab} tab content length: ${content?.length}`);
    }

    console.log(
      "Console errors/warnings:",
      consoleLogs.length ? consoleLogs.slice(0, 5) : "none"
    );
  });
});
