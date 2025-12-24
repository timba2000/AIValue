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

export interface FileAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  isImage: boolean;
  extractedText?: string;
  base64Data?: string;
}

export interface FilterContext {
  companyId?: string | null;
  companyName?: string | null;
  businessUnitId?: string | null;
  businessUnitName?: string | null;
  processId?: string | null;
  processName?: string | null;
}

export interface AIConfig {
  persona?: string;
  rules?: string;
  dataContext?: string;
  useThinkingModel?: boolean;
  attachments?: FileAttachment[];
  filterContext?: FilterContext;
}

type OpenAIMessageContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: string } }>;

export async function generateChatResponse(
  messages: ChatMessage[],
  config?: AIConfig
): Promise<string> {
  const systemPrompt = buildSystemPrompt(config);
  
  let processedMessages: Array<{ role: "system" | "user" | "assistant"; content: OpenAIMessageContent }> = [];
  
  if (systemPrompt) {
    processedMessages.push({ role: "system", content: systemPrompt });
  }
  
  for (const msg of messages) {
    if (msg.role === "user" && config?.attachments && config.attachments.length > 0) {
      const contentParts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: string } }> = [];
      
      let textContent = msg.content;
      const documentAttachments = config.attachments.filter(a => !a.isImage && a.extractedText);
      if (documentAttachments.length > 0) {
        textContent += "\n\n=== ATTACHED DOCUMENTS ===\n";
        for (const doc of documentAttachments) {
          textContent += `\n--- ${doc.originalName} ---\n${doc.extractedText}\n`;
        }
        textContent += "=== END ATTACHED DOCUMENTS ===";
      }
      
      contentParts.push({ type: "text", text: textContent });
      
      const imageAttachments = config.attachments.filter(a => a.isImage && a.base64Data);
      for (const img of imageAttachments) {
        const dataUrl = `data:${img.mimeType};base64,${img.base64Data}`;
        contentParts.push({
          type: "image_url",
          image_url: { url: dataUrl, detail: "auto" }
        });
      }
      
      processedMessages.push({ role: msg.role, content: contentParts });
    } else {
      processedMessages.push({ role: msg.role, content: msg.content });
    }
  }

  const model = config?.useThinkingModel ? "gpt-5.1-thinking" : "gpt-5-mini";
  
  const response = await openai.chat.completions.create({
    model,
    messages: processedMessages as any,
    max_completion_tokens: config?.useThinkingModel ? 16384 : 4096,
  });

  return response.choices[0]?.message?.content || "";
}

export async function* generateChatResponseStream(
  messages: ChatMessage[],
  config?: AIConfig
): AsyncGenerator<string, void, unknown> {
  const systemPrompt = buildSystemPrompt(config);
  
  let processedMessages: Array<{ role: "system" | "user" | "assistant"; content: OpenAIMessageContent }> = [];
  
  if (systemPrompt) {
    processedMessages.push({ role: "system", content: systemPrompt });
  }
  
  for (const msg of messages) {
    if (msg.role === "user" && config?.attachments && config.attachments.length > 0) {
      const contentParts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: string } }> = [];
      
      let textContent = msg.content;
      const documentAttachments = config.attachments.filter(a => !a.isImage && a.extractedText);
      if (documentAttachments.length > 0) {
        textContent += "\n\n=== ATTACHED DOCUMENTS ===\n";
        for (const doc of documentAttachments) {
          textContent += `\n--- ${doc.originalName} ---\n${doc.extractedText}\n`;
        }
        textContent += "=== END ATTACHED DOCUMENTS ===";
      }
      
      contentParts.push({ type: "text", text: textContent });
      
      const imageAttachments = config.attachments.filter(a => a.isImage && a.base64Data);
      for (const img of imageAttachments) {
        const dataUrl = `data:${img.mimeType};base64,${img.base64Data}`;
        contentParts.push({
          type: "image_url",
          image_url: { url: dataUrl, detail: "auto" }
        });
      }
      
      processedMessages.push({ role: msg.role, content: contentParts });
    } else {
      processedMessages.push({ role: msg.role, content: msg.content });
    }
  }

  const model = config?.useThinkingModel ? "gpt-5.1-thinking" : "gpt-5-mini";
  
  const stream = await openai.chat.completions.create({
    model,
    messages: processedMessages as any,
    max_completion_tokens: config?.useThinkingModel ? 16384 : 4096,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
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
  
  if (config?.filterContext) {
    const fc = config.filterContext;
    const contextParts: string[] = [];
    if (fc.companyName) {
      contextParts.push(`Company: ${fc.companyName}${fc.companyId ? ` (ID: ${fc.companyId})` : ''}`);
    } else if (fc.companyId) {
      contextParts.push(`Company ID: ${fc.companyId}`);
    }
    if (fc.businessUnitName) {
      contextParts.push(`Business Unit: ${fc.businessUnitName}${fc.businessUnitId ? ` (ID: ${fc.businessUnitId})` : ''}`);
    } else if (fc.businessUnitId) {
      contextParts.push(`Business Unit ID: ${fc.businessUnitId}`);
    }
    if (fc.processName) {
      contextParts.push(`Process: ${fc.processName}${fc.processId ? ` (ID: ${fc.processId})` : ''}`);
    } else if (fc.processId) {
      contextParts.push(`Process ID: ${fc.processId}`);
    }
    
    if (contextParts.length > 0) {
      parts.push(`\nCURRENT USER FILTER CONTEXT:\nThe user is currently viewing data filtered to: ${contextParts.join(", ")}`);
      parts.push("When answering questions, prioritize information relevant to this filter context. If the user asks about 'my processes' or 'my pain points', focus on data within this filtered scope.");
    }
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
