const express = require('express');
const router = express.Router();
const db = require('../database');

// Helper function to get Philippine Time (UTC+8)
function getPhilippineDateTime() {
  const now = new Date();
  const phTimeString = now.toLocaleString('en-US', { timeZone: 'Asia/Manila' });
  const phTime = new Date(phTimeString);

  const year = phTime.getFullYear();
  const month = String(phTime.getMonth() + 1).padStart(2, '0');
  const day = String(phTime.getDate()).padStart(2, '0');
  const hours = String(phTime.getHours()).padStart(2, '0');
  const minutes = String(phTime.getMinutes()).padStart(2, '0');
  const seconds = String(phTime.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getPhilippineDate() {
  const phTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const year = phTime.getFullYear();
  const month = String(phTime.getMonth() + 1).padStart(2, '0');
  const day = String(phTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get all logs with filters (public)
router.get('/', async (req, res) => {
  try {
    const { lab, date_from, date_to, status, search } = req.query;
    let query = 'SELECT * FROM logs WHERE 1=1';
    let params = [];
    let paramCount = 0;

    if (lab && lab !== 'all') {
      paramCount++;
      query += ` AND lab = $${paramCount}`;
      params.push(lab);
    }

    if (date_from) {
      paramCount++;
      query += ` AND DATE(time_in) >= $${paramCount}::date`;
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      query += ` AND DATE(time_in) <= $${paramCount}::date`;
      params.push(date_to);
    }

    if (status === 'inside') {
      query += ' AND time_out IS NULL';
    } else if (status === 'out') {
      query += ' AND time_out IS NOT NULL';
    }

    if (search) {
      paramCount++;
      query += ` AND (student_id ILIKE $${paramCount} OR full_name ILIKE $${paramCount + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramCount++;
    }

    query += ' ORDER BY time_in DESC';

    const logs = await db.allQuery(query, params);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error in GET /:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

// Get today's logs for a specific lab
router.get('/lab/:lab/today', async (req, res) => {
  try {
    const { lab } = req.params;
    const todayDate = getPhilippineDate();
    const logs = await db.allQuery(`
      SELECT * FROM logs
      WHERE lab = $1 AND DATE(time_in) = $2::date
      ORDER BY time_in DESC
    `, [lab, todayDate]);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error in GET /lab/:lab/today:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

// Create new time-in entry
router.post('/timein', async (req, res) => {
  try {
    const { lab, studentId, fullName, program, purpose } = req.body;
    const currentDateTime = getPhilippineDateTime();
    const currentDate = getPhilippineDate();

    console.log('========================================');
    console.log('TIME IN REQUEST:');
    console.log('Lab:', lab, '| Student:', studentId, '-', fullName);
    console.log('Philippine Time:', currentDateTime);
    console.log('========================================');

    // Check if already timed in today
    const existing = await db.getQuery(`
      SELECT * FROM logs
      WHERE lab = $1 AND student_id = $2 AND DATE(time_in) = $3::date AND time_out IS NULL
    `, [lab, studentId, currentDate]);

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Student already has an active session in this lab'
      });
    }

    // Create new log entry
    const logId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    await db.runQuery(`
      INSERT INTO logs (log_id, lab, student_id, full_name, program, purpose, time_in)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [logId, lab, studentId, fullName, program, purpose, currentDateTime]);

    console.log('✅ Time in recorded! Log ID:', logId);
    console.log('========================================');

    res.json({ success: true, message: 'Time in recorded successfully', logId });
  } catch (error) {
    console.error('Error in POST /timein:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

// Time out
router.post('/timeout', async (req, res) => {
  try {
    const { logId } = req.body;
    const currentDateTime = getPhilippineDateTime();

    console.log('========================================');
    console.log('TIME OUT REQUEST | Log ID:', logId);
    console.log('Philippine Time:', currentDateTime);
    console.log('========================================');

    const result = await db.runQuery(`
      UPDATE logs
      SET time_out = $1
      WHERE log_id = $2 AND time_out IS NULL
    `, [currentDateTime, logId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Log entry not found or already timed out' });
    }

    console.log('✅ Time out recorded at', currentDateTime);
    console.log('========================================');

    res.json({ success: true, message: 'Time out recorded successfully' });
  } catch (error) {
    console.error('Error in POST /timeout:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

// Search active sessions for time out
router.get('/search-active', async (req, res) => {
  try {
    const { q, lab } = req.query;
    const currentDate = getPhilippineDate();

    if (!q) {
      return res.json({ success: true, data: [] });
    }

    const logs = await db.allQuery(`
      SELECT * FROM logs
      WHERE lab = $1 AND DATE(time_in) = $2::date AND time_out IS NULL
      AND (student_id ILIKE $3 OR full_name ILIKE $4)
      ORDER BY time_in DESC
    `, [lab, currentDate, `%${q}%`, `%${q}%`]);

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error in GET /search-active:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

module.exports = router;