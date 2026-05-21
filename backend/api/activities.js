const express = require("express");
const sql = require("../lib/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware);

// GET /api/activities - Ambil aktivitas terbaru pengguna
router.get("/", async (req, res) => {
  try {
    const activities = await sql`
      SELECT * FROM activities
      WHERE user_id = ${req.user.id}
      ORDER BY created_at DESC
      LIMIT 20
    `;
    res.json({ activities });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil aktivitas terbaru." });
  }
});

module.exports = router;
