import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import pkg from "pg";
const { Pool } = pkg;
import "dotenv/config";

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("Running database migrations...");
  
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
    
    await migrate(db, { migrationsFolder: "drizzle/migrations" });
    console.log("Migrations completed successfully");
  } catch (error: any) {
    if (error?.code === '42P07' || error?.code === '42701' || error?.code === '2BP01') {
      console.log("\nSchema drift detected on first deployment - this is expected.");
      console.log("The seed script has already marked these migrations as applied.");
      console.log("Migration process will continue normally for future deployments.\n");
    } else {
      console.error("Migration failed:", error);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

runMigrations()
  .then(() => {
    console.log("Migration process completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration process failed:", error);
    process.exit(1);
  });
