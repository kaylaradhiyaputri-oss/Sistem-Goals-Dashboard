const express = require("express");
const pool = require("../lib/db"); // Diubah dari sql menjadi pool
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware);

// GET /api/goals - Menampilkan goals untuk dashboard utama
router.get("/", async (req, res) => {
  try {
    // Parameter: $1 = req.user.email, $2 = req.user.id
    // Soft Delete: Menambahkan filter 'g.deleted_at IS NULL'
    const goalsResult = await pool.query(`
      SELECT
        g.*,
        -- Total milestone projek
        COUNT(m.id) AS total_milestones,
        COUNT(m.id) FILTER (WHERE m.is_done = true) AS done_milestones,
        
        -- Milestone personal
        COUNT(m.id) FILTER (
          WHERE g.type = 'individu' OR m.assignee_email = $1 OR m.assignee_email IS NULL OR m.assignee_email = ''
        ) AS personal_total_milestones,
        COUNT(m.id) FILTER (
          WHERE m.is_done = true AND (g.type = 'individu' OR m.assignee_email = $1 OR m.assignee_email IS NULL OR m.assignee_email = '')
        ) AS personal_done_milestones,
        
        -- Progres Projek Total
        COALESCE(
          ROUND((COUNT(m.id) FILTER (WHERE m.is_done = true)::numeric / NULLIF(COUNT(m.id), 0)) * 100, 2),
          g.progress,
          0
        ) AS project_progress
      FROM goals g
      LEFT JOIN milestones m ON m.goal_id = g.id
      WHERE g.user_id = $2 AND g.deleted_at IS NULL
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `, [req.user.email, req.user.id]);

    const goals = goalsResult.rows;

    const mappedGoals = goals.map((g) => {
      const personalTotal = parseInt(g.personal_total_milestones);
      const personalDone = parseInt(g.personal_done_milestones);
      const personalProgress = personalTotal > 0 ? Math.round((personalDone / personalTotal) * 100 * 100) / 100 : 0;

      return {
        id: g.id,
        user_id: g.user_id,
        title: g.title,
        description: g.description,
        deadline: g.deadline,
        priority: g.priority,
        type: g.type || "individu",
        created_at: g.created_at,
        updated_at: g.updated_at,
        progress: personalProgress,
        personal_progress: personalProgress,
        project_progress: parseFloat(g.project_progress),
        total_milestones: personalTotal,
        done_milestones: personalDone,
        project_total_milestones: parseInt(g.total_milestones),
        project_done_milestones: parseInt(g.done_milestones),
      };
    });

    res.json({ goals: mappedGoals });
  } catch (err) {
    console.error("Gagal mengambil data goals:", err);
    res.status(500).json({ error: "Gagal mengambil data goals." });
  }
});

// GET /api/goals/:id - Detail goal
router.get("/:id", async (req, res) => {
  try {
    const goalResult = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    const goal = goalResult.rows[0];

    if (!goal) return res.status(404).json({ error: "Goal tidak ditemukan." });

    const milestonesResult = await pool.query(
      'SELECT * FROM milestones WHERE goal_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    const milestones = milestonesResult.rows;

    const membersResult = await pool.query(
      'SELECT * FROM goal_members WHERE goal_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC',
      [req.params.id]
    );
    const members = membersResult.rows;

    // Hitung progres
    const total = milestones.length;
    const done = milestones.filter((ms) => ms.is_done).length;
    const projectProgress = total > 0 ? Math.round((done / total) * 100 * 100) / 100 : Number(goal.progress || 0);

    const personalMilestones = milestones.filter(
      (ms) => goal.type === "individu" || ms.assignee_email === req.user.email || !ms.assignee_email || ms.assignee_email === ""
    );
    const personalTotal = personalMilestones.length;
    const personalDone = personalMilestones.filter((ms) => ms.is_done).length;
    const personalProgress = personalTotal > 0 ? Math.round((personalDone / personalTotal) * 100 * 100) / 100 : 0;

    res.json({
      goal: {
        ...goal,
        type: goal.type || "individu",
        progress: personalProgress, 
        personal_progress: personalProgress,
        project_progress: projectProgress,
      },
      milestones,
      members,
    });
  } catch (err) {
    console.error("Gagal mengambil detail goal:", err);
    res.status(500).json({ error: "Gagal mengambil detail goal." });
  }
});

// POST /api/goals - Membuat goal baru
router.post("/", async (req, res) => {
  const { title, description, deadline, priority = "medium", type = "individu", members = [], milestones = [] } = req.body;
  const cleanTitle = title?.trim();

  if (!cleanTitle) {
    return res.status(400).json({ error: "Judul goal wajib diisi." });
  }

  try {
    const dupResult = await pool.query(`
      SELECT * FROM goals
      WHERE user_id = $1
        AND lower(title) = lower($2)
        AND created_at > now() - interval '5 seconds'
      ORDER BY created_at DESC
      LIMIT 1
    `, [req.user.id, cleanTitle]);
    
    const recentDuplicate = dupResult.rows[0];

    if (recentDuplicate) {
      return res.status(200).json({
        message: "Goal sudah tersimpan.",
        goal: recentDuplicate,
        milestones: [],
        members: [],
      });
    }

    const goalResult = await pool.query(`
      INSERT INTO goals (user_id, title, description, deadline, priority, type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.user.id, cleanTitle, description?.trim() || null, deadline || null, priority, type]);
    
    const goal = goalResult.rows[0];

    // Simpan anggota tim
    const savedMembers = [];
    if (type === "kelompok" && Array.isArray(members)) {
      for (const m of members) {
        if (m.name && m.email) {
          const memResult = await pool.query(`
            INSERT INTO goal_members (goal_id, name, email, role)
            VALUES ($1, $2, $3, $4)
            RETURNING *
          `, [goal.id, m.name.trim(), m.email.trim().toLowerCase(), m.role?.trim() || null]);
          savedMembers.push(memResult.rows[0]);
        }
      }
    }

    // Simpan milestones
    const savedMilestones = [];
    if (Array.isArray(milestones)) {
      const cleanMilestones = milestones
        .map((ms) => ({
          title: ms?.title?.trim(),
          assignee_name: ms?.assignee_name?.trim() || null,
          assignee_email: ms?.assignee_email?.trim()?.toLowerCase() || null,
        }))
        .filter((ms) => ms.title);

      for (const ms of cleanMilestones) {
        const msResult = await pool.query(`
          INSERT INTO milestones (goal_id, title, assignee_name, assignee_email)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [goal.id, ms.title, ms.assignee_name, ms.assignee_email]);
        savedMilestones.push(msResult.rows[0]);
      }
    }

    if (deadline) {
      const remindAt = new Date(deadline);
      remindAt.setDate(remindAt.getDate() - 1);
      await pool.query(
        'INSERT INTO reminders (goal_id, remind_at) VALUES ($1, $2)',
        [goal.id, remindAt.toISOString()]
      );
    }

    const descStr = `Anda membuat goal ${type === "kelompok" ? "kelompok" : "individu"} baru: "${cleanTitle}"` + (priority ? ` dengan prioritas ${priority}` : "");
    await pool.query(
      'INSERT INTO activities (user_id, description) VALUES ($1, $2)',
      [req.user.id, descStr]
    );

    res.status(201).json({
      message: "Goal berhasil dibuat.",
      goal,
      milestones: savedMilestones,
      members: savedMembers,
    });

    // Email Notification
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      setImmediate(async () => {
        try {
          const nodemailer = require("nodemailer");
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_PORT === "465",
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });

          const userResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [req.user.id]);
          const user = userResult.rows[0];
          
          if (!user) return;

          await transporter.sendMail({
            from: `"GoalProgress" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: `Goal Baru Dibuat: ${cleanTitle}`,
            text: `Halo ${user.name || "Pengguna"},\n\nGoal baru Anda "${cleanTitle}" berhasil dibuat.\n\nTetap semangat meraih target Anda!\n\nSalam,\nGoalProgress Team`,
          });
        } catch (emailErr) {
          console.error("Gagal mengirim email:", emailErr.message);
        }
      });
    }
  } catch (err) {
    console.error("Gagal membuat goal:", err);
    res.status(500).json({ error: "Gagal membuat goal." });
  }
});

// PUT /api/goals/:id - Mengupdate metadata goal
router.put("/:id", async (req, res) => {
  const { title, description, deadline, priority } = req.body;
  const cleanTitle = title?.trim();

  try {
    const updateResult = await pool.query(`
      UPDATE goals
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        deadline = COALESCE($3, deadline),
        priority = COALESCE($4, priority),
        updated_at = now()
      WHERE id = $5 AND user_id = $6 AND deleted_at IS NULL
      RETURNING *
    `, [cleanTitle || null, description?.trim() || null, deadline || null, priority || null, req.params.id, req.user.id]);

    const goal = updateResult.rows[0];
    if (!goal) return res.status(404).json({ error: "Goal tidak ditemukan." });

    res.json({ message: "Goal berhasil diupdate.", goal });
  } catch (err) {
    console.error("Gagal mengupdate goal:", err);
    res.status(500).json({ error: "Gagal mengupdate goal." });
  }
});

// POST /api/goals/:id/members - Menambah anggota tim baru
router.post("/:id/members", async (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: "Nama dan email wajib diisi." });

  try {
    const goalResult = await pool.query(
      'SELECT id FROM goals WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (goalResult.rows.length === 0) return res.status(404).json({ error: "Goal tidak ditemukan." });

    const memResult = await pool.query(`
      INSERT INTO goal_members (goal_id, name, email, role)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.params.id, name.trim(), email.trim().toLowerCase(), role?.trim() || null]);

    res.status(201).json(memResult.rows[0]);
  } catch (err) {
    console.error("Gagal menambahkan anggota:", err);
    res.status(500).json({ error: "Gagal menambahkan anggota." });
  }
});

// DELETE /api/goals/:id/members/:memberId - Menghapus anggota tim
router.delete("/:id/members/:memberId", async (req, res) => {
  try {
    const goalResult = await pool.query(
      'SELECT id FROM goals WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (goalResult.rows.length === 0) return res.status(404).json({ error: "Goal tidak ditemukan." });

    // Hapus permanen anggota atau bisa di-soft delete juga. Disini kita hapus permanen agar sederhana
    await pool.query(
      'DELETE FROM goal_members WHERE id = $1 AND goal_id = $2',
      [req.params.memberId, req.params.id]
    );

    res.json({ message: "Anggota berhasil dihapus." });
  } catch (err) {
    console.error("Gagal menghapus anggota:", err);
    res.status(500).json({ error: "Gagal menghapus anggota." });
  }
});

// DELETE /api/goals/:id - Menghapus goal (SOFT DELETE IMPLEMENTATION)
router.delete("/:id", async (req, res) => {
  try {
    // Sesuai dokumen D3, data tidak di-DELETE permanen melainkan ditandai deleted_at
    const deleteResult = await pool.query(`
      UPDATE goals 
      SET deleted_at = now() 
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      RETURNING *
    `, [req.params.id, req.user.id]);

    const goal = deleteResult.rows[0];
    if (!goal) return res.status(404).json({ error: "Goal tidak ditemukan." });

    res.json({ message: "Goal berhasil dihapus (Soft Delete)." });
  } catch (err) {
    console.error("Gagal menghapus goal:", err);
    res.status(500).json({ error: "Gagal menghapus goal." });
  }
});

module.exports = router;