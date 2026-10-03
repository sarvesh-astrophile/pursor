import { beforeEach, expect, test, vi } from "vitest";

const client = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), captureException: vi.fn() }));
vi.mock("posthog-js", () => ({ default: client }));
vi.mock("../env.public", () => ({
  ENV: {
    VITE_POSTHOG_PROJECT_TOKEN: "phc_local_test",
    VITE_POSTHOG_HOST: "https://us.i.posthog.com",
    VITE_APP_RELEASE: "test-release",
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  client.capture.mockReset();
  client.captureException.mockReset();
});

test("configures one history-based pageview strategy and browser exception capture", async () => {
  await import("./posthog");
  expect(client.init).toHaveBeenCalledOnce();
  expect(client.init.mock.calls[0]?.[1]).toMatchObject({
    capture_pageview: "history_change",
    capture_exceptions: true,
    autocapture: false,
  });
});

test("explicit reports deduplicate an Error without deduplicating distinct errors", async () => {
  const { captureBrowserException } = await import("./posthog");
  const error = new Error("Subscription failed");
  captureBrowserException(error, { category: "chat_subscription" });
  captureBrowserException(error, { category: "route_rendering" });
  captureBrowserException(new Error("Another failure"));
  expect(client.captureException).toHaveBeenCalledTimes(2);
});

test("analytics failures cannot interrupt product interactions", async () => {
  const { captureResearchEvent, captureBrowserException } = await import("./posthog");
  client.capture.mockImplementation(() => {
    throw new Error("SDK unavailable");
  });
  client.captureException.mockImplementation(() => {
    throw new Error("SDK unavailable");
  });
  expect(() => captureResearchEvent("research_send_clicked")).not.toThrow();
  expect(() => captureBrowserException(new Error("Original failure"))).not.toThrow();
});
