import {
  customType,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[] | null; config: { dimensions: number } }>({
  dataType: (config) => {
    const dimensions = config?.dimensions;
    if (typeof dimensions !== "number") {
      throw new Error("vector column requires a dimensions configuration");
    }
    return `vector(${dimensions})`;
  },
  toDriver: (value) => value,
  fromDriver: (value) => value as number[] | null
});

export const useCases = pgTable("use_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  problem: text("problem").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).$type<number[] | null>(),
  industry: text("industry"),
  pattern: text("pattern"),
  automationLevel: text("automation_level"),
  classificationConfidence: numeric("classification_confidence"),
  hoursSavedPerOccurrence: numeric("hours_saved_per_occurrence").notNull().default("0"),
  occurrencesPerMonth: numeric("occurrences_per_month").notNull().default("0"),
  valuePerHour: numeric("value_per_hour").notNull().default("0"),
  valueScore: numeric("value_score").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export type UseCase = typeof useCases.$inferSelect;
export type NewUseCase = typeof useCases.$inferInsert;
