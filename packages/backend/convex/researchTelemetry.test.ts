/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import type { WorkflowId } from "@convex-dev/workflow";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const workflowId = "workflow-1" as WorkflowId;

async function fixture(attempts = 0) {
  const t = convexTest(schema, modules);
  const turnId = await t.run(async (ctx) => {
    const sessionId = await ctx.db.insert("chatSessions", {
      ownerId: "user-1",
      threadId: "thread-1",
    });
    return ctx.db.insert("researchTurns", {
      ownerId: "user-1",
      sessionId,
      threadId: "thread-1",
      promptMessageId: "prompt-1",
      workflowId: "workflow-1",
      traceId: "1".repeat(32),
      rootSpanId: "2".repeat(16),
      attempts,
      status: "running",
    });
  });
  return { t, turnId };
}

test("completion is idempotent, including a conflicting later callback", async () => {
  const { t, turnId } = await fixture(2);
  await t.mutation(internal.chat.complete, {
    workflowId,
    result: { kind: "success", returnValue: "Answer" },
    context: { turnId },
  });
  const first = await t.query(internal.researchTelemetry.getTurn, { turnId });
  await t.mutation(internal.chat.complete, {
    workflowId,
    result: { kind: "failed", error: "Late callback" },
    context: { turnId },
  });
  expect(await t.query(internal.researchTelemetry.getTurn, { turnId })).toEqual(first);
  expect(first).toMatchObject({ status: "completed", attempts: 2 });
});

test("terminal failure is recorded separately from retry attempts", async () => {
  const { t, turnId } = await fixture();
  const args = { turnId, threadId: "thread-1", promptMessageId: "prompt-1" };
  await t.mutation(internal.researchTelemetry.beginAttempt, args);
  await t.mutation(internal.researchTelemetry.beginAttempt, args);
  expect(await t.query(internal.researchTelemetry.getTurn, { turnId })).toMatchObject({
    status: "running",
    attempts: 2,
  });
  await t.mutation(internal.chat.complete, {
    workflowId,
    result: { kind: "failed", error: "Attempts exhausted" },
    context: { turnId },
  });
  expect(await t.query(internal.researchTelemetry.getTurn, { turnId })).toMatchObject({
    status: "failed",
    attempts: 2,
  });
  await expect(t.mutation(internal.researchTelemetry.beginAttempt, args)).rejects.toThrow(
    "not running",
  );
});

test("mismatched prompts and workflows cannot alter turn telemetry", async () => {
  const { t, turnId } = await fixture();
  await expect(
    t.mutation(internal.researchTelemetry.beginAttempt, {
      turnId,
      threadId: "other-thread",
      promptMessageId: "prompt-1",
    }),
  ).rejects.toThrow("does not match");
  await t.mutation(internal.chat.complete, {
    workflowId: "other-workflow" as WorkflowId,
    result: { kind: "success", returnValue: "Answer" },
    context: { turnId },
  });
  expect(await t.query(internal.researchTelemetry.getTurn, { turnId })).toMatchObject({
    status: "running",
    attempts: 0,
  });
});

test("cancellation records a terminal outcome without calling it a failure", async () => {
  const { t, turnId } = await fixture(1);
  await t.mutation(internal.chat.complete, {
    workflowId,
    result: { kind: "canceled" },
    context: { turnId },
  });
  expect(await t.query(internal.researchTelemetry.getTurn, { turnId })).toMatchObject({
    status: "canceled",
    attempts: 1,
  });
});
