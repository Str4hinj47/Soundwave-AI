import { http } from "./api";

export interface JarvisOverview {
  name: string;
  tagline: string;
  author: string;
  repo: string;
  stars: string;
  forks: string;
  license: string;
  model: string;
  osSupport: string[];
  python: string;
  coreStack: string[];
  description: string;
  whatsNew: { title: string; desc: string }[];
  foundationFixes: string[];
}

export interface JarvisAction {
  name: string;
  file: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  exampleUsage: string[];
  category: string;
  osSupport: string;
}

export interface JarvisCoreModule {
  name: string;
  file: string;
  purpose: string;
  keyConcepts: string[];
  apiSurface: string[];
}

export interface JarvisCapability {
  icon: string;
  title: string;
  description: string;
  howToUse: string;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
  relatedActions: string[];
  codeExample?: string;
  followUp: string[];
  meta: {
    model: string;
    knowledgeCutoff: string;
    repo: string;
    latency: string;
  };
}

export interface GeneratePluginResponse {
  pluginName: string;
  code: string;
  explanation: string;
  fileName: string;
  installPath: string;
  instructions: string[];
}

export const jarvisApi = {
  getKnowledge: () => http.get<{ overview: JarvisOverview; structure: string; capabilities: JarvisCapability[]; actions: JarvisAction[]; coreModules: JarvisCoreModule[]; setup: any; bestPractices: any[]; quickPrompts: string[]; templates: { plugin: string; action: string } }>("/jarvis/knowledge"),
  getOverview: () => http.get<{ overview: JarvisOverview }>("/jarvis/overview"),
  getActions: () => http.get<{ actions: JarvisAction[]; count: number }>("/jarvis/actions"),
  getAction: (name: string) => http.get<{ action: JarvisAction }>(`/jarvis/actions/${name}`),
  getCapabilities: () => http.get<{ capabilities: JarvisCapability[]; count: number }>("/jarvis/capabilities"),
  getCore: () => http.get<{ modules: JarvisCoreModule[]; count: number }>("/jarvis/core"),
  getTemplates: () => http.get<{ pluginTemplate: string; actionTemplate: string }>("/jarvis/templates"),
  getSetup: () => http.get<{ setup: any }>("/jarvis/setup"),
  getPrompts: () => http.get<{ prompts: string[] }>("/jarvis/prompts"),
  chat: (message: string, history?: { role: "user" | "assistant"; content: string }[]) =>
    http.post<ChatResponse>("/jarvis/chat", { message, history }),
  generatePlugin: (description: string, name?: string) =>
    http.post<GeneratePluginResponse>("/jarvis/generate-plugin", { description, name }),
  generateAction: (description: string, name?: string) =>
    http.post<GeneratePluginResponse>("/jarvis/generate-action", { description, name }),
};
