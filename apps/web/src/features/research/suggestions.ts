import { Building2, Globe, Search } from "lucide-react";

export const suggestions = [
  {
    icon: Search,
    title: "Search the web",
    description: "Find facts with sources",
    prompt: "Search the web for Convex's main features and summarize them with source links.",
  },
  {
    icon: Globe,
    title: "Read a page",
    description: "Turn a URL into insights",
    prompt: "Read https://docs.convex.dev/agents and summarize how agents use tools.",
  },
  {
    icon: Building2,
    title: "Look up a brand",
    description: "Explore a company's identity",
    prompt: "Look up stripe.com and summarize its brand metadata, including logo URLs.",
  },
];
