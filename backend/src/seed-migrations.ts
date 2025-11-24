import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pkg from "pg";
const { Pool } = pkg;
import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const BASELINE_MIGRATIONS = [
  { idx: 0, tag: "0000_nosy_runaways", when: 1763162647545 },
  { idx: 1, tag: "0001_add_use_case_columns", when: 1763163810000 },
  { idx: 2, tag: "0002_capture_roi_metrics", when: 1763164800000 },
  { idx: 3, tag: "0003_align_core_entities", when: 1763165800000 },
  { idx: 4, tag: "0005_opportunity_data_model", when: 1763166800000 }
];

async function seedMigrationsTable() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("Initializing migration tracking...");
  
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const existingMigrations = await db.execute(sql`SELECT hash FROM __drizzle_migrations`);
    
    if (existingMigrations.rows.length > 0) {
      console.log(`Migration tracking already initialized (${existingMigrations.rows.length} migrations tracked)`);
      return;
    }
    
    console.log("First deployment detected - checking if database has existing schema...");
    
    const companiesCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'companies'
      ) as exists
    `);
    
    if (!(companiesCheck.rows[0] as any).exists) {
      console.log("Fresh database - migrations will create schema");
      return;
    }
    
    console.log("Existing database detected - marking baseline migrations as applied...");
    
    const migrationsDir = join(process.cwd(), "drizzle", "migrations");
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file: string) => file.endsWith('.sql'))
      .map((file: string) => file.replace('.sql', ''))
      .sort();
    
    for (let i = 0; i < migrationFiles.length; i++) {
      const hash = migrationFiles[i];
      const timestamp = Date.now() - (migrationFiles.length - i) * 1000;
      
      await db.execute(sql`
        INSERT INTO __drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${timestamp})
      `);
      
      console.log(`  ✓ Marked as applied: ${hash}`);
    }
    
    console.log(`\nSuccessfully initialized migration tracking with ${migrationFiles.length} baseline migrations`);
    console.log("Note: Future schema changes should use 'npm run db:push' for development");
    
  } catch (error) {
    console.error("Migration tracking initialization failed:", error);
    process.exit(0);
  } finally {
    await pool.end();
  }
}

seedMigrationsTable()
  .then(() => {
    console.log("Migration seed completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration seed failed:", error);
    process.exit(1);
  });
