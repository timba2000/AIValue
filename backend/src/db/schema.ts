import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  industry: text("industry"),
  anzsic: text("anzsic"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const businessUnits = pgTable("business_units", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  fte: integer("fte").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const processes = pgTable("processes", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessUnitId: uuid("business_unit_id")
    .notNull()
    .references(() => businessUnits.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  volume: numeric("volume"),
  volumeUnit: text("volume_unit"),
  fte: numeric("fte"),
  owner: text("owner"),
  systemsUsed: text("systems_used"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const painPoints = pgTable("pain_points", {
  id: uuid("id").defaultRandom().primaryKey(),
  processId: uuid("process_id")
    .notNull()
    .references(() => processes.id, { onDelete: "cascade" }),
  statement: text("statement").notNull(),
  impactType: text("impact_type"),
  businessImpact: text("business_impact"),
  magnitude: numeric("magnitude"),
  frequency: numeric("frequency"),
  rootCause: text("root_cause"),
  workarounds: text("workarounds"),
  dependencies: text("dependencies"),
  riskLevel: text("risk_level"),
  opportunityPotential: numeric("opportunity_potential"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const useCases = pgTable("use_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  summary: text("summary"),
  valueScore: numeric("value_score").notNull().default("0"),
  effortScore: numeric("effort_score").notNull().default("0"),
  riskScore: numeric("risk_score").notNull().default("0"),
  complexityScore: numeric("complexity_score").notNull().default("0"),
  category: text("category"),
  maturity: text("maturity"),
  prerequisites: text("prerequisites"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const painPointUseCases = pgTable("pain_point_use_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  painPointId: uuid("pain_point_id")
    .notNull()
    .references(() => painPoints.id, { onDelete: "cascade" }),
  useCaseId: uuid("use_case_id")
    .notNull()
    .references(() => useCases.id, { onDelete: "cascade" })
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type BusinessUnit = typeof businessUnits.$inferSelect;
export type NewBusinessUnit = typeof businessUnits.$inferInsert;

export type Process = typeof processes.$inferSelect;
export type NewProcess = typeof processes.$inferInsert;

export type PainPoint = typeof painPoints.$inferSelect;
export type NewPainPoint = typeof painPoints.$inferInsert;

export type UseCase = typeof useCases.$inferSelect;
export type NewUseCase = typeof useCases.$inferInsert;

export type PainPointUseCase = typeof painPointUseCases.$inferSelect;
export type NewPainPointUseCase = typeof painPointUseCases.$inferInsert;
