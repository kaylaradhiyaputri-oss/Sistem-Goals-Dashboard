const express = require("express");
const sql = require("../lib/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware);

// GET /api/goals - Menampilkan goals untuk dashboard utama
router.get("/", async (req, res) => {
  try {
    const goals = await sql`
      SELECT
        g.*,
        -- Total milestone projek
        COUNT(m.id) AS total_milestones,
        COUNT(m.id) FILTER (WHERE m.is_done = true) AS done_milestones,
        
        -- Milestone personal (jika individu, semua milestone. jika kelompok, hanya yang ditugaskan ke user ini)
        COUNT(m.id) FILTER (
          WHERE g.type = 'individu' OR m.assignee_email = ${req.user.email} OR m.assignee_email IS NULL OR m.assignee_email = ''
        ) AS personal_total_milestones,
        COUNT(m.id) FILTER (
          WHERE m.is_done = true AND (g.type = 'individu' OR m.assignee_email = ${req.user.email} OR m.assignee_email IS NULL OR m.assignee_email = '')
        ) AS personal_done_milestones,
        
        -- Progres Projek Total
        COALESCE(
          ROUND((COUNT(m.id) FILTER (WHERE m.is_done = true)::numeric / NULLIF(COUNT(m.id), 0)) * 100, 2),
          g.progress,
          0
        ) AS project_progress
      FROM goals g
      LEFT JOIN milestones m ON m.goal_id = g.id
      WHERE g.user_id = ${req.user.id}
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `;

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
        // Override progress default dengan personal progress agar dashboard utama murni
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
    const [goal] = await sql`
      SELECT * FROM goals
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
    `;

    if (!goal) return res.status(404).json({ error: "Goal tidak ditemukan." });

    const milestones = await sql`
      SELECT * FROM milestones
      WHERE goal_id = ${req.params.id}
      ORDER BY created_at ASC
    `;

    const members = await sql`
      SELECT * FROM goal_members
      WHERE goal_id = ${req.params.id}
      ORDER BY created_at ASC
    `;

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
        progress: personalProgress, // Default untuk personal view
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

// POST /api/goals - Membuat goal baru (Individu / Kelompok)
router.post("/", async (req, res) => {
  const { title, description, deadline, priority = "medium", type = "individu", members = [], milestones = [] } = req.body;
  const cleanTitle = title?.trim();

  if (!cleanTitle) {
    return res.status(400).json({ error: "Judul goal wajib diisi." });
  }

  try {
    const [recentDuplicate] = await sql`
      SELECT * FROM goals
      WHERE user_id = ${req.user.id}
        AND lower(title) = lower(${cleanTitle})
        AND created_at > now() - interval '5 seconds'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (recentDuplicate) {
      return res.status(200).json({
        message: "Goal sudah tersimpan.",
        goal: recentDuplicate,
        milestones: [],
        members: [],
      });
    }

    const [goal] = await sql`
      INSERT INTO goals (user_id, title, description, deadline, priority, type)
      VALUES (${req.user.id}, ${cleanTitle}, ${description?.trim() || null}, ${deadline || null}, ${priority}, ${type})
      RETURNING *
    `;

    // Simpan anggota tim projek (jika bertipe kelompok)
    const savedMembers = [];
    if (type === "kelompok" && Array.isArray(members)) {
      for (const m of members) {
        if (m.name && m.email) {
          const [savedMem] = await sql`
            INSERT INTO goal_members (goal_id, name, email, role)
            VALUES (${goal.id}, ${m.name.trim()}, ${m.email.trim().toLowerCase()}, ${m.role?.trim() || null})
            RETURNING *
          `;
          savedMembers.push(savedMem);
        }
      }
    }

    // Simpan milestones beserta penugasan
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
        const [saved] = await sql`
          INSERT INTO milestones (goal_id, title, assignee_name, assignee_email)
          VALUES (${goal.id}, ${ms.title}, ${ms.assignee_name}, ${ms.assignee_email})
          RETURNING *
        `;
        savedMilestones.push(saved);
      }
    }

    if (deadline) {
      const remindAt = new Date(deadline);
      remindAt.setDate(remindAt.getDate() - 1);
      await sql`
        INSERT INTO reminders (goal_id, remind_at)
        VALUES (${goal.id}, ${remindAt.toISOString()})
      `;
    }

    await sql`
      INSERT INTO activities (user_id, description)
      VALUES (${req.user.id}, ${
        `Anda membuat goal ${type === "kelompok" ? "kelompok" : "individu"} baru: "${cleanTitle}"` +
        (priority ? ` dengan prioritas ${priority}` : "")
      })
    `;

    res.status(201).json({
      message: "Goal berhasil dibuat.",
      goal,
      milestones: savedMilestones,
      members: savedMembers,
    });

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      setImmediate(async () => {
        try {
          const nodemailer = require("nodemailer");
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_PORT === "465",
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
            connectionTimeout: 4000,
            greetingTimeout: 4000,
            socketTimeout: 6000,
          });

          const [user] = await sql`SELECT email, name FROM users WHERE id = ${req.user.id}`;
          if (!user) return;

          await transporter.sendMail({
            from: `"GoalProgress" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: `Goal Baru Dibuat: ${cleanTitle}`,
            text: `Halo ${user.name || "Pengguna"},\n\nGoal baru Anda "${cleanTitle}" (${
              type === "kelompok" ? "Kelompok" : "Individu"
            }) berhasil dibuat dengan deadline ${deadline || "tidak ada"}.\n\nTetap semangat meraih target Anda!\n\nSalam,\nGoalProgress Team`,
          });
        } catch (emailErr) {
          console.error("Gagal mengirim email notifikasi:", emailErr.message);
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
    const [goal] = await sql`
      UPDATE goals
      SET
        title = COALESCE(${cleanTitle || null}, title),
        description = COALESCE(${description?.trim() || null}, description),
        deadline = COALESCE(${deadline}, deadline),
        priority = COALESCE(${priority}, priority),
        updated_at = now()
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
      RETURNING *
    `;

    if (!goal) return res.status(404).json({ error: "Goal tidak ditemukan." });

    res.json({ message: "Goal berhasil diupdate.", goal });
  } catch (err) {
    console.error("Gagal mengupdate goal:", err);
    res.status(500).json({ error: "Gagal mengupdate goal." });
  }
});

// POST /api/goals/:id/members - Menambah anggota tim baru ke goal kelompok
router.post("/:id/members", async (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: "Nama dan email wajib diisi." });

  try {
    // Verifikasi goal milik user
    const [goal] = await sql`
      SELECT id FROM goals WHERE id = ${req.params.id} AND user_id = ${req.user.id}
    `;
    if (!goal) return res.status(404).json({ error: "Goal tidak ditemukan." });

    const [member] = await sql`
      INSERT INTO goal_members (goal_id, name, email, role)
      VALUES (${req.params.id}, ${name.trim()}, ${email.trim().toLowerCase()}, ${role?.trim() || null})
      RETURNING *
    `;

    res.status(201).json(member);
  } catch (err) {
    console.error("Gagal menambahkan anggota ke goal:", err);
    res.status(500).json({ error: "Gagal menambahkan anggota ke goal." });
  }
});

// DELETE /api/goals/:id/members/:memberId - Menghapus anggota tim dari goal kelompok
router.delete("/:id/members/:memberId", async (req, res) => {
  try {
    // Verifikasi goal milik user
    const [goal] = await sql`
      SELECT id FROM goals WHERE id = ${req.params.id} AND user_id = ${req.user.id}
    `;
    if (!goal) return res.status(404).json({ error: "Goal tidak ditemukan." });

    await sql`
      DELETE FROM goal_members
      WHERE id = ${req.params.memberId} AND goal_id = ${req.params.id}
    `;

    res.json({ message: "Anggota berhasil dihapus dari goal." });
  } catch (err) {
    console.error("Gagal menghapus anggota dari goal:", err);
    res.status(500).json({ error: "Gagal menghapus anggota." });
  }
});

// DELETE /api/goals/:id - Menghapus goal
router.delete("/:id", async (req, res) => {
  try {
    const [goal] = await sql`
      DELETE FROM goals
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
      RETURNING *
    `;

    if (!goal) return res.status(404).json({ error: "Goal tidak ditemukan." });

    res.json({ message: "Goal berhasil dihapus." });
  } catch (err) {
    console.error("Gagal menghapus goal:", err);
    res.status(500).json({ error: "Gagal menghapus goal." });
  }
});

module.exports = router;
