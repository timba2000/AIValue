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

  async generatePainPointOpportunities(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async generateTemplateOpportunities(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async scoreOpportunities(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
