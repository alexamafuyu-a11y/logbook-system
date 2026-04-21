const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend folder (parent directory)
app.use(express.static(path.join(__dirname, '..')));

// Import routes
const logsRouter = require('./routes/logs');
const adminRouter = require('./routes/admin');
const labsRouter = require('./routes/labs');

// Use routes
app.use('/api/logs', logsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/labs', labsRouter);

// Default route - serve index.html from parent directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Access the app at http://localhost:${PORT}`);
});