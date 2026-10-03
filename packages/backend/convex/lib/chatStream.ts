import type { UIMessageChunk } from "ai";

export type ChatToolProgress = {
  id: string;
  name: string;
  input: string;
  inputComplete: boolean;
  output: string | null;
  error: boolean;
};

// Build a cumulative snapshot from the Agent's persisted UIMessageChunk stream.
// The browser translates only newly arrived content into TanStack AG-UI events.
export function readChatStream(parts: UIMessageChunk[]) {
  let text = "";
  const tools = new Map<string, ChatToolProgress>();
  for (const part of parts) {
    switch (part.type) {
      case "text-delta":
        text += part.delta;
        break;
      case "tool-input-start":
        tools.set(part.toolCallId, {
          id: part.toolCallId,
          name: part.toolName,
          input: "",
          inputComplete: false,
          output: null,
          error: false,
        });
        break;
      case "tool-input-delta": {
        const tool = tools.get(part.toolCallId);
        if (tool) tool.input += part.inputTextDelta;
        break;
      }
      case "tool-input-available": {
        const tool = tools.get(part.toolCallId);
        tools.set(part.toolCallId, {
          id: part.toolCallId,
          name: part.toolName,
          input: JSON.stringify(part.input),
          inputComplete: true,
          output: tool?.output ?? null,
          error: tool?.error ?? false,
        });
        break;
      }
      case "tool-output-available": {
        const tool = tools.get(part.toolCallId);
        if (tool)
          tool.output = typeof part.output === "string" ? part.output : JSON.stringify(part.output);
        break;
      }
      case "tool-output-error": {
        const tool = tools.get(part.toolCallId);
        if (tool) {
          tool.output = part.errorText;
          tool.error = true;
          tool.inputComplete = true;
        }
        break;
      }
    }
  }
  return { text, tools: [...tools.values()] };
}
