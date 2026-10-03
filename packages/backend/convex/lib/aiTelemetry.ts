"use node";

import { OpenTelemetry } from "@ai-sdk/otel";
import {
  context,
  ROOT_CONTEXT,
  trace,
  TraceFlags,
  SpanStatusCode,
  type Attributes,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BasicTracerProvider, type SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { PostHogSpanProcessor } from "@posthog/ai/otel";

context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());

export interface TraceConfig {
  token?: string;
  host?: string;
  attributes: Attributes;
  traceId?: string;
  rootSpanId?: string;
  processor?: SpanProcessor;
}

function providerFor(config: TraceConfig, root = false) {
  return new BasicTracerProvider({
    resource: resourceFromAttributes({ "service.name": "pursor-convex" }),
    forceFlushTimeoutMillis: 5_000,
    spanProcessors: [
      config.processor ??
        new PostHogSpanProcessor({ projectToken: config.token!, host: config.host }),
    ],
    ...(root && config.traceId && config.rootSpanId
      ? {
          idGenerator: {
            generateTraceId: () => config.traceId!,
            generateSpanId: () => config.rootSpanId!,
          },
        }
      : {}),
  });
}

export function createAttemptTelemetry(config: TraceConfig) {
  if (!config.token?.trim()) return undefined;
  try {
    const provider = providerFor(config);
    const tracer = provider.getTracer("pursor-research");
    const parent =
      config.traceId && config.rootSpanId
        ? trace.setSpanContext(ROOT_CONTEXT, {
            traceId: config.traceId,
            spanId: config.rootSpanId,
            traceFlags: TraceFlags.SAMPLED,
            isRemote: true,
          })
        : ROOT_CONTEXT;
    const span = tracer.startSpan("ai.research_attempt", { attributes: config.attributes }, parent);
    const active = trace.setSpan(parent, span);
    return {
      integration: new OpenTelemetry({ tracer, enrichSpan: () => config.attributes }),
      run: <T>(fn: () => Promise<T>): Promise<T> => context.with(active, fn),
      async finish(error?: unknown) {
        if (error !== undefined) {
          span.recordException(error instanceof Error ? error : String(error));
          span.setStatus({ code: SpanStatusCode.ERROR });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        span.end();
        await flushSafely(provider);
      },
    };
  } catch (error) {
    console.warn("PostHog AI telemetry setup failed", error);
    return undefined;
  }
}

async function flushSafely(provider: BasicTracerProvider) {
  try {
    await provider.forceFlush();
  } catch (error) {
    console.warn("PostHog AI telemetry delivery failed", error);
  }
  try {
    await provider.shutdown();
  } catch (error) {
    console.warn("PostHog AI telemetry shutdown failed", error);
  }
}

export async function finishTurnTrace(
  config: TraceConfig,
  startedAt: number,
  finishedAt: number,
  failed: boolean,
) {
  if (!config.token?.trim()) return;
  try {
    const provider = providerFor(config, true);
    const span = provider
      .getTracer("pursor-research")
      .startSpan(
        "ai.research_turn",
        { startTime: startedAt, attributes: config.attributes },
        ROOT_CONTEXT,
      );
    span.setStatus({ code: failed ? SpanStatusCode.ERROR : SpanStatusCode.OK });
    span.end(finishedAt);
    await flushSafely(provider);
  } catch (error) {
    console.warn("PostHog turn trace delivery failed", error);
  }
}
