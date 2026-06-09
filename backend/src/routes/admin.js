const router = require('express').Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

const adminOnly = (req, res, next) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  next();
};

router.use(authMiddleware, adminOnly);

// ── Users ────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at'
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.patch('/users/:id', async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id)
      return res.status(400).json({ error: 'Cannot modify your own admin status' });
    const { rows } = await pool.query(
      'UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING id, name, email, is_admin, created_at',
      [req.body.is_admin, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id)
      return res.status(400).json({ error: 'Cannot delete your own account' });
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── Bookings ─────────────────────────────────────────────────────
router.get('/bookings', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*, u.name as user_name, u.email as user_email, r.name as room_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN rooms r ON b.room_id = r.id
      ORDER BY b.start_time DESC
    `);
    res.json(rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/bookings/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json({ message: 'Booking cancelled' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
