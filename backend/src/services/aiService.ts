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
  useThinkingModel?: boolean;
}

export async function generateChatResponse(
  messages: ChatMessage[],
  config?: AIConfig
): Promise<string> {
  const systemPrompt = buildSystemPrompt(config);
  
  const allMessages: ChatMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const model = config?.useThinkingModel ? "gpt-5.1-thinking" : "gpt-5-mini";
  
  const response = await openai.chat.completions.create({
    model,
    messages: allMessages,
    temperature: config?.useThinkingModel ? 1 : 0.7,
    max_completion_tokens: config?.useThinkingModel ? 16384 : 4096,
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
  
  parts.push(`
CHART GENERATION CAPABILITY:
When the user asks for visualizations, charts, or graphs, you can generate them by including a JSON chart specification in your response.

To create a chart, include a code block with the language "chart" like this:
\`\`\`chart
{
  "type": "bar|line|pie|area",
  "title": "Chart Title",
  "data": [
    {"name": "Category 1", "value": 100},
    {"name": "Category 2", "value": 200}
  ],
  "xKey": "name",
  "yKey": "value",
  "colors": ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"]
}
\`\`\`

Chart types:
- "bar": Bar chart for comparing categories
- "line": Line chart for trends over time
- "pie": Pie chart for proportions
- "area": Area chart for cumulative trends

For multi-series data, use:
\`\`\`chart
{
  "type": "bar",
  "title": "Comparison",
  "data": [
    {"name": "Q1", "series1": 100, "series2": 80},
    {"name": "Q2", "series1": 150, "series2": 120}
  ],
  "xKey": "name",
  "yKeys": ["series1", "series2"],
  "colors": ["#8b5cf6", "#06b6d4"]
}
\`\`\`

Always include explanatory text before or after charts. Use real data from the database context when available.`);
  
  return parts.join("\n");
}

export { openai };
