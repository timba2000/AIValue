export interface ClassificationCategory {
  name: string;
  description?: string;
}

export interface LLMClassifierOptions {
  /**
   * API key used to authorize requests to the LLM provider. When omitted, the
   * classifier will look up the key in environment variables.
   */
  apiKey?: string;
  /**
   * The identifier of the model to use for classification.
   */
  model: string;
  /**
   * Optional endpoint override. Defaults to the OpenAI compatible chat completions endpoint.
   */
  endpoint?: string;
  /**
   * Optional custom system prompt for the classifier. When omitted a default prompt is used.
   */
  instructions?: string;
  /**
   * The list of categories the classifier should consider.
   */
  categories: ClassificationCategory[];
  /**
   * Sampling temperature forwarded to the LLM provider. Defaults to 0 for deterministic output.
   */
  temperature?: number;
  /**
   * Optional maximum number of tokens that the model may generate in the response.
   */
  maxOutputTokens?: number;
}

export interface ClassificationResult {
  label: string;
  reasoning: string;
  confidence?: number;
  raw?: unknown;
}

interface OpenAIChatCompletionChoice {
  message?: {
    role: string;
    content?: string;
  };
}

interface OpenAIChatCompletionResponse {
  choices?: OpenAIChatCompletionChoice[];
}

export class LLMClassifierError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LLMClassifierError";
  }
}

type LLMProvider = "openai" | "deepseek";

const PROVIDER_ENDPOINTS: Record<LLMProvider, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  deepseek: "https://api.deepseek.com/v1/chat/completions"
};
const DEFAULT_INSTRUCTIONS =
  "You are a product analyst that classifies product use case descriptions into well defined categories. " +
  "Always respond with a JSON object containing the keys label, reasoning, and optionally confidence (0-1).";

export class LLMClassifier {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;
  private readonly instructions: string;
  private readonly provider: LLMProvider;

  constructor(private readonly options: LLMClassifierOptions) {
    if (!options.model) {
      throw new LLMClassifierError("A model identifier must be provided to initialize the LLMClassifier.");
    }

    if (!options.categories?.length) {
      throw new LLMClassifierError("At least one classification category must be provided.");
    }

    this.provider = this.detectProvider();
    const apiKey = this.resolveApiKey();

    if (!apiKey) {
      throw new LLMClassifierError(
        "An API key must be provided via the constructor or environment variables (OPENAI_API_KEY, DEEPSEEK_API_KEY, or LLM_API_KEY)."
      );
    }

    this.endpoint = options.endpoint ?? PROVIDER_ENDPOINTS[this.provider];
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    };
    this.instructions = options.instructions ?? DEFAULT_INSTRUCTIONS;
  }

  async classify(text: string): Promise<ClassificationResult> {
    if (!text?.trim()) {
      throw new LLMClassifierError("Cannot classify empty text.");
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        model: this.options.model,
        temperature: this.options.temperature ?? 0,
        max_tokens: this.options.maxOutputTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: this.instructions },
          { role: "user", content: this.buildPrompt(text) }
        ]
      })
    });

    if (!response.ok) {
      throw new LLMClassifierError(
        `LLM request failed with status ${response.status} ${response.statusText}.`,
        await this.safeParseErrorBody(response)
      );
    }

    const payload = (await response.json()) as OpenAIChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new LLMClassifierError("The LLM response did not include any content.", payload);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new LLMClassifierError("Failed to parse LLM response as JSON.", { content, error });
    }

    const result = this.normalizeResult(parsed);
    return { ...result, raw: payload };
  }

  private buildPrompt(text: string): string {
    const categories = this.options.categories
      .map((category) => {
        const description = category.description ? ` - ${category.description}` : "";
        return `- ${category.name}${description}`;
      })
      .join("\n");

    return [
      "Classify the following description into exactly one of the provided categories.",
      "If no category is a perfect fit, choose the closest one and explain your reasoning.",
      "Categories:",
      categories,
      "\nDescription:",
      text.trim(),
      "\nRespond with a JSON object containing label, reasoning, and optionally confidence (0-1)."
    ]
      .filter(Boolean)
      .join("\n");
  }

  private normalizeResult(value: unknown): ClassificationResult {
    if (!value || typeof value !== "object") {
      throw new LLMClassifierError("The parsed LLM response is not an object.", value);
    }

    const { label, reasoning, confidence } = value as {
      label?: unknown;
      reasoning?: unknown;
      confidence?: unknown;
    };

    if (typeof label !== "string" || !label.trim()) {
      throw new LLMClassifierError("The LLM response is missing a label field.", value);
    }

    if (typeof reasoning !== "string" || !reasoning.trim()) {
      throw new LLMClassifierError("The LLM response is missing a reasoning field.", value);
    }

    if (confidence !== undefined && typeof confidence !== "number") {
      throw new LLMClassifierError("The LLM response confidence field must be a number when provided.", value);
    }

    return {
      label: label.trim(),
      reasoning: reasoning.trim(),
      confidence: typeof confidence === "number" ? confidence : undefined
    };
  }

  private async safeParseErrorBody(response: Response): Promise<unknown> {
    try {
      const text = await response.text();
      return text ? JSON.parse(text) : undefined;
    } catch (error) {
      return { error: "Failed to parse error body", cause: error };
    }
  }

  private detectProvider(): LLMProvider {
    const endpoint = this.options.endpoint?.toLowerCase();
    if (endpoint?.includes("deepseek")) {
      return "deepseek";
    }

    const model = this.options.model.toLowerCase();
    if (model.includes("deepseek")) {
      return "deepseek";
    }

    return "openai";
  }

  private resolveApiKey(): string | undefined {
    if (this.options.apiKey) {
      return this.options.apiKey;
    }

    const envKeys =
      this.provider === "deepseek"
        ? [process.env.DEEPSEEK_API_KEY, process.env.OPENAI_API_KEY, process.env.LLM_API_KEY]
        : [process.env.OPENAI_API_KEY, process.env.LLM_API_KEY, process.env.DEEPSEEK_API_KEY];

    return envKeys.find((value) => typeof value === "string" && value.trim())?.trim();
  }
}
