const router = require('express').Router();
const path = require('path');
const multer = require('multer');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const {
  sendBookingConfirmation,
  sendCancellationNotice,
  sendInvitations,
  sendInviteeCancellation,
} = require('../services/email');

const MAX_AGENDA_BYTES = 10 * 1024 * 1024;
const MAX_INVITEES = 50;
const ALLOWED_AGENDA_EXT = new Set([
  '.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt', '.md',
  '.ppt', '.pptx', '.odp', '.xls', '.xlsx', '.ods', '.csv',
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AGENDA_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_AGENDA_EXT.has(ext)) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'agenda'));
    }
    cb(null, true);
  },
});

// Wraps multer so its errors become 400s with a readable message
function agendaUpload(req, res, next) {
  upload.single('agenda')(req, res, err => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Agenda file must be 10 MB or smaller' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unsupported agenda file type. Use PDF, Word, text, slides or spreadsheet files.' });
    }
    return res.status(400).json({ error: 'Invalid upload' });
  });
}

// Accepts an array, a JSON-encoded array (multipart), or a comma/newline separated string
function parseInvitees(raw) {
  if (raw == null || raw === '') return [];
  let list = raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [raw];
    } catch {
      list = raw.split(/[,;\n]/);
    }
  }
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const email = String(item).trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email) || email.length > 254) return null;
    if (!seen.has(email)) { seen.add(email); out.push(email); }
  }
  return out;
}

function parseMeetingLink(raw) {
  if (raw == null || String(raw).trim() === '') return { value: null };
  const str = String(raw).trim();
  try {
    const url = new URL(str);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: true };
    return { value: url.toString() };
  } catch {
    return { error: true };
  }
}

const BOOKING_COLUMNS = `
  b.id, b.room_id, b.user_id, b.title, b.start_time, b.end_time,
  b.checked_in, b.checked_in_at, b.created_at, b.invitees, b.meeting_link,
  a.filename AS agenda_filename, a.size AS agenda_size
`;

router.get('/', async (req, res) => {
  try {
    const { roomId, start, end } = req.query;
    let query = `
      SELECT ${BOOKING_COLUMNS}, u.name as user_name, r.name as room_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN rooms r ON b.room_id = r.id
      LEFT JOIN booking_agendas a ON a.booking_id = b.id
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
      `SELECT ${BOOKING_COLUMNS}, r.name as room_name FROM bookings b
       JOIN rooms r ON b.room_id = r.id
       LEFT JOIN booking_agendas a ON a.booking_id = b.id
       WHERE b.user_id = $1 AND b.end_time > NOW()
       ORDER BY b.start_time`,
      [req.user.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authMiddleware, agendaUpload, async (req, res) => {
  const client = await pool.connect();
  try {
    const { roomId, title, startTime, endTime } = req.body;
    if (!roomId || !title || !startTime || !endTime) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start) || isNaN(end)) return res.status(400).json({ error: 'Invalid start or end time' });
    if (end <= start) return res.status(400).json({ error: 'End time must be after start time' });

    const invitees = parseInvitees(req.body.invitees);
    if (invitees === null) return res.status(400).json({ error: 'One or more invitee e-mail addresses are invalid' });
    if (invitees.length > MAX_INVITEES) return res.status(400).json({ error: `At most ${MAX_INVITEES} invitees allowed` });

    const link = parseMeetingLink(req.body.meetingLink);
    if (link.error) return res.status(400).json({ error: 'Meeting link must be a valid http(s) URL' });

    const { rows: conflicts } = await client.query(
      `SELECT id FROM bookings WHERE room_id = $1 AND NOT (end_time <= $2 OR start_time >= $3)`,
      [roomId, start, end]
    );
    if (conflicts.length > 0) {
      return res.status(409).json({ error: 'Room is already booked for this time slot' });
    }

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO bookings (room_id, user_id, title, start_time, end_time, invitees, meeting_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [roomId, req.user.id, title, start, end, invitees, link.value]
    );
    const booking = rows[0];

    let agenda = null;
    if (req.file) {
      agenda = {
        filename: path.basename(req.file.originalname).slice(0, 255),
        mimetype: req.file.mimetype || 'application/octet-stream',
        size: req.file.size,
        data: req.file.buffer,
      };
      await client.query(
        `INSERT INTO booking_agendas (booking_id, filename, mimetype, size, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [booking.id, agenda.filename, agenda.mimetype, agenda.size, agenda.data]
      );
    }
    await client.query('COMMIT');

    const { rows: roomRows } = await pool.query('SELECT name FROM rooms WHERE id = $1', [roomId]);
    const full = { ...booking, room_name: roomRows[0]?.name };

    sendBookingConfirmation(req.user.email, req.user.name, full, agenda)
      .catch(err => console.error('Email error:', err.message));
    if (invitees.length > 0) {
      sendInvitations(invitees, req.user, full, agenda)
        .catch(err => console.error('Invite email error:', err.message));
    }

    res.status(201).json({
      ...booking,
      agenda_filename: agenda?.filename ?? null,
      agenda_size: agenda?.size ?? null,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Create booking error:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.get('/:id/agenda', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT filename, mimetype, data FROM booking_agendas WHERE booking_id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No agenda attached' });
    const { filename, mimetype, data } = rows[0];
    res.setHeader('Content-Type', mimetype);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.attachment(filename);
    res.send(data);
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
    const full = { ...rows[0], room_name: roomRows[0]?.name };
    sendCancellationNotice(req.user.email, req.user.name, full)
      .catch(err => console.error('Email error:', err.message));
    if (rows[0].invitees?.length) {
      sendInviteeCancellation(rows[0].invitees, req.user, full)
        .catch(err => console.error('Invite email error:', err.message));
    }

    res.json({ message: 'Booking cancelled' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
