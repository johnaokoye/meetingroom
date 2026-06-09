import React, { useState } from 'react';
import { format } from 'date-fns';

export default function BookingModal({ slot, booking, onCreate, onCancel, onClose }) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(slot ? format(slot.start, "yyyy-MM-dd'T'HH:mm") : '');
  const [endTime, setEndTime] = useState(slot ? format(slot.end, "yyyy-MM-dd'T'HH:mm") : '');
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    await onCreate({ title, startTime, endTime });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {booking ? (
          <>
            <h3>Your Booking</h3>
            {booking.room_name && <p className="muted" style={{ marginBottom: '0.5rem' }}>{booking.room_name}</p>}
            <p><strong>{booking.title}</strong></p>
            <p style={{ marginTop: '0.25rem', color: '#6b7280', fontSize: '0.9rem' }}>
              {booking.start.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              {' – '}
              {booking.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <div className="modal-actions">
              <button className="danger" onClick={() => onCancel(booking.id)}>Cancel Booking</button>
              <button onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <>
            <h3>New Booking</h3>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={submit}>
              <label>Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Team Standup" required />
              <label>Start</label>
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required />
              <label>End</label>
              <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} required />
              <div className="modal-actions">
                <button type="submit">Book Room</button>
                <button type="button" onClick={onClose}>Cancel</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
