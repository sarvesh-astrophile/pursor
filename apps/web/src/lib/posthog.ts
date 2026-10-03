import posthog from "posthog-js";

import { ENV } from "../env.public";

const reported = new WeakSet<object>();
export const analyticsEnabled = !!ENV.VITE_POSTHOG_PROJECT_TOKEN?.trim();

if (typeof window !== "undefined" && analyticsEnabled) {
  posthog.init(ENV.VITE_POSTHOG_PROJECT_TOKEN!, {
    api_host: ENV.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2026-05-30",
    capture_pageview: "history_change",
    capture_exceptions: true,
    autocapture: false,
    disable_session_recording: true,
    loaded: (client) =>
      client.register({ environment: import.meta.env.MODE, release: ENV.VITE_APP_RELEASE }),
  });
}

type ResearchEvent =
  | "research_prompt_selected"
  | "research_send_clicked"
  | "research_tool_details_opened"
  | "research_chat_reset"
  | "research_reply_first_visible";

export function captureResearchEvent(
  event: ResearchEvent,
  properties: Record<string, unknown> = {},
) {
  if (typeof window === "undefined" || !analyticsEnabled) return;
  try {
    posthog.capture(event, properties);
  } catch {
    /* Analytics must not interrupt chat. */
  }
}

export function captureBrowserException(error: unknown, properties: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !analyticsEnabled) return;
  if (error && typeof error === "object") {
    if (reported.has(error)) return;
    reported.add(error);
  }
  try {
    posthog.captureException(error, properties);
  } catch {
    /* Preserve the original error. */
  }
}

export { posthog };
