const express = require("express");
const sql = require("../lib/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware);

// GET /api/team
router.get("/", async (req, res) => {
  try {
    const members = await sql`
      SELECT * FROM team_members
      WHERE user_id = ${req.user.id}
      ORDER BY created_at DESC
    `;
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data tim." });
  }
});

// POST /api/team
router.post("/", async (req, res) => {
  const { name, role, email, status } = req.body;
  const cleanName = name?.trim();
  const cleanRole = role?.trim();
  const cleanEmail = email?.trim().toLowerCase();

  if (!cleanName || !cleanRole || !cleanEmail) {
    return res.status(400).json({ error: "Nama, role, dan email wajib diisi." });
  }

  try {
    const [recentDuplicate] = await sql`
      SELECT * FROM team_members
      WHERE user_id = ${req.user.id}
        AND lower(email) = lower(${cleanEmail})
        AND created_at > now() - interval '5 seconds'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (recentDuplicate) {
      return res.status(200).json({ message: "Anggota tim sudah tersimpan.", member: recentDuplicate });
    }

    const [member] = await sql`
      INSERT INTO team_members (user_id, name, role, email, status)
      VALUES (${req.user.id}, ${cleanName}, ${cleanRole}, ${cleanEmail}, ${status || "Offline"})
      RETURNING *
    `;

    // Log ke activities
    try {
      const [user] = await sql`SELECT name, email FROM users WHERE id = ${req.user.id}`;
      const displayName = user?.name || user?.email || "Seorang pengguna";
      await sql`
        INSERT INTO activities (user_id, description)
        VALUES (${req.user.id}, ${`${displayName} menambahkan "${cleanName}" (${cleanRole}) ke dalam tim.`})
      `;
    } catch (actErr) {
      console.error("⚠️ Gagal mencatat aktivitas tim:", actErr.message);
    }

    res.status(201).json({ message: "Anggota tim berhasil ditambahkan.", member });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menambahkan anggota tim." });
  }
});

// DELETE /api/team/:id
router.delete("/:id", async (req, res) => {
  try {
    const [existing] = await sql`
      SELECT * FROM team_members
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
    `;

    if (!existing) {
      return res.status(404).json({ error: "Anggota tim tidak ditemukan." });
    }

    await sql`
      DELETE FROM team_members
      WHERE id = ${req.params.id}
    `;

    // Log ke activities
    try {
      const [user] = await sql`SELECT name, email FROM users WHERE id = ${req.user.id}`;
      const displayName = user?.name || user?.email || "Seorang pengguna";
      await sql`
        INSERT INTO activities (user_id, description)
        VALUES (${req.user.id}, ${`${displayName} menghapus "${existing.name}" dari tim.`})
      `;
    } catch (actErr) {
      console.error("⚠️ Gagal mencatat aktivitas tim:", actErr.message);
    }

    res.json({ message: "Anggota tim berhasil dihapus." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menghapus anggota tim." });
  }
});

module.exports = router;
