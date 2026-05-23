// ─────────────────────────────────────────────────────────────────────────────
// Run once  (fresh DB) : node lib/db-init.js
// Run again (migration): node lib/db-init.js --migrate
//
// --migrate  aman dijalankan berkali-kali; semua ALTER TABLE bersifat idempoten.
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { Client } = require("pg");

const isMigrate = process.argv.includes("--migrate");

// Helper: tambah kolom hanya jika belum ada (idempoten)
async function addColumnIfMissing(client, table, column, definition) {
  const { rows } = await client.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = $1 AND column_name = $2
  `, [table, column]);
  if (rows.length === 0) {
    await client.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`  ✚ kolom ditambahkan: ${table}.${column}`);
  } else {
    console.log(`  ✔ sudah ada: ${table}.${column}`);
  }
}

async function initDatabase() {
  console.log(`\n🚀  Mode: ${isMigrate ? "MIGRATION (database lama)" : "FRESH INIT"}`);
  console.log("Menghubungkan ke Supabase...\n");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ── 1. USERS ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        email         TEXT        UNIQUE NOT NULL,
        password_hash TEXT        NOT NULL,
        name          TEXT,
        created_at    TIMESTAMPTZ DEFAULT now(),
        deleted_at    TIMESTAMPTZ
      )
    `);
    console.log("✅  Table ready: users");

    // ── 2. SESSIONS ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT        UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    console.log("✅  Table ready: sessions");

    // ── 3. GOALS ────────────────────────────────────────────────────────────
    //   • type             : 'individu' | 'kelompok'
    //   • project_progress : progress rata-rata seluruh anggota (dihitung server)
    await client.query(`
      CREATE TABLE IF NOT EXISTS goals (
        id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id          UUID          REFERENCES users(id) ON DELETE CASCADE,
        title            TEXT          NOT NULL,
        description      TEXT,
        deadline         DATE,
        priority         TEXT          DEFAULT 'medium',
        progress         NUMERIC(5,2)  DEFAULT 0,
        type             TEXT          DEFAULT 'individu',
        project_progress NUMERIC(5,2)  DEFAULT 0,
        created_at       TIMESTAMPTZ   DEFAULT now(),
        updated_at       TIMESTAMPTZ   DEFAULT now(),
        deleted_at       TIMESTAMPTZ
      )
    `);
    console.log("✅  Table ready: goals");

    if (isMigrate) {
      console.log("   Migrasi goals...");
      await addColumnIfMissing(client, "goals", "type",             "TEXT DEFAULT 'individu'");
      await addColumnIfMissing(client, "goals", "project_progress", "NUMERIC(5,2) DEFAULT 0");
    }

    // ── 4. GOAL_MEMBERS ─────────────────────────────────────────────────────
    //   Tabel inti untuk kolaborasi:
    //   Setiap baris = satu anggota yang bisa melihat & berinteraksi dengan goal.
    //
    //   • member_user_id  : diisi saat anggota sudah punya akun (JOIN ke users).
    //                       NULL = undangan belum diterima / akun belum dibuat.
    //   • email           : kunci pencarian saat anggota login.
    //   • role            : label bebas, cth "Designer", "Backend Dev".
    //   • status          : 'pending' → 'active' setelah anggota login pertama kali.
    //
    //   Unique constraint (goal_id, email) mencegah anggota duplikat per goal.
    await client.query(`
      CREATE TABLE IF NOT EXISTS goal_members (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        goal_id        UUID        REFERENCES goals(id) ON DELETE CASCADE,
        member_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
        name           TEXT        NOT NULL,
        email          TEXT        NOT NULL,
        role           TEXT        DEFAULT '',
        status         TEXT        DEFAULT 'pending',
        joined_at      TIMESTAMPTZ,
        created_at     TIMESTAMPTZ DEFAULT now(),
        UNIQUE (goal_id, email)
      )
    `);
    console.log("✅  Table ready: goal_members");

    // Index untuk query "semua goal yang bisa dilihat email X"
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_goal_members_email
      ON goal_members (email)
    `);

    // ── 5. MILESTONES ───────────────────────────────────────────────────────
    //   • assignee_email : email anggota yang bertanggung jawab atas milestone ini
    //   • assignee_name  : nama cache (agar tidak perlu JOIN setiap saat)
    await client.query(`
      CREATE TABLE IF NOT EXISTS milestones (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        goal_id        UUID        REFERENCES goals(id) ON DELETE CASCADE,
        title          TEXT        NOT NULL,
        is_done        BOOLEAN     DEFAULT false,
        assignee_email TEXT,
        assignee_name  TEXT,
        created_at     TIMESTAMPTZ DEFAULT now(),
        updated_at     TIMESTAMPTZ DEFAULT now()
      )
    `);
    console.log("✅  Table ready: milestones");

    if (isMigrate) {
      console.log("   Migrasi milestones...");
      await addColumnIfMissing(client, "milestones", "assignee_email", "TEXT");
      await addColumnIfMissing(client, "milestones", "assignee_name",  "TEXT");
    }

    // ── 6. REMINDERS ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        goal_id    UUID        REFERENCES goals(id) ON DELETE CASCADE,
        remind_at  TIMESTAMPTZ NOT NULL,
        sent       BOOLEAN     DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    console.log("✅  Table ready: reminders");

    // ── 7. ACTIVITIES ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
        description TEXT        NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT now()
      )
    `);
    console.log("✅  Table ready: activities");

    // ── 8. TEAM_MEMBERS (buku kontak global per user) ───────────────────────
    //   Tidak berubah — ini tetap berfungsi sebagai "rubrik kontak" milik user,
    //   bukan sebagai akses ke goal. Akses goal diatur lewat goal_members.
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT        NOT NULL,
        role       TEXT        NOT NULL,
        email      TEXT        NOT NULL,
        status     TEXT        DEFAULT 'Offline',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    console.log("✅  Table ready: team_members");

    // ── 9. INDEXES TAMBAHAN ─────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_goals_user_id
      ON goals (user_id) WHERE deleted_at IS NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_milestones_goal_id
      ON milestones (goal_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_token
      ON sessions (token)
    `);

    console.log("\n🎉  Database berhasil diinisialisasi!");

    if (!isMigrate) {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Cara kerja kolaborasi goal (goal_members):                  ║
║                                                              ║
║  1. Pemilik goal membuat goal bertipe "kelompok".            ║
║  2. Server menyimpan anggota di tabel goal_members           ║
║     (berisi email + nama + role).                            ║
║  3. Saat anggota login, server mencocokkan email mereka      ║
║     dengan goal_members → otomatis mendapat akses ke goal.   ║
║  4. member_user_id diisi → status berubah ke 'active'.       ║
║  5. Milestone bisa di-assign ke email tertentu               ║
║     (kolom assignee_email di tabel milestones).              ║
╚══════════════════════════════════════════════════════════════╝
      `);
    }
  } catch (err) {
    console.error("\n❌  Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initDatabase();
