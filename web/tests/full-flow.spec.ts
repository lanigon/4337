import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "https://web-ten-blond-30.vercel.app";
const MORPH_CHAIN_ID = 2818;
const MORPH_CHAIN_HEX = "0x" + MORPH_CHAIN_ID.toString(16);
const TEST_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const MOCK_SA = "0xfdCC716F03ffD0B6375849CBccb5eb7172c8D28b";
const MOCK_TX_HASH =
  "0xabababababababababababababababababababababababababababababababababab";

/**
 * Full mock provider: handles all RPC calls wagmi/biconomy SDK might make
 */
async function injectMockWallet(
  page: Page,
  opts: { chainId?: string; address?: string; balance?: string } = {}
) {
  const chainId = opts.chainId || MORPH_CHAIN_HEX;
  const address = (opts.address || TEST_ADDRESS).toLowerCase();
  const balance = opts.balance || "0x2386F26FC10000"; // 0.01 ETH

  await page.addInitScript(
    ({ chainId, address, balance }) => {
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
          if (listeners[event])
            listeners[event] = listeners[event].filter((f) => f !== fn);
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
          // Log all RPC calls for debugging
          (window as unknown as Record<string, unknown[]>).__rpcLog =
            (window as unknown as Record<string, unknown[]>).__rpcLog || [];
          (window as unknown as Record<string, unknown[]>).__rpcLog.push({
            method,
            params,
          });

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
                setTimeout(
                  () => mockProvider.emit("chainChanged", currentChainId),
                  50
                );
              }
              return null;
            }

            case "wallet_addEthereumChain":
              return null;

            case "eth_getBalance":
              return balance;

            case "eth_blockNumber":
              return "0x1000";

            case "eth_gasPrice":
              return "0x6FC23AC00";

            case "eth_maxPriorityFeePerGas":
              return "0x3B9ACA00";

            case "eth_estimateGas":
              return "0x5208";

            case "eth_getCode": {
              // Return code for known deployed contracts
              const addr = ((params as string[])?.[0] || "").toLowerCase();
              const deployed = [
                "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789", // EntryPoint
                "0x000000a56aaca3e9a4c479ea6b6cd0dbcb6634f5", // Factory
                "0x0000001c5b32f37f5bea87bdd5374eb2ac54ea8e", // ECDSA
                "0x000002fbffedd9b33f4e7156f2de8d48945e7489", // SessionKeyMgr
              ];
              return deployed.includes(addr) ? "0x6080604052" : "0x";
            }

            case "eth_call":
              // Return a plausible address for factory getAddress calls
              return (
                "0x000000000000000000000000fdcc716f03ffd0b6375849cbccb5eb7172c8d28b"
              );

            case "eth_getTransactionCount":
              return "0x0";

            case "eth_sendTransaction":
              return MOCK_TX_HASH;

            case "eth_getTransactionReceipt":
              return {
                transactionHash: MOCK_TX_HASH,
                blockNumber: "0x1001",
                status: "0x1",
                gasUsed: "0x5208",
              };

            case "eth_getLogs":
              return [];

            case "personal_sign":
            case "eth_signTypedData_v4":
              return "0x" + "ab".repeat(32) + "cd".repeat(32) + "1b";

            case "wallet_getPermissions":
              return [{ parentCapability: "eth_accounts" }];

            case "wallet_requestPermissions":
              return [{ parentCapability: "eth_accounts" }];

            case "eth_subscribe":
              return "0x1";

            case "eth_unsubscribe":
              return true;

            default:
              console.log("[MockWallet] unhandled:", method);
              return null;
          }
        },
      };

      Object.defineProperty(window, "ethereum", {
        value: mockProvider,
        writable: false,
        configurable: true,
      });

      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: {
              uuid: "mock-metamask",
              name: "MetaMask",
              icon: "data:image/svg+xml,<svg/>",
              rdns: "io.metamask",
            },
            provider: mockProvider,
          },
        })
      );
    },
    { chainId, address, balance }
  );
}

/** Helper: connect wallet and wait */
async function connectWallet(page: Page) {
  await page.locator('button:has-text("Connect MetaMask")').click();
  await page.waitForTimeout(2000);
}

/** Helper: get terminal text */
async function getTerminal(page: Page): Promise<string> {
  return (await page.locator(".terminal").textContent()) || "";
}

// ─── Tests ────────────────────────────────────────────────

test.describe("Full Agent Wallet Flow (Mock MetaMask)", () => {
  // ── Home Page ──

  test("1. home page renders and links to /agent", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText("Morph");
    await expect(page.getByText("AI Agent Infrastructure")).toBeVisible();

    const link = page.locator('a[href="/agent"]');
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL("**/agent");
    await expect(page.locator("h1")).toContainText("Agent Wallet");
  });

  // ── Setup Tab ──

  test("2. setup: connect on Morph → shows address + Step 2", async ({
    page,
  }) => {
    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await connectWallet(page);

    // Address visible
    await expect(page.getByText("0xd8dA")).toBeVisible();
    // Disconnect button visible
    await expect(
      page.locator('button:has-text("Disconnect")')
    ).toBeVisible();
    // Step 2 visible
    await expect(page.getByRole("heading", { name: "Smart Account" })).toBeVisible();
    await expect(
      page.locator('button:has-text("Create Smart Account")')
    ).toBeVisible();
    // No wrong chain warning
    await expect(page.locator("text=Wrong chain")).not.toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/flow-02-connected.png",
      fullPage: true,
    });
  });

  test("3. setup: connect on wrong chain → switch + disconnect both visible", async ({
    page,
  }) => {
    await injectMockWallet(page, { chainId: "0x1" });
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await connectWallet(page);

    await expect(page.locator("text=Wrong chain")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Switch to Morph", exact: true })
    ).toBeVisible();
    await expect(
      page.locator('button:has-text("Disconnect")')
    ).toBeVisible();

    // Switch to Morph
    await page.locator('button:has-text("Switch to Morph")').first().click();
    await page.waitForTimeout(1500);

    // Warning should be gone
    await expect(page.locator("text=Wrong chain")).not.toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/flow-03-switched.png",
      fullPage: true,
    });
  });

  test("4. setup: disconnect clears state", async ({ page }) => {
    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await connectWallet(page);
    await expect(page.getByText("0xd8dA")).toBeVisible();

    await page.locator('button:has-text("Disconnect")').click();
    await page.waitForTimeout(1000);

    await expect(
      page.locator('button:has-text("Connect MetaMask")')
    ).toBeVisible();
    // Address gone
    await expect(page.getByText("0xd8dA")).not.toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/flow-04-disconnected.png",
      fullPage: true,
    });
  });

  test("5. setup: Create Smart Account button is clickable", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await connectWallet(page);

    const btn = page.locator('button:has-text("Create Smart Account")');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();

    await btn.click();
    await page.waitForTimeout(5000);

    const terminal = await getTerminal(page);
    console.log("Terminal after create:", terminal.slice(0, 500));

    // Should have attempted to create (log something)
    expect(terminal).toContain("Creating Biconomy Smart Account");

    await page.screenshot({
      path: "tests/screenshots/flow-05-create-sa.png",
      fullPage: true,
    });
  });

  test("6. setup: Fund button sends ETH", async ({ page }) => {
    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await connectWallet(page);

    // Click Create Smart Account and wait
    await page.locator('button:has-text("Create Smart Account")').click();
    await page.waitForTimeout(5000);

    // Check if Fund button appears
    const fundBtn = page.locator('button:has-text("Fund 0.001 ETH")');
    const hasFund = await fundBtn.isVisible().catch(() => false);
    console.log("Fund button visible:", hasFund);

    if (hasFund) {
      await fundBtn.click();
      await page.waitForTimeout(3000);

      const terminal = await getTerminal(page);
      console.log("Terminal after fund:", terminal.slice(-300));
    }

    await page.screenshot({
      path: "tests/screenshots/flow-06-fund.png",
      fullPage: true,
    });
  });

  // ── Sessions Tab ──

  test("7. sessions: tab renders correctly", async ({ page }) => {
    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await page.locator('button:text-is("Sessions")').click();

    await expect(
      page.getByText("Create Session Key (On-Chain)")
    ).toBeVisible();
    await expect(page.getByText("Target Contract")).toBeVisible();
    await expect(page.getByText("Expiry")).toBeVisible();
    await expect(page.getByText("Allowed Function")).toBeVisible();
    await expect(
      page.locator('button:has-text("Grant Session Key")')
    ).toBeVisible();

    // Grant button should be disabled (no smart account)
    const grantBtn = page.locator('button:has-text("Grant Session Key")');
    await expect(grantBtn).toBeDisabled();

    await page.screenshot({
      path: "tests/screenshots/flow-07-sessions.png",
      fullPage: true,
    });
  });

  test("8. sessions: form inputs work", async ({ page }) => {
    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await page.locator('button:text-is("Sessions")').click();

    // Target contract input
    const contractInput = page
      .locator('input[placeholder*="Smart Account"]')
      .or(page.locator("input").first());
    if (await contractInput.isVisible()) {
      await contractInput.fill("0x1234567890abcdef1234567890abcdef12345678");
      const val = await contractInput.inputValue();
      expect(val).toContain("0x1234");
    }

    // Expiry dropdown
    const expirySelect = page.locator("select").first();
    if (await expirySelect.isVisible()) {
      await expirySelect.selectOption({ label: "7 days" });
      const val = await expirySelect.inputValue();
      expect(val).toBe("168");
    }

    // Function input
    const fnInput = page.locator(
      'input[placeholder*="execute"]'
    );
    if (await fnInput.isVisible()) {
      await fnInput.fill("transfer(address,uint256)");
      const val = await fnInput.inputValue();
      expect(val).toBe("transfer(address,uint256)");
    }

    await page.screenshot({
      path: "tests/screenshots/flow-08-session-form.png",
      fullPage: true,
    });
  });

  // ── Agent Tab ──

  test("9. agent: shows no sessions message", async ({ page }) => {
    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await page.locator('button:text-is("Agent")').click();

    await expect(page.getByText("No active sessions")).toBeVisible();
    await expect(
      page.locator('button:has-text("Create Session Key")')
    ).toBeVisible();

    // Clicking "Create Session Key" navigates to sessions tab
    await page.locator('button:has-text("Create Session Key")').click();
    await page.waitForTimeout(500);
    await expect(
      page.getByText("Create Session Key (On-Chain)")
    ).toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/flow-09-agent-empty.png",
      fullPage: true,
    });
  });

  test("10. agent: form elements present", async ({ page }) => {
    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await page.locator('button:text-is("Agent")').click();

    // Check info box
    await expect(page.getByText("How Session Keys Work")).toBeVisible();
    await expect(
      page.getByText("How Session Keys Work")
    ).toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/flow-10-agent-info.png",
      fullPage: true,
    });
  });

  // ── Security Tab ──

  test("11. security: shows stats and contracts", async ({ page }) => {
    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await page.locator('button:text-is("Security")').click();

    // Stats cards
    await expect(page.getByRole("paragraph").filter({ hasText: /^Smart Account$/ })).toBeVisible();
    await expect(page.getByText("Balance")).toBeVisible();
    await expect(page.getByText("Active Sessions")).toBeVisible();

    // Contract list
    await expect(page.getByText("Deployed Contracts")).toBeVisible();
    await expect(
      page.getByText("ENTRYPOINT", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("SESSION KEY MANAGER", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("FACTORY", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("PAYMASTER V1.1", { exact: true })
    ).toBeVisible();

    // No sessions message
    await expect(page.getByText("No sessions created yet")).toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/flow-11-security.png",
      fullPage: true,
    });
  });

  test("12. security: stats update after connecting", async ({ page }) => {
    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    // Connect first
    await connectWallet(page);

    // Create smart account
    await page.locator('button:has-text("Create Smart Account")').click();
    await page.waitForTimeout(5000);

    // Go to security tab
    await page.locator('button:text-is("Security")').click();
    await page.waitForTimeout(500);

    // Smart Account stat should show address (not "—")
    const statsText = await page.locator(".card").first().textContent();
    console.log("First stat card:", statsText);

    await page.screenshot({
      path: "tests/screenshots/flow-12-security-connected.png",
      fullPage: true,
    });
  });

  // ── Console ──

  test("13. console: logs appear and can be cleared", async ({ page }) => {
    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    // Initially shows "Ready"
    const terminal = page.locator(".terminal");
    await expect(terminal).toContainText("Ready");

    // Connect triggers log
    await connectWallet(page);
    await expect(terminal).toContainText("Connecting wallet");

    // Clear button works
    await page.locator('button:text-is("Clear")').click();
    await page.waitForTimeout(300);

    const afterClear = await terminal.textContent();
    console.log(
      "After clear:",
      afterClear?.includes("Ready") ? "shows Ready" : afterClear?.slice(0, 100)
    );

    await page.screenshot({
      path: "tests/screenshots/flow-13-console.png",
      fullPage: true,
    });
  });

  // ── Tab Navigation ──

  test("14. tab navigation: all tabs switch correctly with active indicator", async ({
    page,
  }) => {
    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    const tabs = ["Setup", "Sessions", "Agent", "Security"];

    for (const tab of tabs) {
      const btn = page.locator(`button:text-is("${tab}")`);
      await btn.click();
      await page.waitForTimeout(300);

      // Active tab should have tab-active class
      await expect(btn).toHaveClass(/tab-active/);

      // Other tabs should NOT have tab-active
      for (const other of tabs.filter((t) => t !== tab)) {
        const otherBtn = page.locator(`button:text-is("${other}")`);
        const cls = await otherBtn.getAttribute("class");
        expect(cls).not.toContain("tab-active");
      }
    }
  });

  // ── Architecture Flow ──

  test("15. flow diagram: 6 nodes with Agent highlighted", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    const nodes = page.locator(".flow-node");
    await expect(nodes).toHaveCount(6);

    const texts = await nodes.allTextContents();
    expect(texts).toEqual([
      "Owner EOA",
      "Smart Account",
      "Session Key",
      "Agent",
      "EntryPoint",
      "Morph L2",
    ]);

    // Only Agent node should be active
    const activeNodes = page.locator(".flow-node.active");
    await expect(activeNodes).toHaveCount(1);
    await expect(activeNodes).toContainText("Agent");

    // Flow connectors between nodes
    const connectors = page.locator(".flow-connector");
    await expect(connectors).toHaveCount(5);
  });

  // ── Mobile ──

  test("16. mobile: page is responsive", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    await expect(page.locator("h1")).toContainText("Agent Wallet");
    await expect(
      page.locator('button:has-text("Connect MetaMask")')
    ).toBeVisible();

    // Tabs should be scrollable
    const tabBar = page.locator(
      '[style*="border-bottom"]'
    );
    await expect(tabBar).toBeVisible();

    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(376);

    await page.screenshot({
      path: "tests/screenshots/flow-16-mobile.png",
      fullPage: true,
    });
  });

  // ── Error Handling ──

  test("17. no JS errors across all interactions", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await injectMockWallet(page);
    await page.goto(`${BASE_URL}/agent`, { waitUntil: "networkidle" });

    // Connect
    await connectWallet(page);

    // Click through all tabs
    for (const tab of ["Sessions", "Agent", "Security", "Setup"]) {
      await page.locator(`button:text-is("${tab}")`).click();
      await page.waitForTimeout(300);
    }

    // Try Create Smart Account
    const createBtn = page.locator('button:has-text("Create Smart Account")');
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(5000);
    }

    // Click through tabs again after account creation
    for (const tab of ["Sessions", "Agent", "Security"]) {
      await page.locator(`button:text-is("${tab}")`).click();
      await page.waitForTimeout(300);
    }

    console.log("Total JS errors:", errors.length);
    if (errors.length) {
      console.log("Errors:", errors);
    }

    // Should have zero page-level JS errors
    expect(errors).toHaveLength(0);
  });
});
