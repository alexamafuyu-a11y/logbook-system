const express = require('express');
const router = express.Router();
const db = require('../database');

// Helper function to get Philippine Time (UTC+8)
function getPhilippineDateTime() {
  // Create date object
  const now = new Date();
  
  // Get timezone offset for Asia/Manila (UTC+8)
  // Using toLocaleString to get the correct time
  const phTimeString = now.toLocaleString('en-US', { timeZone: 'Asia/Manila' });
  const phTime = new Date(phTimeString);
  
  // Format as YYYY-MM-DD HH:MM:SS
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

    if (lab && lab !== 'all') {
      query += ' AND lab = ?';
      params.push(lab);
    }

    if (date_from) {
      query += ' AND DATE(time_in) >= DATE(?)';
      params.push(date_from);
    }

    if (date_to) {
      query += ' AND DATE(time_in) <= DATE(?)';
      params.push(date_to);
    }

    if (status === 'inside') {
      query += ' AND time_out IS NULL';
    } else if (status === 'out') {
      query += ' AND time_out IS NOT NULL';
    }

    if (search) {
      query += ' AND (student_id LIKE ? OR full_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
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
    const query = `
      SELECT * FROM logs 
      WHERE lab = ? AND DATE(time_in) = DATE(?)
      ORDER BY time_in DESC
    `;
    const logs = await db.allQuery(query, [lab, todayDate]);
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
    console.log('Lab:', lab);
    console.log('Student:', studentId, '-', fullName);
    console.log('Philippine Time:', currentDateTime);
    console.log('Philippine Date:', currentDate);
    console.log('========================================');
    
    // Check if already timed in today
    const checkQuery = `
      SELECT * FROM logs 
      WHERE lab = ? AND student_id = ? AND DATE(time_in) = DATE(?) AND time_out IS NULL
    `;
    const existing = await db.getQuery(checkQuery, [lab, studentId, currentDate]);
    
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        error: 'Student already has an active session in this lab' 
      });
    }

    // Create new log entry
    const logId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const query = `
      INSERT INTO logs (log_id, lab, student_id, full_name, program, purpose, time_in)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await db.runQuery(query, [logId, lab, studentId, fullName, program, purpose, currentDateTime]);
    
    console.log('✅ Time in recorded successfully!');
    console.log('Log ID:', logId);
    console.log('Time:', currentDateTime);
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
    console.log('TIME OUT REQUEST:');
    console.log('Log ID:', logId);
    console.log('Philippine Time:', currentDateTime);
    console.log('========================================');
    
    const query = `
      UPDATE logs 
      SET time_out = ?
      WHERE log_id = ? AND time_out IS NULL
    `;
    
    const result = await db.runQuery(query, [currentDateTime, logId]);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Log entry not found or already timed out' });
    }
    
    console.log('✅ Time out recorded successfully at', currentDateTime);
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
    
    const query = `
      SELECT * FROM logs 
      WHERE lab = ? AND DATE(time_in) = DATE(?) AND time_out IS NULL
      AND (student_id LIKE ? OR full_name LIKE ?)
      ORDER BY time_in DESC
    `;
    
    const logs = await db.allQuery(query, [lab, currentDate, `%${q}%`, `%${q}%`]);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error in GET /search-active:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

module.exports = router;