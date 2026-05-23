// Run once: node lib/migration.js
// This runs database migration to support Group Goals & Milestones assignees.

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const pool = require("./db"); // Mengimpor koneksi Pool

async function runMigration() {
  console.log("Running database migrations for Supabase...");

  try {
    // 1. Add type column to goals
    await pool.query(`
      ALTER TABLE goals 
      ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'individu'
    `);
    console.log("Migration: 'type' column added to 'goals' table (or already exists).");

    // 2. Add assignee columns to milestones
    await pool.query(`
      ALTER TABLE milestones 
      ADD COLUMN IF NOT EXISTS assignee_name TEXT DEFAULT NULL
    `);
    await pool.query(`
      ALTER TABLE milestones 
      ADD COLUMN IF NOT EXISTS assignee_email TEXT DEFAULT NULL
    `);
    console.log("Migration: 'assignee_name' and 'assignee_email' columns added to 'milestones' table (or already exist).");

    // 3. Create goal_members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS goal_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        deleted_at TIMESTAMPTZ
      )
    `);
    console.log("Migration: 'goal_members' table ready.");

    console.log("All database migrations completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err.message);
    process.exit(1);
  }
}

runMigration();