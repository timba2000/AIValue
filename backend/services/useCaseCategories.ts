import { ClassificationCategory } from "./llmClassifier";

export const INDUSTRIES: ClassificationCategory[] = [
  {
    name: "Healthcare",
    description: "Hospitals, life sciences, and patient care organizations."
  },
  {
    name: "Financial Services",
    description: "Banking, insurance, fintech, and investment operations."
  },
  {
    name: "Retail & E-commerce",
    description: "Consumer shopping, merchandising, and digital storefronts."
  },
  {
    name: "Manufacturing & Supply Chain",
    description: "Production facilities, logistics networks, and inventory management."
  },
  {
    name: "Education",
    description: "Academic institutions, learning platforms, and training providers."
  },
  {
    name: "Energy & Utilities",
    description: "Power generation, distribution, and sustainability programs."
  }
];

export const SOLUTION_PATTERNS: ClassificationCategory[] = [
  {
    name: "Process Automation",
    description: "Streamlining repetitive workflows and back-office tasks."
  },
  {
    name: "Decision Support",
    description: "Analytics, forecasting, and guided recommendations for operators."
  },
  {
    name: "Customer Engagement",
    description: "Conversational agents, personalization, and support experiences."
  },
  {
    name: "Knowledge Management",
    description: "Search, summarization, and knowledge base maintenance."
  },
  {
    name: "Monitoring & Compliance",
    description: "Risk detection, alerts, and regulatory reporting."
  },
  {
    name: "Content Generation",
    description: "Marketing copy, documentation, and creative asset production."
  }
];

export const AUTOMATION_LEVELS: ClassificationCategory[] = [
  {
    name: "Human-in-the-loop",
    description: "Insights or drafts that still require human review and approval."
  },
  {
    name: "Semi-Automated",
    description: "Blended human-machine workflows with selective autonomy."
  },
  {
    name: "Fully Automated",
    description: "End-to-end execution with minimal human intervention."
  }
];
