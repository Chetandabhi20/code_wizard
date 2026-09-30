 require('dotenv').config();
    const express = require('express');
    const cors = require('cors');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const path = require('path');
    const fs = require('fs');
    const multer = require('multer');
    const db = require('./db');
    const { analyzeComplaint } = require('./aiService');

    const app = express();
    const PORT = process.env.PORT || 5000;
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

    app.use(cors());
    app.use(express.json());

    // 1. Static File Serving for Uploads
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
    app.use('/uploads', express.static(uploadsDir));

    // 2. Static File Serving for Frontend (Fixes Microphone file:/// security block!)
    const frontendDir = path.join(__dirname, '..', 'frontend');
    if (fs.existsSync(frontendDir)) {
      app.use(express.static(frontendDir));
    }

    // Multer Config
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'complaint-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
      }
    });

    const upload = multer({
      storage: storage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        const isValid = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
        cb(isValid ? null : new Error('Only image files are allowed!'), isValid);
      }
    });

    // Seed Default Admin
    async function seedDefaultAdmin() {
      try {
        const res = await db.query('SELECT * FROM users WHERE email = $1;', ['admin@civicflow.org']);
        if (res.rows.length === 0) {
          const hash = await bcrypt.hash('admin123', 10);
          const query = `INSERT INTO users (name, email, password_hash, role) VALUES ('System Administrator', 'admin@civicflow.org', $1,
  'ADMIN');`;
          await db.query(query, [hash]);
          console.log('🛡️ Default Admin created: admin@civicflow.org / admin123');
        }
      } catch (err) {
        console.error('Admin seed error:', err.message);
      }
    }
    seedDefaultAdmin();

    // Auth Middlewares
    function authenticateToken(req, res, next) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ success: false, error: 'Please login to continue.' });

      jwt.verify(token, JWT_SECRET, (err, userPayload) => {
        if (err) return res.status(403).json({ success: false, error: 'Session expired. Please login again.' });
        req.user = userPayload;
        next();
      });
    }

    function optionalAuth(req, res, next) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return next();

      jwt.verify(token, JWT_SECRET, (err, userPayload) => {
        if (!err) req.user = userPayload;
        next();
      });
    }

    function authorizeRoles(...allowedRoles) {
      return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
          return res.status(403).json({ success: false, error: `Access denied. Requires role: [${allowedRoles.join(', ')}]` });
        }
        next();
      };
    }

    // Auth Routes
    app.post('/api/auth/register', async (req, res) => {
      const { name, email, password } = req.body;
      if (!name || !email || !password) return res.status(400).json({ success: false, error: 'All fields are required.' });

      try {
        const userCheck = await db.query('SELECT * FROM users WHERE email = $1;', [email.toLowerCase().trim()]);
        if (userCheck.rows.length > 0) return res.status(400).json({ success: false, error: 'Account already exists.' });

        const hash = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'CITIZEN') RETURNING id, name, email, role;`;
        const result = await db.query(sql, [name.trim(), email.toLowerCase().trim(), hash]);
        const user = result.rows[0];

        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ success: true, message: 'Registered!', user, token });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    app.post('/api/auth/login', async (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required.' });

      try {
        const result = await db.query('SELECT * FROM users WHERE email = $1;', [email.toLowerCase().trim()]);
        if (result.rows.length === 0) return res.status(400).json({ success: false, error: 'Invalid credentials.' });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ success: false, error: 'Invalid credentials.' });

        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ success: true, message: 'Logged in!', user: { id: user.id, name: user.name, email: user.email, role: user.role
  }, token });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // AI Complaint Ingestion
    app.post('/api/complaints', optionalAuth, upload.single('image'), async (req, res) => {
      const { prompt, location, latitude, longitude } = req.body;
      const userId = req.user ? req.user.id : null;
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

      const lat = latitude ? parseFloat(latitude) : null;
      const lng = longitude ? parseFloat(longitude) : null;

      if (!prompt || !location) {
        return res.status(400).json({ success: false, error: 'Please describe the problem and provide a location.' });
      }

      try {
        const ai = await analyzeComplaint(prompt);

        const sqlQuery = `
          INSERT INTO complaints (
            title, category, description, location, latitude, longitude, image_url, user_id,
            assigned_department, priority, status, ai_summary
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', $11)
          RETURNING *;
        `;
        const values = [
          ai.title,
          ai.category,
          prompt.trim(),
          location.trim(),
          lat,
          lng,
          imageUrl,
          userId,
          ai.suggestedDepartment,
          ai.priority,
          ai.aiSummary
        ];

        const result = await db.query(sqlQuery, values);

        res.status(201).json({
          success: true,
          message: 'Issue processed and classified by AI successfully!',
          complaint: result.rows[0]
        });
      } catch (err) {
        console.error('Database Error:', err.message);
        res.status(500).json({ success: false, error: 'Database server error' });
      }
    });

    // Citizen My Reports
    app.get('/api/complaints/my-reports', authenticateToken, async (req, res) => {
      try {
        const result = await db.query('SELECT * FROM complaints WHERE user_id = $1 ORDER BY created_at DESC;', [req.user.id]);
        res.status(200).json({ success: true, total: result.rowCount, complaints: result.rows });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Admin Master Feed
    app.get('/api/complaints', authenticateToken, authorizeRoles('ADMIN', 'DEPARTMENT'), async (req, res) => {
      const { status, department, priority } = req.query;

      try {
        let queryText = `SELECT c.*, u.name as reporter_name FROM complaints c LEFT JOIN users u ON c.user_id = u.id WHERE 1=1`;
        const queryParams = [];

        if (status && status !== 'ALL') { queryParams.push(status); queryText += ` AND c.status = $${queryParams.length}`; }
        if (department && department !== 'ALL') { queryParams.push(department); queryText += ` AND c.assigned_department = $${queryParams.
  length}`; }
        if (priority && priority !== 'ALL') { queryParams.push(priority); queryText += ` AND c.priority = $${queryParams.length}`; }

        queryText += ` ORDER BY c.created_at DESC;`;

        const result = await db.query(queryText, queryParams);

        const statsQuery = `
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'IN_PROGRESS' OR status = 'ASSIGNED' THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) as resolved,
            SUM(CASE WHEN priority = 'HIGH' AND status != 'RESOLVED' THEN 1 ELSE 0 END) as high_priority
          FROM complaints;
        `;
        const statsResult = await db.query(statsQuery);

        res.status(200).json({ success: true, total: result.rowCount, stats: statsResult.rows[0], complaints: result.rows });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Admin Actions
    app.patch('/api/complaints/:id/assign', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
      const { id } = req.params;
      const { department, priority } = req.body;
      try {
        const sql = `UPDATE complaints SET assigned_department = $1, priority = COALESCE($2, priority), status = 'ASSIGNED' WHERE id = $3
  RETURNING *;`;
        const result = await db.query(sql, [department, priority, id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
        res.status(200).json({ success: true, message: 'Assigned!', complaint: result.rows[0] });
      } catch (err) { res.status(500).json({ success: false, error: err.message }); }
    });

    app.patch('/api/complaints/:id/status', authenticateToken, authorizeRoles('ADMIN', 'DEPARTMENT'), async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      try {
        const sql = `UPDATE complaints SET status = $1 WHERE id = $2 RETURNING *;`;
        const result = await db.query(sql, [status, id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
        res.status(200).json({ success: true, message: 'Updated!', complaint: result.rows[0] });
      } catch (err) { res.status(500).json({ success: false, error: err.message }); }
    });

    app.delete('/api/complaints/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
      const { id } = req.params;
      try {
        const result = await db.query('DELETE FROM complaints WHERE id = $1 RETURNING *;', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
        res.status(200).json({ success: true, message: 'Deleted.' });
      } catch (err) { res.status(500).json({ success: false, error: err.message }); }
    });

    app.listen(PORT, () => {
      console.log(`🚀 CivicFlow Backend & Frontend running at: http://localhost:${PORT}`);
    });