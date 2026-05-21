const express = require("express");
const sql = require("../lib/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware);

// PATCH /api/milestones/:id/done - Mengubah status milestone selesai/belum
router.patch("/:id/done", async (req, res) => {
  const { is_done } = req.body;

  if (typeof is_done !== "boolean") {
    return res.status(400).json({ error: "Status milestone harus bernilai true atau false." });
  }

  try {
    // 1. Dapatkan info user saat ini
    const [user] = await sql`SELECT email, name FROM users WHERE id = ${req.user.id}`;
    const userEmail = user?.email;

    // 2. Ambil milestone lama sebelum update (untuk tahu goal_id)
    const [existingMilestone] = await sql`
      SELECT m.*, g.user_id AS goal_creator_id FROM milestones m
      JOIN goals g ON g.id = m.goal_id
      WHERE m.id = ${req.params.id}
    `;

    if (!existingMilestone) {
      return res.status(404).json({ error: "Milestone tidak ditemukan." });
    }

    // 3. Verifikasi apakah user boleh mengupdate milestone ini
    // Boleh jika pencipta goal, ATAU jika email penugasan cocok dengan email user
    const isCreator = existingMilestone.goal_creator_id === req.user.id;
    const isAssignee = existingMilestone.assignee_email && existingMilestone.assignee_email.toLowerCase() === userEmail.toLowerCase();

    if (!isCreator && !isAssignee) {
      return res.status(403).json({ error: "Akses ditolak. Anda tidak memiliki izin pada milestone ini." });
    }

    // 4. Update status milestone
    const [milestone] = await sql`
      UPDATE milestones
      SET is_done = ${is_done}, updated_at = now()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    const [goal] = await sql`
      SELECT * FROM goals WHERE id = ${milestone.goal_id}
    `;

    // 5. Ambil semua milestone untuk hitung progres
    const milestones = await sql`
      SELECT * FROM milestones WHERE goal_id = ${milestone.goal_id}
    `;

    const total = milestones.length;
    const done = milestones.filter((ms) => ms.is_done).length;
    const projectProgress = total > 0 ? Math.round((done / total) * 100 * 100) / 100 : 0;

    // Hitung progres personal (milestone milik user ini / kosong)
    const personalMilestones = milestones.filter(
      (ms) => goal.type === "individu" || ms.assignee_email === userEmail || !ms.assignee_email || ms.assignee_email === ""
    );
    const personalTotal = personalMilestones.length;
    const personalDone = personalMilestones.filter((ms) => ms.is_done).length;
    const personalProgress = personalTotal > 0 ? Math.round((personalDone / personalTotal) * 100 * 100) / 100 : 0;

    // 6. Simpan projectProgress di goals.progress ( database menyimpan progres global projek )
    const [updatedGoal] = await sql`
      UPDATE goals
      SET progress = ${projectProgress}, updated_at = now()
      WHERE id = ${milestone.goal_id}
      RETURNING *
    `;

    // Log ke tabel activities jika milestone diselesaikan (is_done === true)
    if (is_done) {
      try {
        const displayName = user?.name || user?.email || "Seorang pengguna";
        await sql`
          INSERT INTO activities (user_id, description)
          VALUES (${req.user.id}, ${
            `${displayName} menyelesaikan milestone "${milestone.title}"` +
            (goal ? ` di goal "${goal.title}"` : "")
          })
        `;
      } catch (actErr) {
        console.error("⚠️ Gagal mencatat aktivitas milestone:", actErr.message);
      }
    }

    res.json({
      message: "Milestone diupdate.",
      milestone,
      progress: personalProgress, // Default untuk personal view di dashboard utama
      project_progress: projectProgress,
      goal: {
        ...updatedGoal,
        type: goal.type || "individu",
        progress: personalProgress,
        personal_progress: personalProgress,
        project_progress: projectProgress,
      },
    });
  } catch (err) {
    console.error("Gagal mengupdate milestone:", err);
    res.status(500).json({ error: `Gagal mengupdate milestone: ${err.message}` });
  }
});

// POST /api/milestones - Menambahkan milestone baru ke goal
router.post("/", async (req, res) => {
  const { goal_id, title, assignee_name, assignee_email } = req.body;
  const cleanTitle = title?.trim();

  if (!goal_id || !cleanTitle) {
    return res.status(400).json({ error: "goal_id dan title wajib diisi." });
  }

  try {
    // Verifikasi goal milik user
    const [goal] = await sql`
      SELECT * FROM goals WHERE id = ${goal_id} AND user_id = ${req.user.id}
    `;
    if (!goal) return res.status(403).json({ error: "Akses ditolak." });

    const [recentDuplicate] = await sql`
      SELECT * FROM milestones
      WHERE goal_id = ${goal_id}
        AND lower(title) = lower(${cleanTitle})
        AND created_at > now() - interval '5 seconds'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (recentDuplicate) {
      return res.status(200).json({ message: "Milestone sudah tersimpan.", milestone: recentDuplicate });
    }

    const [milestone] = await sql`
      INSERT INTO milestones (goal_id, title, assignee_name, assignee_email)
      VALUES (${goal_id}, ${cleanTitle}, ${assignee_name || null}, ${assignee_email || null})
      RETURNING *
    `;

    // Recalculate progress for the goal
    const milestones = await sql`
      SELECT * FROM milestones WHERE goal_id = ${goal_id}
    `;

    const total = milestones.length;
    const done = milestones.filter((ms) => ms.is_done).length;
    const projectProgress = total > 0 ? Math.round((done / total) * 100 * 100) / 100 : 0;

    await sql`
      UPDATE goals
      SET progress = ${projectProgress}, updated_at = now()
      WHERE id = ${goal_id}
    `;

    // Hitung personal progress
    const [currentUser] = await sql`SELECT email FROM users WHERE id = ${req.user.id}`;
    const userEmail = currentUser?.email;
    const personalMilestones = milestones.filter(
      (ms) => goal.type === "individu" || ms.assignee_email === userEmail || !ms.assignee_email || ms.assignee_email === ""
    );
    const personalTotal = personalMilestones.length;
    const personalDone = personalMilestones.filter((ms) => ms.is_done).length;
    const personalProgress = personalTotal > 0 ? Math.round((personalDone / personalTotal) * 100 * 100) / 100 : 0;

    res.status(201).json({
      message: "Milestone ditambahkan.",
      milestone,
      progress: personalProgress,
      project_progress: projectProgress,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menambahkan milestone." });
  }
});

// DELETE /api/milestones/:id - Menghapus milestone
router.delete("/:id", async (req, res) => {
  try {
    const [milestone] = await sql`
      SELECT m.*, g.type AS goal_type FROM milestones m
      JOIN goals g ON g.id = m.goal_id
      WHERE m.id = ${req.params.id} AND g.user_id = ${req.user.id}
    `;
    if (!milestone) return res.status(404).json({ error: "Milestone tidak ditemukan." });

    await sql`DELETE FROM milestones WHERE id = ${req.params.id}`;

    const milestones = await sql`
      SELECT * FROM milestones WHERE goal_id = ${milestone.goal_id}
    `;

    const total = milestones.length;
    const done = milestones.filter((ms) => ms.is_done).length;
    const projectProgress = total > 0 ? Math.round((done / total) * 100 * 100) / 100 : 0;

    await sql`
      UPDATE goals
      SET progress = ${projectProgress}, updated_at = now()
      WHERE id = ${milestone.goal_id}
    `;

    // Hitung personal progress
    const [currentUser] = await sql`SELECT email FROM users WHERE id = ${req.user.id}`;
    const userEmail = currentUser?.email;
    const personalMilestones = milestones.filter(
      (ms) => milestone.goal_type === "individu" || ms.assignee_email === userEmail || !ms.assignee_email || ms.assignee_email === ""
    );
    const personalTotal = personalMilestones.length;
    const personalDone = personalMilestones.filter((ms) => ms.is_done).length;
    const personalProgress = personalTotal > 0 ? Math.round((personalDone / personalTotal) * 100 * 100) / 100 : 0;

    res.json({
      message: "Milestone dihapus.",
      progress: personalProgress,
      project_progress: projectProgress,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menghapus milestone." });
  }
});

module.exports = router;
