import { useState } from "react";

import { captureResearchEvent } from "@/app/analytics/posthog";

import { ChatConversation } from "./chat-conversation";

export function ResearchChat() {
  const [conversation, setConversation] = useState(0);
  return (
    <ChatConversation
      key={conversation}
      onNewChat={() => {
        captureResearchEvent("research_chat_reset");
        setConversation((value) => value + 1);
      }}
    />
  );
}
