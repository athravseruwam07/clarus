import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page
} from "playwright";

const WHOAMI_API_PATH = "/d2l/api/lp/1.28/users/whoami";
export const LOGIN_FAILURE_MESSAGE =
  "could not log into D2L. your school may use custom sso/duo. try headful debug or selector overrides.";

export class ConnectorError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly publicMessage: string;

  constructor(statusCode: number, code: string, publicMessage: string) {
    super(publicMessage);
    this.statusCode = statusCode;
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return fallback;
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function getSlowMoMs(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function getAuthWaitMs(headless: boolean): number {
  const configuredValue = process.env.PLAYWRIGHT_AUTH_WAIT_MS;
  if (configuredValue) {
    const parsed = Number(configuredValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return headless ? 25000 : 120000;
}

function buildLoginLaunchOptions(): {
  headless: boolean;
  slowMo: number;
  channel?: string;
  args?: string[];
} {
  const headful = parseBoolean(process.env.PLAYWRIGHT_HEADFUL, false);
  const channel = selectorFromEnv("PLAYWRIGHT_BROWSER_CHANNEL") ?? (headful ? "chrome" : undefined);
  const loginUi = selectorFromEnv("PLAYWRIGHT_LOGIN_UI")?.toLowerCase() ?? null;

  const args: string[] = [];

  if (headful) {
    const width =
      parsePositiveInt(process.env.PLAYWRIGHT_LOGIN_WINDOW_WIDTH) ?? (loginUi === "popup" ? 520 : null);
    const height =
      parsePositiveInt(process.env.PLAYWRIGHT_LOGIN_WINDOW_HEIGHT) ?? (loginUi === "popup" ? 760 : null);
    const x = parsePositiveInt(process.env.PLAYWRIGHT_LOGIN_WINDOW_X);
    const y = parsePositiveInt(process.env.PLAYWRIGHT_LOGIN_WINDOW_Y);

    args.push("--no-first-run", "--no-default-browser-check", "--disable-save-password-bubble");

    if (width && height) {
      args.push(`--window-size=${width},${height}`);
    }

    if (x !== null && y !== null) {
      args.push(`--window-position=${x},${y}`);
    }
  }

  return {
    headless: !headful,
    slowMo: getSlowMoMs(process.env.PLAYWRIGHT_SLOWMO_MS),
    channel,
    args: args.length > 0 ? args : undefined
  };
}

function shouldReuseLoginWindow(headless: boolean): boolean {
  if (headless) {
    return false;
  }

  // default true for headful hackathon debugging
  return parseBoolean(process.env.PLAYWRIGHT_REUSE_LOGIN_WINDOW, true);
}

function shouldConnectOverCdp(): boolean {
  return parseBoolean(process.env.PLAYWRIGHT_CONNECT_OVER_CDP, false);
}

function shouldCloseOnSuccess(): boolean {
  // default true so the login window doesn't linger after a successful connect.
  return parseBoolean(process.env.PLAYWRIGHT_CLOSE_ON_SUCCESS, true);
}

function cdpEndpoint(): string {
  return selectorFromEnv("PLAYWRIGHT_CDP_ENDPOINT") ?? "http://127.0.0.1:9222";
}

function buildRequestLaunchOptions(): { headless: true; slowMo: 0 } {
  // always run api requests headless so dashboard calls don't pop windows
  return { headless: true, slowMo: 0 };
}

let sharedRequestBrowser: Browser | null = null;
let sharedRequestBrowserPromise: Promise<Browser> | null = null;

async function getRequestBrowser(): Promise<Browser> {
  if (sharedRequestBrowser && sharedRequestBrowser.isConnected()) {
    return sharedRequestBrowser;
  }

  if (sharedRequestBrowserPromise) {
    return sharedRequestBrowserPromise;
  }

  sharedRequestBrowserPromise = chromium
    .launch(buildRequestLaunchOptions())
    .then((browser) => {
      sharedRequestBrowser = browser;
      sharedRequestBrowserPromise = null;

      browser.on("disconnected", () => {
        if (sharedRequestBrowser === browser) {
          sharedRequestBrowser = null;
        }
      });

      return browser;
    })
    .catch((error) => {
      sharedRequestBrowserPromise = null;
      throw error;
    });

  return sharedRequestBrowserPromise;
}

function selectorFromEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function uniqueSelectors(selectors: Array<string | undefined>): string[] {
  const deduped = new Set<string>();

  selectors.forEach((selector) => {
    if (selector) {
      deduped.add(selector);
    }
  });

  return Array.from(deduped);
}

async function findVisibleTarget(
  page: Page,
  selectors: string[],
  timeoutMs = 12000
): Promise<Locator | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      const count = await locator.count();

      if (count === 0) {
        continue;
      }

      const isVisible = await locator.isVisible().catch(() => false);
      if (isVisible) {
        return locator;
      }
    }

    await page.waitForTimeout(200);
  }

  return null;
}

async function openLoginSurface(page: Page, instanceUrl: string): Promise<void> {
  const homeUrl = `${instanceUrl}/d2l/home`;

  try {
    await page.goto(homeUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });
  } catch {
    await page.goto(instanceUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });
  }
}

async function waitForPageSettled(page: Page, timeoutMs = 15000): Promise<void> {
  await Promise.race([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: timeoutMs }),
    page.waitForLoadState("networkidle", { timeout: timeoutMs }),
    page.waitForLoadState("domcontentloaded", { timeout: timeoutMs })
  ]).catch(() => undefined);
}

async function submitCurrentStep(
  page: Page,
  submitSelectors: string[],
  fallbackLocator: Locator
): Promise<void> {
  const submitButton = await findVisibleTarget(page, submitSelectors, 3000);
  if (submitButton) {
    await submitButton.click({ timeout: 5000 }).catch(() => undefined);
  } else {
    await fallbackLocator.press("Enter").catch(() => undefined);
  }

  await waitForPageSettled(page);
}

async function maybeKeepMeSignedIn(page: Page): Promise<void> {
  const checkboxSelectors = uniqueSelectors(['#kmsiInput', 'input[name=\"Kmsi\"]']);
  const checkbox = await findVisibleTarget(page, checkboxSelectors, 1500);
  if (!checkbox) {
    return;
  }

  await checkbox.check({ timeout: 1000 }).catch(() => undefined);
}

async function submitCredentials(page: Page, username: string, password: string): Promise<void> {
  const usernameSelectors = uniqueSelectors([
    selectorFromEnv("BS_USER_SELECTOR"),
    'input[type="email"]',
    'input[name="UserName"]',
    '#userNameInput',
    'input[name*="email" i]',
    'input[name*="user" i]',
    'input[id*="user" i]',
    'input[name="username"]',
    'input[name*="login" i]'
  ]);
  const passwordSelectors = uniqueSelectors([
    selectorFromEnv("BS_PASS_SELECTOR"),
    'input[name="Password"]',
    '#passwordInput',
    'input[type="password"]'
  ]);
  const submitSelectors = uniqueSelectors([
    selectorFromEnv("BS_SUBMIT_SELECTOR"),
    '#submitButton',
    '#nextButton',
    'button[type="submit"]',
    'input[type="submit"]',
    'button[id*="submit" i]',
    'button[id*="next" i]'
  ]);

  const usernameField = await findVisibleTarget(page, usernameSelectors);
  if (!usernameField) {
    throw new ConnectorError(400, "login_failed", LOGIN_FAILURE_MESSAGE);
  }

  await usernameField.fill(username, { timeout: 5000 }).catch(() => undefined);

  let passwordField = await findVisibleTarget(page, passwordSelectors, 2500);
  if (!passwordField) {
    await submitCurrentStep(page, submitSelectors, usernameField);
    passwordField = await findVisibleTarget(page, passwordSelectors, 15000);
  }

  if (!passwordField) {
    throw new ConnectorError(400, "login_failed", LOGIN_FAILURE_MESSAGE);
  }

  await passwordField.fill(password, { timeout: 5000 }).catch(() => undefined);
  await maybeKeepMeSignedIn(page);
  await submitCurrentStep(page, submitSelectors, passwordField);
}

async function waitForWhoAmI(
  context: BrowserContext,
  instanceUrl: string,
  maxWaitMs: number
): Promise<Record<string, unknown>> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    try {
      const response = await context.request.get(`${instanceUrl}${WHOAMI_API_PATH}`);

      if (response.ok()) {
        const payload = (await response.json()) as unknown;
        if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
          return payload as Record<string, unknown>;
        }
      }
    } catch {
      // this is intentionally ignored while waiting for redirects/mfa
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  throw new ConnectorError(400, "login_failed", LOGIN_FAILURE_MESSAGE);
}

export function normalizeInstanceUrl(instanceUrl: string): string {
  const trimmed = instanceUrl.trim();
  if (!trimmed.startsWith("https://")) {
    throw new ConnectorError(400, "invalid_instance_url", "instanceUrl must start with https://");
  }

  const parsed = new URL(trimmed);
  parsed.hash = "";
  parsed.search = "";

  return parsed.toString().replace(/\/$/, "");
}

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

function isHostSuffix(host: string, suffix: string): boolean {
  if (host === suffix) {
    return true;
  }

  return host.endsWith(`.${suffix}`);
}

function filterStorageStateForInstance(state: StorageState, instanceUrl: string): StorageState {
  const hostname = new URL(instanceUrl).hostname.toLowerCase();

  const cookies = state.cookies.filter((cookie) => {
    const domain = cookie.domain.replace(/^\./, "").toLowerCase();
    return isHostSuffix(hostname, domain);
  });

  const origins = state.origins.filter((originEntry) => {
    try {
      const originHost = new URL(originEntry.origin).hostname.toLowerCase();
      return isHostSuffix(hostname, originHost);
    } catch {
      return false;
    }
  });

  return { cookies, origins };
}

class Mutex {
  private current: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    // note: promise executors run sync, but ts doesn't track closure assignments reliably
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = () => resolve();
    });

    const previous = this.current;
    this.current = this.current.then(() => next);

    await previous;

    try {
      return await fn();
    } finally {
      release();
    }
  }
}

const loginMutex = new Mutex();

let sharedLoginBrowser: { browser: Browser; context: BrowserContext; keepAlivePage: Page } | null = null;

async function getLoginContext(launchOptions: {
  headless: boolean;
  slowMo: number;
  channel?: string;
  args?: string[];
}): Promise<{
  browser: Browser;
  context: BrowserContext;
  keepAlivePage: Page | null;
  closeAfter: boolean;
}> {
  const reuseWindow = shouldReuseLoginWindow(launchOptions.headless);

  if (reuseWindow && sharedLoginBrowser) {
    if (!sharedLoginBrowser.browser.isConnected()) {
      sharedLoginBrowser = null;
    } else if (sharedLoginBrowser.keepAlivePage.isClosed()) {
      sharedLoginBrowser.keepAlivePage = await sharedLoginBrowser.context.newPage();
    }
  }

  if (reuseWindow && sharedLoginBrowser) {
    return {
      browser: sharedLoginBrowser.browser,
      context: sharedLoginBrowser.context,
      keepAlivePage: sharedLoginBrowser.keepAlivePage,
      closeAfter: false
    };
  }

  let browser: Browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    // note: fall back to bundled chromium if system chrome isn't available
    if (launchOptions.channel) {
      browser = await chromium.launch({
        headless: launchOptions.headless,
        slowMo: launchOptions.slowMo,
        args: launchOptions.args
      });
    } else {
      throw error;
    }
  }
  const context = await browser.newContext({
    viewport: launchOptions.headless ? undefined : null
  });

  if (reuseWindow) {
    // keep an idle tab open so the same window stays around between logins.
    const keepAlivePage = await context.newPage();
    await keepAlivePage.goto("about:blank").catch(() => undefined);
    sharedLoginBrowser = { browser, context, keepAlivePage };
    return { browser, context, keepAlivePage, closeAfter: false };
  }

  return { browser, context, keepAlivePage: null, closeAfter: true };
}

async function resetLoginContext(context: BrowserContext, keepAlivePage: Page | null): Promise<void> {
  // best-effort cleanup to avoid leaking sessions across logins.
  await context.clearCookies().catch(() => undefined);
  await context.clearPermissions().catch(() => undefined);

  const pages = context.pages();
  await Promise.all(
    pages
      .filter((page) => page !== keepAlivePage)
      .map((page) => page.close().catch(() => undefined))
  );

  if (keepAlivePage && !keepAlivePage.isClosed()) {
    await keepAlivePage.goto("about:blank").catch(() => undefined);
  }
}

async function getCdpLoginContext(): Promise<{
  browser: Browser;
  context: BrowserContext;
  keepAlivePage: null;
  closeAfter: boolean;
}> {
  const endpoint = cdpEndpoint();

  let browser: Browser;
  try {
    browser = await chromium.connectOverCDP(endpoint, { timeout: 5000 });
  } catch {
    throw new ConnectorError(
      400,
      "cdp_unavailable",
      `could not attach to chrome. start chrome with --remote-debugging-port and retry. (expected ${endpoint})`
    );
  }

  const contexts = browser.contexts();
  if (contexts.length === 0) {
    // note: this is unexpected; fall back to an isolated context
    const isolated = await browser.newContext();
    return { browser, context: isolated, keepAlivePage: null, closeAfter: true };
  }

  const context = contexts[0];
  return { browser, context, keepAlivePage: null, closeAfter: true };
}

export async function loginAndCaptureState(input: {
  instanceUrl: string;
  username: string;
  password: string;
}): Promise<{
  storageState: Record<string, unknown>;
  whoami: Record<string, unknown>;
}> {
  return loginMutex.runExclusive(async () => {
    const instanceUrl = normalizeInstanceUrl(input.instanceUrl);
    const launchOptions = buildLoginLaunchOptions();
    const authWaitMs = getAuthWaitMs(launchOptions.headless);

    const { browser, context, keepAlivePage, closeAfter } = await getLoginContext(launchOptions);

    let page: Page | null = null;
    const usingKeepAlive = Boolean(keepAlivePage && !keepAlivePage.isClosed());
    let isSuccess = false;

    try {
      await resetLoginContext(context, keepAlivePage);
      page = usingKeepAlive ? keepAlivePage! : await context.newPage();
      await page.bringToFront().catch(() => undefined);

      await openLoginSurface(page, instanceUrl);
      await submitCredentials(page, input.username, input.password);

      const whoami = await waitForWhoAmI(context, instanceUrl, authWaitMs);
      const storageState = await context.storageState();
      isSuccess = true;

      return {
        storageState: storageState as unknown as Record<string, unknown>,
        whoami
      };
    } catch (error) {
      if (error instanceof ConnectorError) {
        throw error;
      }

      throw new ConnectorError(400, "login_failed", LOGIN_FAILURE_MESSAGE);
    } finally {
      const forceClose = isSuccess && shouldCloseOnSuccess();

      // leave the browser open in reuse mode unless we explicitly want to close it.
      if (page && (!usingKeepAlive || forceClose)) {
        await page.close().catch(() => undefined);
      }

      if (forceClose && sharedLoginBrowser?.browser === browser) {
        sharedLoginBrowser = null;
      }

      if (closeAfter || forceClose) {
        await browser.close().catch(() => undefined);
      }
    }
  });
}

export async function manualLoginAndCaptureState(input: {
  instanceUrl: string;
}): Promise<{
  storageState: Record<string, unknown>;
  whoami: Record<string, unknown>;
}> {
  return loginMutex.runExclusive(async () => {
    const instanceUrl = normalizeInstanceUrl(input.instanceUrl);
    const launchOptions = buildLoginLaunchOptions();

    if (launchOptions.headless) {
      throw new ConnectorError(
        400,
        "manual_login_requires_headful",
        "manual login requires PLAYWRIGHT_HEADFUL=true"
      );
    }

    const authWaitMs = getAuthWaitMs(launchOptions.headless);
    const useCdp = shouldConnectOverCdp();

    const { browser, context, keepAlivePage, closeAfter } = useCdp
      ? await getCdpLoginContext()
      : await getLoginContext(launchOptions);

    let page: Page | null = null;
    const usingKeepAlive = Boolean(keepAlivePage && !keepAlivePage.isClosed());
    let isSuccess = false;

    try {
      if (!useCdp) {
        await resetLoginContext(context, keepAlivePage);
      }
      page = usingKeepAlive ? keepAlivePage! : await context.newPage();
      await page.bringToFront().catch(() => undefined);

      await openLoginSurface(page, instanceUrl);
      await waitForPageSettled(page);

      // note: user completes login + mfa manually in the opened tab
      const whoami = await waitForWhoAmI(context, instanceUrl, authWaitMs);
      const storageState = await context.storageState();
      const filteredState = useCdp ? filterStorageStateForInstance(storageState, instanceUrl) : storageState;
      isSuccess = true;

      return {
        storageState: filteredState as unknown as Record<string, unknown>,
        whoami
      };
    } catch (error) {
      if (error instanceof ConnectorError) {
        throw error;
      }

      throw new ConnectorError(400, "login_failed", LOGIN_FAILURE_MESSAGE);
    } finally {
      const forceClose = isSuccess && shouldCloseOnSuccess();

      if (page && (!usingKeepAlive || forceClose)) {
        await page.close().catch(() => undefined);
      }

      if (forceClose && sharedLoginBrowser?.browser === browser) {
        sharedLoginBrowser = null;
      }

      if (closeAfter || forceClose) {
        await browser.close().catch(() => undefined);
      }
    }
  });
}

function getContextOptions(storageState: Record<string, unknown>): BrowserContextOptions {
  return {
    storageState: storageState as unknown as BrowserContextOptions["storageState"]
  };
}

export async function requestWithStoredState(input: {
  instanceUrl: string;
  storageState: Record<string, unknown>;
  apiPath: string;
}): Promise<unknown> {
  const instanceUrl = normalizeInstanceUrl(input.instanceUrl);
  if (!input.apiPath.startsWith("/d2l/api/")) {
    throw new ConnectorError(400, "invalid_api_path", "apiPath must start with /d2l/api/");
  }

  const browser = await getRequestBrowser();
  const context = await browser.newContext(getContextOptions(input.storageState));

  try {
    const response = await context.request.get(`${instanceUrl}${input.apiPath}`, { maxRedirects: 0 });

    if (response.status() === 401) {
      throw new ConnectorError(401, "session_expired", "session expired");
    }

    if (response.status() === 403) {
      throw new ConnectorError(403, "forbidden", "forbidden");
    }

    if (response.status() >= 300 && response.status() < 400) {
      // this usually means the cookies are no longer valid and d2l redirected to sso
      throw new ConnectorError(401, "session_expired", "session expired");
    }

    if (!response.ok()) {
      throw new ConnectorError(response.status(), "d2l_api_error", "d2l api request failed");
    }

    return (await response.json()) as unknown;
  } finally {
    await context.close().catch(() => undefined);
  }
}
