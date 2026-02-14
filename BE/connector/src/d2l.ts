import {
  chromium,
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

function buildLoginLaunchOptions(): { headless: boolean; slowMo: number } {
  const headful = parseBoolean(process.env.PLAYWRIGHT_HEADFUL, false);

  return {
    headless: !headful,
    slowMo: getSlowMoMs(process.env.PLAYWRIGHT_SLOWMO_MS)
  };
}

function buildRequestLaunchOptions(): { headless: true; slowMo: 0 } {
  // always run api requests headless so dashboard calls don't pop windows
  return { headless: true, slowMo: 0 };
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

export async function loginAndCaptureState(input: {
  instanceUrl: string;
  username: string;
  password: string;
}): Promise<{
  storageState: Record<string, unknown>;
  whoami: Record<string, unknown>;
}> {
  const instanceUrl = normalizeInstanceUrl(input.instanceUrl);
  const launchOptions = buildLoginLaunchOptions();
  const authWaitMs = getAuthWaitMs(launchOptions.headless);
  const browser = await chromium.launch(launchOptions);

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await openLoginSurface(page, instanceUrl);
    await submitCredentials(page, input.username, input.password);

    const whoami = await waitForWhoAmI(context, instanceUrl, authWaitMs);
    const storageState = await context.storageState();

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
    await browser.close();
  }
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

  const browser = await chromium.launch(buildRequestLaunchOptions());

  try {
    const context = await browser.newContext(getContextOptions(input.storageState));
    const response = await context.request.get(`${instanceUrl}${input.apiPath}`, { maxRedirects: 0 });

    if (response.status() === 401 || response.status() === 403) {
      throw new ConnectorError(401, "session_expired", "session expired");
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
    await browser.close();
  }
}
