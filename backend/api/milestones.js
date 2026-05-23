const express = require("express");
const pool = require("../lib/db"); // Diubah menjadi pool
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
    const userResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
    const userEmail = user?.email;

    // 2. Ambil milestone lama sebelum update (untuk tahu goal_id)
    const existingResult = await pool.query(`
      SELECT m.*, g.user_id AS goal_creator_id FROM milestones m
      JOIN goals g ON g.id = m.goal_id
      WHERE m.id = $1
    `, [req.params.id]);
    const existingMilestone = existingResult.rows[0];

    if (!existingMilestone) {
      return res.status(404).json({ error: "Milestone tidak ditemukan." });
    }

    // 3. Verifikasi apakah user boleh mengupdate milestone ini
    const isCreator = existingMilestone.goal_creator_id === req.user.id;
    const isAssignee = existingMilestone.assignee_email && existingMilestone.assignee_email.toLowerCase() === userEmail.toLowerCase();

    if (!isCreator && !isAssignee) {
      return res.status(403).json({ error: "Akses ditolak. Anda tidak memiliki izin pada milestone ini." });
    }

    // 4. Update status milestone
    const milestoneResult = await pool.query(`
      UPDATE milestones
      SET is_done = $1, updated_at = now()
      WHERE id = $2
      RETURNING *
    `, [is_done, req.params.id]);
    const milestone = milestoneResult.rows[0];

    const goalResult = await pool.query('SELECT * FROM goals WHERE id = $1', [milestone.goal_id]);
    const goal = goalResult.rows[0];

    // 5. Ambil semua milestone untuk hitung progres
    const milestonesResult = await pool.query('SELECT * FROM milestones WHERE goal_id = $1', [milestone.goal_id]);
    const milestones = milestonesResult.rows;

    const total = milestones.length;
    const done = milestones.filter((ms) => ms.is_done).length;
    const projectProgress = total > 0 ? Math.round((done / total) * 100 * 100) / 100 : 0;

    // Hitung progres personal
    const personalMilestones = milestones.filter(
      (ms) => goal.type === "individu" || ms.assignee_email === userEmail || !ms.assignee_email || ms.assignee_email === ""
    );
    const personalTotal = personalMilestones.length;
    const personalDone = personalMilestones.filter((ms) => ms.is_done).length;
    const personalProgress = personalTotal > 0 ? Math.round((personalDone / personalTotal) * 100 * 100) / 100 : 0;

    // 6. Simpan projectProgress di goals.progress
    const updatedGoalResult = await pool.query(`
      UPDATE goals
      SET progress = $1, updated_at = now()
      WHERE id = $2
      RETURNING *
    `, [projectProgress, milestone.goal_id]);
    const updatedGoal = updatedGoalResult.rows[0];

    // Log ke tabel activities jika milestone diselesaikan (is_done === true)
    if (is_done) {
      try {
        const displayName = user?.name || user?.email || "Seorang pengguna";
        const descText = `${displayName} menyelesaikan milestone "${milestone.title}"` + (goal ? ` di goal "${goal.title}"` : "");
        await pool.query(
          'INSERT INTO activities (user_id, description) VALUES ($1, $2)',
          [req.user.id, descText]
        );
      } catch (actErr) {
        console.error("⚠️ Gagal mencatat aktivitas milestone:", actErr.message);
      }
    }

    res.json({
      message: "Milestone diupdate.",
      milestone,
      progress: personalProgress, 
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
    const goalResult = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
      [goal_id, req.user.id]
    );
    const goal = goalResult.rows[0];
    if (!goal) return res.status(403).json({ error: "Akses ditolak." });

    const dupResult = await pool.query(`
      SELECT * FROM milestones
      WHERE goal_id = $1
        AND lower(title) = lower($2)
        AND created_at > now() - interval '5 seconds'
      ORDER BY created_at DESC
      LIMIT 1
    `, [goal_id, cleanTitle]);
    const recentDuplicate = dupResult.rows[0];

    if (recentDuplicate) {
      return res.status(200).json({ message: "Milestone sudah tersimpan.", milestone: recentDuplicate });
    }

    const milestoneResult = await pool.query(`
      INSERT INTO milestones (goal_id, title, assignee_name, assignee_email)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [goal_id, cleanTitle, assignee_name || null, assignee_email || null]);
    const milestone = milestoneResult.rows[0];

    // Recalculate progress for the goal
    const milestonesResult = await pool.query('SELECT * FROM milestones WHERE goal_id = $1', [goal_id]);
    const milestones = milestonesResult.rows;

    const total = milestones.length;
    const done = milestones.filter((ms) => ms.is_done).length;
    const projectProgress = total > 0 ? Math.round((done / total) * 100 * 100) / 100 : 0;

    await pool.query(
      'UPDATE goals SET progress = $1, updated_at = now() WHERE id = $2',
      [projectProgress, goal_id]
    );

    // Hitung personal progress
    const currentUserResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    const currentUser = currentUserResult.rows[0];
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
    const milestoneResult = await pool.query(`
      SELECT m.*, g.type AS goal_type FROM milestones m
      JOIN goals g ON g.id = m.goal_id
      WHERE m.id = $1 AND g.user_id = $2
    `, [req.params.id, req.user.id]);
    const milestone = milestoneResult.rows[0];
    
    if (!milestone) return res.status(404).json({ error: "Milestone tidak ditemukan." });

    // Hapus fisik untuk milestone (tidak perlu soft delete)
    await pool.query('DELETE FROM milestones WHERE id = $1', [req.params.id]);

    const milestonesResult = await pool.query('SELECT * FROM milestones WHERE goal_id = $1', [milestone.goal_id]);
    const milestones = milestonesResult.rows;

    const total = milestones.length;
    const done = milestones.filter((ms) => ms.is_done).length;
    const projectProgress = total > 0 ? Math.round((done / total) * 100 * 100) / 100 : 0;

    await pool.query(
      'UPDATE goals SET progress = $1, updated_at = now() WHERE id = $2',
      [projectProgress, milestone.goal_id]
    );

    // Hitung personal progress
    const currentUserResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    const currentUser = currentUserResult.rows[0];
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