// ─────────────────────────────────────────────────────────────────────────────
// node lib/migration-v2.js
//
// Menambahkan kolom yang dibutuhkan untuk fitur "anggota bisa lihat goal":
//   • goal_members.member_user_id  → link ke users.id (nullable)
//   • goal_members.status          → 'pending' | 'active'
//   • goal_members.joined_at       → timestamp klaim
//   • goals.project_progress       → progress rata-rata seluruh anggota
//   • UNIQUE constraint (goal_id, email) di goal_members
//   • Index idx_goal_members_email untuk query cepat
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const pool = require("./db");

async function runMigrationV2() {
  console.log("\n🚀  Migration v2: fitur kolaborasi goal\n");

  try {
    // 1. Kolom baru di goal_members
    await pool.query(`
      ALTER TABLE goal_members
        ADD COLUMN IF NOT EXISTS member_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS status         TEXT DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS joined_at      TIMESTAMPTZ
    `);
    console.log("✅  goal_members: kolom member_user_id, status, joined_at ditambahkan.");

    // 2. Kolom baru di goals
    await pool.query(`
      ALTER TABLE goals
        ADD COLUMN IF NOT EXISTS project_progress NUMERIC(5,2) DEFAULT 0
    `);
    console.log("✅  goals: kolom project_progress ditambahkan.");

    // 3. UNIQUE constraint (goal_id, email) — cegah anggota duplikat per goal
    //    Pakai IF NOT EXISTS lewat pg_constraint catalog agar idempoten
    const { rows: existing } = await pool.query(`
      SELECT 1 FROM pg_constraint
      WHERE conname = 'goal_members_goal_id_email_key'
    `);
    if (existing.length === 0) {
      // Hapus duplikat terlebih dulu sebelum buat constraint
      await pool.query(`
        DELETE FROM goal_members a
        USING goal_members b
        WHERE a.id > b.id
          AND a.goal_id = b.goal_id
          AND a.email   = b.email
      `);
      await pool.query(`
        ALTER TABLE goal_members
          ADD CONSTRAINT goal_members_goal_id_email_key UNIQUE (goal_id, email)
      `);
      console.log("✅  goal_members: UNIQUE constraint (goal_id, email) ditambahkan.");
    } else {
      console.log("✔   goal_members: UNIQUE constraint sudah ada.");
    }

    // 4. Index untuk query "semua goal yang bisa diakses email X"
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_goal_members_email
      ON goal_members (email)
    `);
    console.log("✅  Index idx_goal_members_email dibuat.");

    // 5. Isi member_user_id untuk anggota yang emailnya sudah terdaftar
    const claimResult = await pool.query(`
      UPDATE goal_members gm
      SET
        member_user_id = u.id,
        status         = 'active',
        joined_at      = COALESCE(gm.joined_at, now())
      FROM users u
      WHERE gm.email = u.email
        AND gm.member_user_id IS NULL
    `);
    console.log(`✅  Klaim otomatis: ${claimResult.rowCount} baris goal_members dihubungkan ke akun yang sudah ada.`);

    console.log("\n🎉  Migration v2 selesai!\n");
    process.exit(0);
  } catch (err) {
    console.error("\n❌  Migration v2 error:", err.message);
    process.exit(1);
  }
}

runMigrationV2();
