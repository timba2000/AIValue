import { index, integer, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire)
  })
);

export const userRoles = ["reader", "editor", "admin"] as const;
export type UserRole = typeof userRoles[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).default("reader").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

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
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  description: text("description"),
  fte: integer("fte").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const processes = pgTable("processes", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  businessUnitId: uuid("business_unit_id")
    .references(() => businessUnits.id, { onDelete: "set null" }),
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

export const taxonomyCategories = pgTable("taxonomy_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  level: integer("level").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const painPoints = pgTable("pain_points", {
  id: uuid("id").defaultRandom().primaryKey(),
  statement: text("statement").notNull(),
  impactType: text("impact_type").array(),
  businessImpact: text("business_impact"),
  magnitude: numeric("magnitude"),
  frequency: numeric("frequency"),
  timePerUnit: numeric("time_per_unit"),
  totalHoursPerMonth: numeric("total_hours_per_month"),
  fteCount: numeric("fte_count"),
  rootCause: text("root_cause"),
  workarounds: text("workarounds"),
  dependencies: text("dependencies"),
  riskLevel: text("risk_level"),
  effortSolving: numeric("effort_solving"),
  taxonomyLevel1Id: uuid("taxonomy_level1_id").references(() => taxonomyCategories.id, { onDelete: "set null" }),
  taxonomyLevel2Id: uuid("taxonomy_level2_id").references(() => taxonomyCategories.id, { onDelete: "set null" }),
  taxonomyLevel3Id: uuid("taxonomy_level3_id").references(() => taxonomyCategories.id, { onDelete: "set null" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  businessUnitId: uuid("business_unit_id").references(() => businessUnits.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const processPainPoints = pgTable("process_pain_points", {
  id: uuid("id").defaultRandom().primaryKey(),
  processId: uuid("process_id")
    .notNull()
    .references(() => processes.id, { onDelete: "cascade" }),
  painPointId: uuid("pain_point_id")
    .notNull()
    .references(() => painPoints.id, { onDelete: "cascade" })
});

export const alphaTypes = ["Operational", "Investing", "Governance", "Member"] as const;
export type AlphaType = typeof alphaTypes[number];

export const useCases = pgTable("use_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  solutionProvider: text("solution_provider"),
  problemToSolve: text("problem_to_solve").notNull(),
  solutionOverview: text("solution_overview").notNull(),
  complexity: text("complexity").notNull(),
  dataRequirements: text("data_requirements").array(),
  systemsImpacted: text("systems_impacted"),
  risks: text("risks"),
  estimatedDeliveryTime: text("estimated_delivery_time"),
  costRange: text("cost_range"),
  confidenceLevel: text("confidence_level"),
  alphaType: text("alpha_type"),
  processId: uuid("process_id")
    .references(() => processes.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "set null" }),
  businessUnitId: uuid("business_unit_id")
    .references(() => businessUnits.id, { onDelete: "set null" }),
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
    .references(() => useCases.id, { onDelete: "cascade" }),
  percentageSolved: numeric("percentage_solved"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const processUseCases = pgTable("process_use_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  processId: uuid("process_id")
    .notNull()
    .references(() => processes.id, { onDelete: "cascade" }),
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

export type ProcessPainPoint = typeof processPainPoints.$inferSelect;
export type NewProcessPainPoint = typeof processPainPoints.$inferInsert;

export type ProcessUseCase = typeof processUseCases.$inferSelect;
export type NewProcessUseCase = typeof processUseCases.$inferInsert;

export type TaxonomyCategory = typeof taxonomyCategories.$inferSelect;
export type NewTaxonomyCategory = typeof taxonomyCategories.$inferInsert;

export const aiConversations = pgTable("ai_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const aiMessages = pgTable("ai_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  attachments: jsonb("attachments"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const aiFileUploads = pgTable("ai_file_uploads", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => aiConversations.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => aiMessages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  originalName: text("original_name").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  storagePath: text("storage_path").notNull(),
  extractedText: text("extracted_text"),
  processingStatus: varchar("processing_status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true })
});

export type AIConversation = typeof aiConversations.$inferSelect;
export type NewAIConversation = typeof aiConversations.$inferInsert;

export type AIMessage = typeof aiMessages.$inferSelect;
export type NewAIMessage = typeof aiMessages.$inferInsert;

export type AIFileUpload = typeof aiFileUploads.$inferSelect;
export type NewAIFileUpload = typeof aiFileUploads.$inferInsert;

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  userName: varchar("user_name", { length: 255 }),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  entityName: text("entity_name"),
  action: varchar("action", { length: 20 }).notNull(),
  changes: jsonb("changes"),
  previousValues: jsonb("previous_values"),
  newValues: jsonb("new_values"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  entityTypeIdx: index("idx_audit_entity_type").on(table.entityType),
  entityIdIdx: index("idx_audit_entity_id").on(table.entityId),
  userIdIdx: index("idx_audit_user_id").on(table.userId),
  createdAtIdx: index("idx_audit_created_at").on(table.createdAt)
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
