const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('Login attempt for username:', username);
    
    const admin = await db.getQuery('SELECT * FROM admin_users WHERE username = ?', [username]);
    
    if (!admin) {
      console.log('Admin not found');
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    
    if (!validPassword) {
      console.log('Invalid password');
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('Login successful for:', username);
    
    res.json({ success: true, token, username: admin.username });
  } catch (error) {
    console.error('Error in POST /login:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

// Verify token
router.post('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, user: decoded });
  } catch (error) {
    console.error('Error in POST /verify:', error);
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// Get all logs (admin only)
router.get('/logs', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    
    jwt.verify(token, JWT_SECRET);
    
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
    console.error('Error in GET /logs:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

// Get statistics (admin only)
router.get('/stats', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    
    jwt.verify(token, JWT_SECRET);
    
    // Get Philippine date
    const phTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const todayDate = phTime.toISOString().split('T')[0];
    
    const todayStats = await db.getQuery(`
      SELECT 
        COUNT(*) as total_today,
        SUM(CASE WHEN time_out IS NULL THEN 1 ELSE 0 END) as currently_inside,
        SUM(CASE WHEN lab = '1' THEN 1 ELSE 0 END) as lab1_count,
        SUM(CASE WHEN lab = '2' THEN 1 ELSE 0 END) as lab2_count,
        SUM(CASE WHEN lab = '3' THEN 1 ELSE 0 END) as lab3_count
      FROM logs
      WHERE DATE(time_in) = DATE(?)
    `, [todayDate]);
    
    res.json({ success: true, data: todayStats });
  } catch (error) {
    console.error('Error in GET /stats:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

// Clear all logs (admin only)
router.delete('/clear-all', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    
    jwt.verify(token, JWT_SECRET);
    
    await db.runQuery('DELETE FROM logs');
    console.log('All logs cleared');
    
    res.json({ success: true, message: 'All logs cleared successfully' });
  } catch (error) {
    console.error('Error in DELETE /clear-all:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

module.exports = router;