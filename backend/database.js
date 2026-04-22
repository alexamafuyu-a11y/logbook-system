const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Connect to Supabase PostgreSQL via DATABASE_URL env variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test connection and initialize tables
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('✅ Connected to PostgreSQL database');
    release();
    initializeDatabase();
  }
});

// Initialize database tables
async function initializeDatabase() {
  try {
    // Create logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        log_id TEXT UNIQUE NOT NULL,
        lab TEXT NOT NULL,
        student_id TEXT NOT NULL,
        full_name TEXT NOT NULL,
        program TEXT NOT NULL,
        purpose TEXT NOT NULL,
        time_in TIMESTAMP NOT NULL,
        time_out TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Logs table ready');

    // Create admin_users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Admin users table ready');

    // Insert default admin user if not exists
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const defaultPassword = await bcrypt.hash(adminPassword, 10);
    await pool.query(`
      INSERT INTO admin_users (username, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (username) DO NOTHING
    `, ['admin', defaultPassword]);
    console.log('✅ Default admin user ready');

    // Create activity_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        user_type TEXT NOT NULL,
        user_info TEXT,
        details TEXT,
        ip_address TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Activity logs table ready');

  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Helper functions
function runQuery(sql, params = []) {
  return pool.query(sql, params);
}

function getQuery(sql, params = []) {
  return pool.query(sql, params).then(result => result.rows[0]);
}

function allQuery(sql, params = []) {
  return pool.query(sql, params).then(result => result.rows);
}

module.exports = {
  pool,
  runQuery,
  getQuery,
  allQuery
};