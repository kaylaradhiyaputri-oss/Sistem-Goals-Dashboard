// Run once: node lib/db-init.js
// This creates all tables in your Neon database.

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const sql = require("./db");

async function initDatabase() {
  console.log("Initializing database...");

  try {
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    console.log("Table ready: users");

    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    console.log("Table ready: sessions");

    await sql`
      CREATE TABLE IF NOT EXISTS goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        deadline DATE,
        priority TEXT DEFAULT 'medium',
        progress NUMERIC(5,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    console.log("Table ready: goals");

    await sql`
      CREATE TABLE IF NOT EXISTS milestones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        is_done BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    console.log("Table ready: milestones");

    await sql`
      CREATE TABLE IF NOT EXISTS reminders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
        remind_at TIMESTAMPTZ NOT NULL,
        sent BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    console.log("Table ready: reminders");

    await sql`
      CREATE TABLE IF NOT EXISTS activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    console.log("Table ready: activities");

    await sql`
      CREATE TABLE IF NOT EXISTS team_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT DEFAULT 'Offline',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    console.log("Table ready: team_members");

    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Error initializing database:", err.message);
    process.exit(1);
  }
}

initDatabase();
