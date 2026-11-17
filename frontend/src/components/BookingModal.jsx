import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import api from '../api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AGENDA_BYTES = 10 * 1024 * 1024;
const AGENDA_ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt,.md,.ppt,.pptx,.odp,.xls,.xlsx,.ods,.csv';

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function downloadAgenda(bookingId, filename) {
  const { data } = await api.get(`/bookings/${bookingId}/agenda`, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'agenda';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function BookingModal({ slot, booking, onCreate, onCancel, onClose }) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(slot ? format(slot.start, "yyyy-MM-dd'T'HH:mm") : '');
  const [endTime, setEndTime] = useState(slot ? format(slot.end, "yyyy-MM-dd'T'HH:mm") : '');
  const [invitees, setInvitees] = useState([]);
  const [inviteDraft, setInviteDraft] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [agenda, setAgenda] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  // Adds any complete addresses in `text` as chips; returns false if one is invalid
  const commitInvitees = text => {
    const parts = text.split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return true;
    const bad = parts.find(p => !EMAIL_RE.test(p));
    if (bad) { setError(`"${bad}" is not a valid e-mail address`); return false; }
    setError('');
    setInvitees(prev => [...prev, ...parts.filter(p => !prev.includes(p))]);
    setInviteDraft('');
    return true;
  };

  const onInviteKeyDown = e => {
    if (['Enter', ',', ';', ' ', 'Tab'].includes(e.key) && inviteDraft.trim()) {
      e.preventDefault();
      commitInvitees(inviteDraft);
    } else if (e.key === 'Backspace' && !inviteDraft && invitees.length) {
      setInvitees(prev => prev.slice(0, -1));
    }
  };

  const onInvitePaste = e => {
    const text = e.clipboardData.getData('text');
    if (/[,;\s]/.test(text.trim())) {
      e.preventDefault();
      commitInvitees(inviteDraft + ' ' + text);
    }
  };

  const onAgendaChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AGENDA_BYTES) {
      setError('Agenda file must be 10 MB or smaller');
      e.target.value = '';
      return;
    }
    setError('');
    setAgenda(file);
  };

  const clearAgenda = () => {
    setAgenda(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    if (inviteDraft.trim() && !commitInvitees(inviteDraft)) return;
    if (meetingLink.trim() && !isValidUrl(meetingLink.trim())) {
      setError('Meeting link must start with http:// or https://');
      return;
    }
    // Include a draft that was just committed (state update is async)
    const draftEmails = inviteDraft.split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const allInvitees = [...new Set([...invitees, ...draftEmails])];

    setSubmitting(true);
    try {
      await onCreate({ title, startTime, endTime, invitees: allInvitees, meetingLink: meetingLink.trim(), agenda });
    } finally {
      setSubmitting(false);
    }
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

            {booking.meeting_link && (
              <div className="booking-detail">
                <span className="booking-detail-label">Meeting link</span>
                <a href={booking.meeting_link} target="_blank" rel="noopener noreferrer">{booking.meeting_link}</a>
              </div>
            )}
            {booking.invitees?.length > 0 && (
              <div className="booking-detail">
                <span className="booking-detail-label">Invitees ({booking.invitees.length})</span>
                <div className="chip-list">
                  {booking.invitees.map(email => <span key={email} className="chip">{email}</span>)}
                </div>
              </div>
            )}
            {booking.agenda_filename && (
              <div className="booking-detail">
                <span className="booking-detail-label">Agenda</span>
                <button
                  type="button"
                  className="file-link"
                  onClick={() => downloadAgenda(booking.id, booking.agenda_filename).catch(() => setError('Could not download agenda'))}
                >
                  📎 {booking.agenda_filename} <span className="hint">{formatSize(booking.agenda_size)}</span>
                </button>
              </div>
            )}
            {error && <div className="error-msg" style={{ marginTop: '0.75rem' }}>{error}</div>}

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

              <label>Invitees <span className="hint">— optional, press Enter or comma after each</span></label>
              <div className="chip-input" onClick={e => e.currentTarget.querySelector('input')?.focus()}>
                {invitees.map(email => (
                  <span key={email} className="chip">
                    {email}
                    <button type="button" aria-label={`Remove ${email}`} onClick={() => setInvitees(prev => prev.filter(x => x !== email))}>×</button>
                  </span>
                ))}
                <input
                  type="text"
                  inputMode="email"
                  value={inviteDraft}
                  onChange={e => setInviteDraft(e.target.value)}
                  onKeyDown={onInviteKeyDown}
                  onPaste={onInvitePaste}
                  onBlur={() => inviteDraft.trim() && commitInvitees(inviteDraft)}
                  placeholder={invitees.length ? '' : 'name@example.com'}
                />
              </div>

              <label>Meeting link <span className="hint">— optional</span></label>
              <input
                type="url"
                value={meetingLink}
                onChange={e => setMeetingLink(e.target.value)}
                placeholder="https://zoom.us/j/… or https://meet.google.com/…"
              />

              <label>Agenda <span className="hint">— optional, max 10 MB</span></label>
              {agenda ? (
                <div className="file-selected">
                  <span>📎 {agenda.name} <span className="hint">{formatSize(agenda.size)}</span></span>
                  <button type="button" onClick={clearAgenda} aria-label="Remove agenda">×</button>
                </div>
              ) : (
                <input ref={fileRef} type="file" accept={AGENDA_ACCEPT} onChange={onAgendaChange} />
              )}

              <div className="modal-actions">
                <button type="submit" disabled={submitting}>{submitting ? 'Booking…' : 'Book Room'}</button>
                <button type="button" onClick={onClose}>Cancel</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
