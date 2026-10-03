import { ContextDev } from "@context-dot-dev/convex";
import { createTool } from "@convex-dev/agent";
import { z } from "zod";

import { components } from "../_generated/api";

const contextDev = new ContextDev(components.contextDev);

const searchWeb = createTool({
  description: "Search the live web for current information and source URLs.",
  inputSchema: z.object({ query: z.string().min(1).max(1_000) }),
  execute: async (ctx, { query }): Promise<string> => {
    const response = await contextDev.search(ctx, { body: { query, numResults: 10 } });
    return JSON.stringify(
      response.results.slice(0, 10).map(({ url, title, description }) => ({
        url: url.slice(0, 2_000),
        title: title.slice(0, 500),
        description: description.slice(0, 2_000),
      })),
    );
  },
});

const readPage = createTool({
  description: "Read a web page as Markdown to verify and summarize its content.",
  inputSchema: z.object({ url: z.url({ protocol: /^https?$/ }) }),
  execute: async (ctx, { url }): Promise<string> => {
    const page = await contextDev.scrapeMarkdown(ctx, {
      params: { url, useMainContentOnly: true, maxAgeMs: 3_600_000 },
    });
    return JSON.stringify({
      url: page.url,
      markdown: page.markdown.slice(0, 24_000),
      truncated: page.markdown.length > 24_000,
    });
  },
});

const lookupBrand = createTool({
  description: "Look up a company's brand, logos, and metadata by domain (e.g. stripe.com).",
  inputSchema: z.object({ domain: z.string().min(1).max(253) }),
  execute: async (ctx, { domain }): Promise<string> => {
    const text = JSON.stringify(await contextDev.retrieveBrand(ctx, { params: { domain } }));
    return text.length > 24_000 ? `${text.slice(0, 24_000)}\n[Brand response truncated]` : text;
  },
});

export const researchTools = { searchWeb, readPage, lookupBrand };
