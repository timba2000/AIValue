export type StructuralThresholds = {
  fte?: number;
  volume?: number;
  systemCount?: number;
};

export type ProcessSignal = {
  id: string;
  name: string;
  fte?: number | null;
  volume?: number | null;
  systemCount?: number | null;
  systemsUsed?: string | string[] | null;
};

export type StructuralOpportunity = {
  processId: string;
  title: string;
  category: "structural";
  estimatedValue: number;
  trigger: "fte" | "volume" | "systemCount";
  notes?: string;
};

export type PainPointSignal = {
  id: string;
  processId: string;
  statement: string;
  frequency?: string | null;
  magnitude?: string | null;
  rootCause?: string | null;
  workarounds?: string | null;
};

export type PainPointOpportunityCategory =
  | "automation"
  | "data-quality"
  | "workflow-automation";

export type PainPointOpportunity = {
  processId: string;
  painPointIds: string[];
  title: string;
  description: string;
  category: PainPointOpportunityCategory;
  trigger: "frequency-magnitude" | "root-cause" | "workarounds";
};

export class OpportunityService {
  constructor(private readonly defaultThresholds: StructuralThresholds = {
    fte: 5,
    volume: 1_000,
    systemCount: 3
  }) {}

  async generateStructuralOpportunities(
    processes: ProcessSignal[],
    thresholds: StructuralThresholds = {}
  ): Promise<StructuralOpportunity[]> {
    const config: StructuralThresholds = { ...this.defaultThresholds, ...thresholds };
    const opportunities: StructuralOpportunity[] = [];

    for (const process of processes) {
      const systemCount = this.resolveSystemCount(process);

      if (config.fte !== undefined && process.fte !== null && process.fte !== undefined && process.fte > config.fte) {
        opportunities.push({
          processId: process.id,
          title: `${process.name}: reduce manual effort`,
          category: "structural",
          estimatedValue: Number(process.fte),
          trigger: "fte",
          notes: "High FTE allocation suggests automation potential."
        });
      }

      if (config.volume !== undefined && process.volume !== null && process.volume !== undefined && process.volume > config.volume) {
        opportunities.push({
          processId: process.id,
          title: `${process.name}: streamline high volume work`,
          category: "structural",
          estimatedValue: Number(process.fte ?? 0),
          trigger: "volume",
          notes: "Large transaction volumes indicate structural efficiency gains."
        });
      }

      if (config.systemCount !== undefined && systemCount > config.systemCount) {
        opportunities.push({
          processId: process.id,
          title: `${process.name}: consolidate ${systemCount} systems`,
          category: "structural",
          estimatedValue: Number(process.fte ?? 0),
          trigger: "systemCount",
          notes: "Multiple systems increase handoffs and coordination effort."
        });
      }
    }

    return opportunities;
  }

  private resolveSystemCount(process: ProcessSignal): number {
    if (process.systemCount !== null && process.systemCount !== undefined) {
      return Number(process.systemCount);
    }

    if (Array.isArray(process.systemsUsed)) {
      return process.systemsUsed.filter(Boolean).length;
    }

    if (typeof process.systemsUsed === "string") {
      return process.systemsUsed
        .split(/[,;|]/)
        .map((system) => system.trim())
        .filter(Boolean).length;
    }

    return 0;
  }

  private normalizeValue(value?: string | null): string {
    return value?.trim().toLowerCase() ?? "";
  }

  async generatePainPointOpportunities(
    painPoints: PainPointSignal[]
  ): Promise<PainPointOpportunity[]> {
    const opportunities: PainPointOpportunity[] = [];

    for (const painPoint of painPoints) {
      const frequency = this.normalizeValue(painPoint.frequency);
      const magnitude = this.normalizeValue(painPoint.magnitude);
      const rootCause = this.normalizeValue(painPoint.rootCause);
      const workarounds = this.normalizeValue(painPoint.workarounds);

      if (frequency === "high" && magnitude === "high") {
        opportunities.push({
          processId: painPoint.processId,
          painPointIds: [painPoint.id],
          title: `${painPoint.statement}: automate the pain point`,
          description: "High frequency and magnitude suggest automation potential.",
          category: "automation",
          trigger: "frequency-magnitude"
        });
      }

      if (rootCause === "data") {
        opportunities.push({
          processId: painPoint.processId,
          painPointIds: [painPoint.id],
          title: `${painPoint.statement}: improve data quality`,
          description: "Data-related root causes warrant a data quality agent.",
          category: "data-quality",
          trigger: "root-cause"
        });
      }

      if (workarounds === "manual") {
        opportunities.push({
          processId: painPoint.processId,
          painPointIds: [painPoint.id],
          title: `${painPoint.statement}: remove manual workarounds`,
          description: "Manual workarounds highlight workflow automation potential.",
          category: "workflow-automation",
          trigger: "workarounds"
        });
      }
    }

    return opportunities;
  }

  async generateTemplateOpportunities(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async scoreOpportunities(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
