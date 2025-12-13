import { LLMClassifier, LLMClassifierError } from "./llmClassifier.js";
import { AUTOMATION_LEVELS, INDUSTRIES, SOLUTION_PATTERNS } from "./useCaseCategories.js";

const LABEL_TEMPLATE = "Industry: {industry}; Pattern: {pattern}; Automation Level: {automation}";

const CATEGORY_COMBINATIONS = INDUSTRIES.flatMap((industry) =>
  SOLUTION_PATTERNS.flatMap((pattern) =>
    AUTOMATION_LEVELS.map((automation) => ({
      name: LABEL_TEMPLATE.replace("{industry}", industry.name)
        .replace("{pattern}", pattern.name)
        .replace("{automation}", automation.name),
      description: [industry.description, pattern.description, automation.description]
        .filter(Boolean)
        .join(" ")
    }))
  )
);

const LABEL_MATCHER = /Industry:\s*(?<industry>[^;]+);\s*Pattern:\s*(?<pattern>[^;]+);\s*Automation Level:\s*(?<automation>.+)$/i;

let classifier: LLMClassifier | undefined;

function buildInstructions(): string {
  return [
    "You are an analyst that classifies business use case descriptions.",
    "Pick the single best fitting combination of industry, solution pattern, and automation level.",
    "Choose only from the provided categories and return a JSON object with label, reasoning, and confidence (0-1).",
    "The label MUST exactly match one of the category names using the format 'Industry: <value>; Pattern: <value>; Automation Level: <value>'."
  ].join(" ");
}

export function getUseCaseClassifier(): LLMClassifier {
  if (!classifier) {
    const model = process.env.LLM_CLASSIFIER_MODEL?.trim() || "gpt-4o-mini";

    classifier = new LLMClassifier({
      model,
      instructions: buildInstructions(),
      categories: CATEGORY_COMBINATIONS,
      temperature: 0,
      maxOutputTokens: 400
    });
  }

  return classifier;
}

export interface ParsedUseCaseClassification {
  industry: string;
  pattern: string;
  automationLevel: string;
}

export function parseUseCaseClassificationLabel(label: string): ParsedUseCaseClassification {
  const match = label.match(LABEL_MATCHER);

  if (!match || !match.groups) {
    throw new LLMClassifierError(
      "Unable to parse classification label into industry, pattern, and automation level.",
      { label }
    );
  }

  const { industry, pattern, automation } = match.groups;

  return {
    industry: industry.trim(),
    pattern: pattern.trim(),
    automationLevel: automation.trim()
  };
}
