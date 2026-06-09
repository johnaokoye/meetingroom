import React, { useState, useEffect } from 'react';
import api from '../api';

export default function AdminSettings({ onClose }) {
  const [room, setRoom] = useState(null);
  const [form, setForm] = useState({ photo_url: '', theme_color: '#2d6a4f', tagline: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/rooms').then(({ data }) => {
      const r = data[0];
      if (!r) return;
      setRoom(r);
      setForm({
        photo_url: r.photo_url || '',
        theme_color: r.theme_color || '#2d6a4f',
        tagline: r.tagline || '',
      });
    });
  }, []);

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.put(`/rooms/${room.id}/settings`, form);
      window.dispatchEvent(new CustomEvent('room-settings-updated'));
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Room Settings</h3>
        {error && <div className="error-msg">{error}</div>}
        {!room ? (
          <p className="muted">Loading…</p>
        ) : (
          <form onSubmit={submit}>
            <label>Photo URL</label>
            <input
              value={form.photo_url}
              onChange={set('photo_url')}
              placeholder="https://example.com/room.jpg"
            />

            <label>Theme Color</label>
            <div className="color-row">
              <input type="color" value={form.theme_color} onChange={set('theme_color')} className="color-swatch" />
              <input value={form.theme_color} onChange={set('theme_color')} maxLength={7} style={{ flex: 1 }} />
            </div>

            <label>Tagline <span className="hint">(shown under room name)</span></label>
            <input
              value={form.tagline}
              onChange={set('tagline')}
              placeholder="e.g. 2nd floor · seats 20"
            />

            {form.photo_url && (
              <div className="photo-preview" style={{ backgroundImage: `url(${form.photo_url})` }} />
            )}

            <div className="modal-actions">
              <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
