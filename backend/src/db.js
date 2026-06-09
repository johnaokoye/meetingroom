const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 10,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS photo_url TEXT;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS theme_color VARCHAR(7) DEFAULT '#2d6a4f';
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS tagline TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT FALSE;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP;

    DELETE FROM rooms WHERE name != 'Conference Room';
    INSERT INTO rooms (name, capacity, description, photo_url)
    VALUES ('Conference Room', 20, 'Main conference room', '/conference-room.png')
    ON CONFLICT (name) DO NOTHING;

    UPDATE users SET is_admin = TRUE
    WHERE id = (SELECT MIN(id) FROM users)
      AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = TRUE);
  `);
  console.log('Database migration complete');
}

module.exports = { pool, migrate };
