require('dotenv').config(); // Load .env variables at the top

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const OpenAI = require('openai');  // Updated import

const app = express();
const port = process.env.PORT || 3001;

const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';

// Setup OpenAI with API key from .env (updated for openai@5.x)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER || 'aryan',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'budget_tracker',
  port: process.env.DB_PORT || 5432,
});

// Simple root route to test server
app.get('/', (req, res) => {
  res.send('Budget Tracker API is running');
});

// Auth middleware to protect routes and extract user info from JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Register new user
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const userExists = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const SALT_ROUNDS = 10;
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );

    res.status(201).json({ message: 'User registered', user: result.rows[0] });
  } catch (error) {
    console.error('User registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user and return token
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1d' });

    res.json({ token, user: { username: user.username } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user info from token
app.get('/api/user', authMiddleware, (req, res) => {
  res.json({ user: { username: req.user.username } });
});

// Get all entries (should filter by user in real app)
app.get('/api/entries', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM entries ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).send('Server error');
  }
});

// Replace all entries for user (in real app, filter by user_id)
app.post('/api/entries', authMiddleware, async (req, res) => {
  const newEntries = req.body.entries;

  if (!Array.isArray(newEntries)) {
    return res.status(400).json({ error: 'Entries should be an array' });
  }

  try {
    await pool.query('DELETE FROM entries');

    for (const e of newEntries) {
      const { type, amount, category, date, description } = e;
      await pool.query(
        'INSERT INTO entries (type, amount, category, date, description) VALUES ($1, $2, $3, $4, $5)',
        [type, amount, category || null, date, description]
      );
    }
    res.json({ message: 'Entries updated' });
  } catch (err) {
    console.error('Error updating entries:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI chat route (updated for openai@5.x)
app.post('/api/ai', authMiddleware, async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error('OpenAI error:', err.response?.data || err.message);
    res.status(500).json({ error: 'AI request failed' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
