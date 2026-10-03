import { createMiddleware, createStart } from "@tanstack/react-start";

import { captureServerException } from "./lib/posthog.server";

const errorTracking = createMiddleware().server(async ({ next, request }) => {
  try {
    const result = await next();
    if (result.response.status >= 500) {
      await captureServerException(
        new Error(`Server returned HTTP ${result.response.status}`),
        request,
      );
    }
    return result;
  } catch (error) {
    await captureServerException(error, request);
    throw error;
  }
});

export const startInstance = createStart(() => ({ requestMiddleware: [errorTracking] }));
