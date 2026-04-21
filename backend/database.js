const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// Use DB_PATH env variable (set to /data/logbook.db on Render) or fallback to local
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'logbook.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log(`✅ Connected to SQLite database at ${DB_PATH}`);
    initializeDatabase();
  }
});

// Initialize database tables
async function initializeDatabase() {
  // Create logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_id TEXT UNIQUE NOT NULL,
      lab TEXT NOT NULL,
      student_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      program TEXT NOT NULL,
      purpose TEXT NOT NULL,
      time_in DATETIME NOT NULL,
      time_out DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating logs table:', err);
    else console.log('✅ Logs table ready');
  });

  // Create admin_users table
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating admin_users table:', err);
    else {
      console.log('✅ Admin users table ready');
      // Use ADMIN_PASSWORD env variable or fallback to default (change this in production!)
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const defaultPassword = bcrypt.hashSync(adminPassword, 10);
      db.run(`
        INSERT OR IGNORE INTO admin_users (username, password_hash)
        VALUES (?, ?)
      `, ['admin', defaultPassword], (err) => {
        if (err) console.error('Error inserting default admin:', err);
        else console.log('✅ Default admin user ready');
      });
    }
  });

  // Create activity_logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      user_type TEXT NOT NULL,
      user_info TEXT,
      details TEXT,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating activity_logs table:', err);
    else console.log('✅ Activity logs table ready');
  });
}

// Helper functions
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  runQuery,
  getQuery,
  allQuery
};