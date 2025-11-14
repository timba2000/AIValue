import { pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";

export const useCases = pgTable("use_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  problem: text("problem").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).$type<number[] | null>().default(null),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export type UseCase = typeof useCases.$inferSelect;
export type NewUseCase = typeof useCases.$inferInsert;
