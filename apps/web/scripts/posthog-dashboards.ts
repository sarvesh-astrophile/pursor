const recent = "timestamp >= now() - INTERVAL 30 DAY";

export const dashboardDefinitions = [
  {
    name: "Pursor — Usage",
    insights: [
      {
        name: "Daily researchers and accepted turns",
        sql: `SELECT toDate(timestamp) AS day, uniq(distinct_id) AS researchers, count() AS turns FROM events WHERE event = 'research_turn_started' AND ${recent} GROUP BY day ORDER BY day`,
      },
      {
        name: "Follow-up rate",
        sql: `SELECT count() AS turns, countIf(properties.is_follow_up = true) AS follow_ups, 100.0 * countIf(properties.is_follow_up = true) / nullIf(count(), 0) AS follow_up_percent FROM events WHERE event = 'research_turn_started' AND ${recent}`,
      },
      {
        name: "Tool usage",
        sql: `SELECT properties.tool_name AS tool, count() AS calls FROM events WHERE event = 'research_tool_completed' AND ${recent} GROUP BY tool ORDER BY calls DESC`,
      },
    ],
  },
  {
    name: "Pursor — Performance",
    insights: [
      {
        name: "First browser text latency (ms)",
        sql: `SELECT quantile(0.5)(toFloat(properties.latency_ms)) AS p50, quantile(0.95)(toFloat(properties.latency_ms)) AS p95 FROM events WHERE event = 'research_reply_first_visible' AND ${recent}`,
      },
      {
        name: "Completed turn duration (ms)",
        sql: `SELECT quantile(0.5)(toFloat(properties.duration_ms)) AS p50, quantile(0.95)(toFloat(properties.duration_ms)) AS p95 FROM events WHERE event = 'research_turn_completed' AND ${recent}`,
      },
      {
        name: "Tool duration (ms)",
        sql: `SELECT properties.tool_name AS tool, quantile(0.5)(toFloat(properties.duration_ms)) AS p50, quantile(0.95)(toFloat(properties.duration_ms)) AS p95 FROM events WHERE event = 'research_tool_completed' AND ${recent} GROUP BY tool`,
      },
      {
        name: "Model first token latency (seconds)",
        sql: `SELECT properties.$ai_model AS model, quantile(0.5)(toFloat(properties.$ai_time_to_first_token)) AS p50, quantile(0.95)(toFloat(properties.$ai_time_to_first_token)) AS p95 FROM events WHERE event = '$ai_generation' AND properties.$ai_time_to_first_token IS NOT NULL AND ${recent} GROUP BY model`,
      },
    ],
  },
  {
    name: "Pursor — Reliability",
    insights: [
      {
        name: "Terminal success and retry rates",
        sql: `SELECT count() AS finished_turns, 100.0 * countIf(event = 'research_turn_completed') / nullIf(count(), 0) AS success_percent, 100.0 * countIf(toFloat(properties.attempts) > 1) / nullIf(count(), 0) AS retry_percent FROM events WHERE event IN ('research_turn_completed', 'research_turn_failed') AND ${recent}`,
      },
      {
        name: "Attempt and terminal failures",
        sql: `SELECT toDate(timestamp) AS day, event, count() AS failures FROM events WHERE event IN ('research_generation_attempt_failed', 'research_turn_failed', 'research_turn_canceled') AND ${recent} GROUP BY day, event ORDER BY day`,
      },
      {
        name: "Tool failures",
        sql: `SELECT properties.tool_name AS tool, count() AS calls, countIf(properties.success = false) AS failures FROM events WHERE event = 'research_tool_completed' AND ${recent} GROUP BY tool`,
      },
      {
        name: "Errors by category and release",
        sql: `SELECT properties.category AS category, properties.release AS release, count() AS errors FROM events WHERE event = '$exception' AND ${recent} GROUP BY category, release ORDER BY errors DESC`,
      },
    ],
  },
  {
    name: "Pursor — AI Cost",
    insights: [
      {
        name: "Model token usage and pricing coverage",
        sql: `SELECT properties.$ai_model AS model, count() AS generations, sum(toFloat(properties.$ai_input_tokens)) AS input_tokens, sum(toFloat(properties.$ai_output_tokens)) AS output_tokens, countIf(properties.$ai_total_cost_usd IS NOT NULL) AS priced_generations, sum(toFloat(properties.$ai_total_cost_usd)) AS estimated_usd FROM events WHERE event = '$ai_generation' AND ${recent} GROUP BY model`,
      },
      {
        name: "Estimated model cost by user and conversation",
        sql: `SELECT distinct_id AS user, properties.$ai_session_id AS conversation, count() AS generations, countIf(properties.$ai_total_cost_usd IS NOT NULL) AS priced_generations, sum(toFloat(properties.$ai_total_cost_usd)) AS estimated_usd FROM events WHERE event = '$ai_generation' AND ${recent} GROUP BY user, conversation ORDER BY estimated_usd DESC LIMIT 100`,
      },
      {
        name: "Estimated model cost per successful chat turn",
        sql: `SELECT sum(toFloat(properties.$ai_total_cost_usd)) / nullIf((SELECT count() FROM events WHERE event = 'research_turn_completed' AND ${recent}), 0) AS estimated_usd_per_successful_turn, countIf(properties.$ai_total_cost_usd IS NOT NULL) AS priced_generations FROM events WHERE event = '$ai_generation' AND properties.source = 'dashboard' AND ${recent}`,
      },
    ],
  },
];
