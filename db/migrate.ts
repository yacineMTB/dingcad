import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://dingcad:dingcad_dev@localhost:5432/dingcad";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

interface MigrationFile {
  version: string;
  filename: string;
  filepath: string;
}

function discoverMigrations(): MigrationFile[] {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return files.map((filename) => ({
    version: filename.replace(/\.sql$/, ""),
    filename,
    filepath: path.join(MIGRATIONS_DIR, filename),
  }));
}

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  const result = await pool.query(
    "SELECT version FROM schema_migrations ORDER BY version"
  );
  return new Set(result.rows.map((r: { version: string }) => r.version));
}

async function migrate(dryRun: boolean): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    await ensureMigrationsTable(pool);

    const applied = await getAppliedMigrations(pool);
    const allMigrations = discoverMigrations();
    const pending = allMigrations.filter((m) => !applied.has(m.version));

    if (pending.length === 0) {
      console.log("All migrations are up to date.");
      return;
    }

    console.log(`${pending.length} pending migration(s):\n`);

    for (const migration of pending) {
      if (dryRun) {
        console.log(`  [dry-run] Would apply: ${migration.filename}`);
        continue;
      }

      console.log(`  Applying: ${migration.filename} ...`);
      const sql = fs.readFileSync(migration.filepath, "utf-8");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [migration.version]
        );
        await client.query("COMMIT");
        console.log(`  Applied:  ${migration.filename}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`\n  FAILED:   ${migration.filename}`);
        console.error(
          `  Error:    ${err instanceof Error ? err.message : err}`
        );
        process.exit(1);
      } finally {
        client.release();
      }
    }

    if (!dryRun) {
      console.log("\nAll migrations applied successfully.");
    }
  } finally {
    await pool.end();
  }
}

async function status(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    await ensureMigrationsTable(pool);

    const applied = await getAppliedMigrations(pool);
    const allMigrations = discoverMigrations();

    console.log("Migration status:\n");
    for (const migration of allMigrations) {
      const state = applied.has(migration.version) ? "applied" : "pending";
      const marker = state === "applied" ? "\u2713" : "\u2022";
      console.log(`  ${marker} [${state}] ${migration.filename}`);
    }

    const pendingCount = allMigrations.filter(
      (m) => !applied.has(m.version)
    ).length;
    console.log(
      `\n${allMigrations.length} total, ${allMigrations.length - pendingCount} applied, ${pendingCount} pending.`
    );
  } finally {
    await pool.end();
  }
}

// CLI entry point
const args = process.argv.slice(2);
const command = args[0] || "migrate";

switch (command) {
  case "migrate":
    migrate(args.includes("--dry-run")).catch((err) => {
      console.error("Migration failed:", err.message);
      process.exit(1);
    });
    break;
  case "status":
    status().catch((err) => {
      console.error("Status check failed:", err.message);
      process.exit(1);
    });
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error("Usage: migrate.ts [migrate [--dry-run] | status]");
    process.exit(1);
}
