import OpenAI from "openai";

const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "";
const openai = new OpenAI({
  baseURL: baseUrl.endsWith("/openai") ? baseUrl : baseUrl,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIConfig {
  persona?: string;
  rules?: string;
  dataContext?: string;
}

export async function generateChatResponse(
  messages: ChatMessage[],
  config?: AIConfig
): Promise<string> {
  const systemPrompt = buildSystemPrompt(config);
  
  const allMessages: ChatMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: allMessages,
    temperature: 0.7,
    max_tokens: 1024,
  });

  return response.choices[0]?.message?.content || "";
}

function buildSystemPrompt(config?: AIConfig): string {
  const parts: string[] = [];
  
  parts.push("You are a helpful AI assistant for a business process management application. Help users with questions about processes, pain points, and solutions.");
  
  if (config?.persona) {
    parts.push(`\nPersona: ${config.persona}`);
  }
  
  if (config?.rules) {
    parts.push(`\nRules and Guidelines:\n${config.rules}`);
  }
  
  if (config?.dataContext) {
    parts.push(`\n${config.dataContext}`);
    parts.push("\nUse the database context above to answer questions about the user's data. Be specific and reference actual data when possible.");
  }
  
  return parts.join("\n");
}

export { openai };
