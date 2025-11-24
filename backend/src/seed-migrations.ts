import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pkg from "pg";
const { Pool } = pkg;
import "dotenv/config";

const BASELINE_MIGRATIONS = [
  "0000_nosy_runaways",
  "0001_add_use_case_columns",
  "0002_capture_roi_metrics",
  "0003_align_core_entities",
  "0004_process_relationships",
  "0005_opportunity_data_model",
  "0006_update_pain_points",
  "0007_use_case_schema_update"
];

async function seedMigrationsTable() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("Checking migration tracking table...");
  
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
    
    if (existingMigrations.rows.length === 0) {
      console.log("First deployment detected - backfilling baseline migrations...");
      
      const companiesCheck = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'companies'
        ) as exists
      `);
      
      if (!(companiesCheck.rows[0] as any).exists) {
        console.log("Fresh database detected - no baseline migration backfill needed");
        console.log("Normal migration process will create all tables");
        return;
      }
      
      console.log("Existing database detected - backfilling known migrations...");
      for (let i = 0; i < BASELINE_MIGRATIONS.length; i++) {
        const hash = BASELINE_MIGRATIONS[i];
        const timestamp = Date.now() - (BASELINE_MIGRATIONS.length - i) * 1000;
        
        await db.execute(sql`
          INSERT INTO __drizzle_migrations (hash, created_at)
          VALUES (${hash}, ${timestamp})
        `);
        
        console.log(`  ✓ Backfilled migration: ${hash}`);
      }
      
      console.log(`Successfully backfilled ${BASELINE_MIGRATIONS.length} baseline migrations`);
    } else {
      console.log(`Migration tracking table already initialized (${existingMigrations.rows.length} migrations tracked)`);
    }
    
  } catch (error) {
    console.error("Failed to seed migrations table:", error);
    throw error;
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
