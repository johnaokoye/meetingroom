const router = require('express').Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM rooms ORDER BY name');
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM rooms WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Room not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/settings', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  try {
    const { photo_url, theme_color, tagline } = req.body;
    const { rows } = await pool.query(
      `UPDATE rooms SET photo_url = $1, theme_color = $2, tagline = $3 WHERE id = $4 RETURNING *`,
      [photo_url || null, theme_color || '#2d6a4f', tagline || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Room not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  try {
    const { name, capacity, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { rows } = await pool.query(
      'INSERT INTO rooms (name, capacity, description) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), parseInt(capacity) || 10, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Room name already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  try {
    const { name, capacity, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { rows } = await pool.query(
      'UPDATE rooms SET name = $1, capacity = $2, description = $3 WHERE id = $4 RETURNING *',
      [name.trim(), parseInt(capacity) || 10, description || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Room not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Room name already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  try {
    const { rowCount } = await pool.query('DELETE FROM rooms WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Room not found' });
    res.json({ message: 'Room deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
