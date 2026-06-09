const router = require('express').Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { sendBookingConfirmation, sendCancellationNotice } = require('../services/email');

router.get('/', async (req, res) => {
  try {
    const { roomId, start, end } = req.query;
    let query = `
      SELECT b.*, u.name as user_name, r.name as room_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN rooms r ON b.room_id = r.id
      WHERE 1=1
    `;
    const params = [];
    if (roomId) { params.push(roomId); query += ` AND b.room_id = $${params.length}`; }
    if (start)  { params.push(start);  query += ` AND b.end_time > $${params.length}`; }
    if (end)    { params.push(end);    query += ` AND b.start_time < $${params.length}`; }
    query += ' ORDER BY b.start_time';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, r.name as room_name FROM bookings b
       JOIN rooms r ON b.room_id = r.id
       WHERE b.user_id = $1 AND b.end_time > NOW()
       ORDER BY b.start_time`,
      [req.user.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { roomId, title, startTime, endTime } = req.body;
    if (!roomId || !title || !startTime || !endTime) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) return res.status(400).json({ error: 'End time must be after start time' });

    const { rows: conflicts } = await pool.query(
      `SELECT id FROM bookings WHERE room_id = $1 AND NOT (end_time <= $2 OR start_time >= $3)`,
      [roomId, start, end]
    );
    if (conflicts.length > 0) {
      return res.status(409).json({ error: 'Room is already booked for this time slot' });
    }

    const { rows } = await pool.query(
      `INSERT INTO bookings (room_id, user_id, title, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [roomId, req.user.id, title, start, end]
    );
    const booking = rows[0];

    const { rows: roomRows } = await pool.query('SELECT name FROM rooms WHERE id = $1', [roomId]);
    sendBookingConfirmation(req.user.email, req.user.name, { ...booking, room_name: roomRows[0]?.name })
      .catch(err => console.error('Email error:', err.message));

    res.status(201).json(booking);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/checkin', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Booking not found' });
    if (rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not your booking' });
    const now = new Date();
    if (new Date(rows[0].start_time) > now || new Date(rows[0].end_time) <= now) {
      return res.status(400).json({ error: 'Booking is not currently active' });
    }
    const { rows: updated } = await pool.query(
      'UPDATE bookings SET checked_in = TRUE, checked_in_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    res.json(updated[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Booking not found' });
    if (rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to cancel this booking' });

    await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);

    const { rows: roomRows } = await pool.query('SELECT name FROM rooms WHERE id = $1', [rows[0].room_id]);
    sendCancellationNotice(req.user.email, req.user.name, { ...rows[0], room_name: roomRows[0]?.name })
      .catch(err => console.error('Email error:', err.message));

    res.json({ message: 'Booking cancelled' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
