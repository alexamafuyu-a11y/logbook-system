const express = require('express');
const router = express.Router();
const db = require('../database');

// Get lab statistics (public)
router.get('/stats', async (req, res) => {
  try {
    const stats = {};

    for (let i = 1; i <= 3; i++) {
      const activeCount = await db.getQuery(`
        SELECT COUNT(*) as count FROM logs
        WHERE lab = $1 AND DATE(time_in) = CURRENT_DATE AND time_out IS NULL
      `, [i.toString()]);

      const totalToday = await db.getQuery(`
        SELECT COUNT(*) as count FROM logs
        WHERE lab = $1 AND DATE(time_in) = CURRENT_DATE
      `, [i.toString()]);

      stats[`lab${i}`] = {
        active: activeCount ? parseInt(activeCount.count) : 0,
        totalToday: totalToday ? parseInt(totalToday.count) : 0
      };
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error in GET /stats:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

module.exports = router;