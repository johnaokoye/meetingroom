import React, { useState, useEffect, useMemo } from 'react';

function hexToRgba(hex, alpha) {
  if (!hex || hex.length < 7) return `rgba(45,106,79,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function fmt(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function RoomHero({
  room, events, isAdmin,
  activeBooking, isMyActiveBooking,
  onQuickBook, onOtherBook, onViewSchedule, onCheckIn,
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const availability = useMemo(() => {
    const current = events.find(e => e.start <= now && e.end > now);
    if (current) return { busy: true, label: `In use until ${fmt(current.end)}` };
    const next = [...events].filter(e => e.start > now).sort((a, b) => a.start - b.start)[0];
    if (next) return { busy: false, label: `Available until ${fmt(next.start)}` };
    return { busy: false, label: 'Available' };
  }, [events, now]);

  const overlayColor = hexToRgba(room?.theme_color || '#2d6a4f', 0.76);
  const alreadyCheckedIn = activeBooking?.checked_in;

  return (
    <div
      className="hero"
      style={{
        backgroundImage: room?.photo_url ? `url(${room.photo_url})` : 'none',
        backgroundColor: room?.theme_color || '#2d6a4f',
      }}
    >
      <div className="hero-overlay" style={{ background: overlayColor }}>

        <div className="hero-topbar">
          <div className="hero-logo">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white" opacity="0.85">
              <path d="M3 13h1v7c0 .55.45 1 1 1h4v-5h6v5h4c.55 0 1-.45 1-1v-7h1l-9-9-9 9z"/>
            </svg>
          </div>
          <div className="hero-time">{fmt(now)}</div>
          <div className="hero-nav">
            <span className="hero-nav-item">
              <span className={`hero-dot ${availability.busy ? 'busy' : ''}`} />
              Room Details
            </span>
            <button className="hero-nav-btn" onClick={onViewSchedule}>View Schedule</button>
            {isAdmin && (
              <button className="hero-nav-btn" onClick={() => window.dispatchEvent(new CustomEvent('open-admin-settings'))}>
                ⚙ Settings
              </button>
            )}
          </div>
        </div>

        <div className="hero-body">
          <div>
            <h1 className="hero-room-name">{room?.name || 'Conference Room'}</h1>
            {room?.tagline && <p className="hero-tagline">{room.tagline}</p>}
            <p className={`hero-avail${availability.busy ? ' busy' : ''}`}>
              <span className="hero-dot" />
              {availability.label}
            </p>
          </div>

          {isMyActiveBooking ? (
            alreadyCheckedIn ? (
              <div className="hero-checked-in">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                Checked In
              </div>
            ) : (
              <div className="hero-book">
                <p className="hero-book-label">Your meeting is active</p>
                <button className="hero-checkin-btn" onClick={onCheckIn}>
                  Check In
                </button>
              </div>
            )
          ) : (
            !availability.busy && (
              <div className="hero-book">
                <p className="hero-book-label">Book now</p>
                <div className="hero-book-btns">
                  {[15, 30, 60].map(m => (
                    <button key={m} className="hero-book-btn" onClick={() => onQuickBook(m)}>
                      {m}m
                    </button>
                  ))}
                  <button className="hero-book-btn other" onClick={onOtherBook}>Other</button>
                </div>
              </div>
            )
          )}
        </div>

      </div>
    </div>
  );
}
