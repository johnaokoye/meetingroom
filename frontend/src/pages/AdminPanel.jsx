import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import api from '../api';

// ── Room Modal ──────────────────────────────────────────────────────
function RoomModal({ room, onSave, onClose }) {
  const [form, setForm] = useState({
    name: room?.name || '',
    capacity: room?.capacity || 10,
    description: room?.description || '',
  });
  const [error, setError] = useState('');
  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError('');
    try {
      if (room) {
        await api.put(`/rooms/${room.id}`, form);
      } else {
        await api.post('/rooms', form);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save room');
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{room ? 'Edit Room' : 'Add Room'}</h3>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          <label>Name</label>
          <input value={form.name} onChange={set('name')} required autoFocus />
          <label>Capacity</label>
          <input type="number" value={form.capacity} onChange={set('capacity')} min={1} required />
          <label>Description</label>
          <input value={form.description} onChange={set('description')} placeholder="Optional" />
          <div className="modal-actions">
            <button type="submit">{room ? 'Save Changes' : 'Add Room'}</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Rooms Tab ────────────────────────────────────────────────────────
function RoomsTab() {
  const [rooms, setRooms] = useState([]);
  const [modal, setModal] = useState(null); // null | 'add' | room object

  const load = () => api.get('/rooms').then(({ data }) => setRooms(data));
  useEffect(() => { load(); }, []);

  const deleteRoom = async room => {
    if (!window.confirm(`Delete "${room.name}"? All its bookings will also be deleted.`)) return;
    try {
      await api.delete(`/rooms/${room.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete room');
    }
  };

  return (
    <div>
      <div className="admin-section-header">
        <h2>Rooms</h2>
        <button className="admin-add-btn" onClick={() => setModal('add')}>+ Add Room</button>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Capacity</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map(room => (
            <tr key={room.id}>
              <td><strong>{room.name}</strong></td>
              <td>{room.capacity}</td>
              <td className="muted">{room.description || '—'}</td>
              <td>
                <button className="tbl-btn" onClick={() => setModal(room)}>Edit</button>
                <button className="tbl-btn danger" onClick={() => deleteRoom(room)}>Delete</button>
              </td>
            </tr>
          ))}
          {rooms.length === 0 && (
            <tr>
              <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '2rem' }}>No rooms yet</td>
            </tr>
          )}
        </tbody>
      </table>
      {modal && (
        <RoomModal
          room={modal === 'add' ? null : modal}
          onSave={load}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── Bookings Tab ─────────────────────────────────────────────────────
function BookingsTab() {
  const [bookings, setBookings] = useState([]);

  const load = () => api.get('/admin/bookings').then(({ data }) => setBookings(data));
  useEffect(() => { load(); }, []);

  const cancel = async b => {
    if (!window.confirm(`Cancel "${b.title}" by ${b.user_name}?`)) return;
    try {
      await api.delete(`/admin/bookings/${b.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel booking');
    }
  };

  const fmt = iso => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <div>
      <div className="admin-section-header">
        <h2>All Bookings</h2>
        <span className="muted">{bookings.length} total</span>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>User</th>
            <th>Title</th>
            <th>Start</th>
            <th>End</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map(b => {
            const now = new Date();
            const start = new Date(b.start_time);
            const end = new Date(b.end_time);
            const isPast = end < now;
            const isActive = start <= now && end > now;
            const s = fmt(b.start_time);
            const e = fmt(b.end_time);
            return (
              <tr key={b.id} className={isPast ? 'row-past' : ''}>
                <td>{b.room_name}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{b.user_name}</div>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>{b.user_email}</div>
                </td>
                <td>{b.title}</td>
                <td className="time-cell">
                  <div>{s.date}</div>
                  <div className="muted">{s.time}</div>
                </td>
                <td className="time-cell muted">{e.time}</td>
                <td>
                  {isActive ? (
                    <span className="badge badge-active">{b.checked_in ? 'Checked In' : 'Active'}</span>
                  ) : isPast ? (
                    <span className="badge badge-past">Past</span>
                  ) : (
                    <span className="badge badge-upcoming">Upcoming</span>
                  )}
                </td>
                <td>
                  {!isPast && (
                    <button className="tbl-btn danger" onClick={() => cancel(b)}>Cancel</button>
                  )}
                </td>
              </tr>
            );
          })}
          {bookings.length === 0 && (
            <tr>
              <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '2rem' }}>No bookings</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Users Tab ────────────────────────────────────────────────────────
function UsersTab({ currentUserId }) {
  const [users, setUsers] = useState([]);

  const load = () => api.get('/admin/users').then(({ data }) => setUsers(data));
  useEffect(() => { load(); }, []);

  const toggleAdmin = async u => {
    try {
      await api.patch(`/admin/users/${u.id}`, { is_admin: !u.is_admin });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user');
    }
  };

  const deleteUser = async u => {
    if (!window.confirm(`Delete user "${u.name}"? All their bookings will also be deleted.`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  return (
    <div>
      <div className="admin-section-header">
        <h2>Users</h2>
        <span className="muted">{users.length} total</span>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>
                <strong>{u.name}</strong>
                {u.id === currentUserId && <span className="badge badge-upcoming" style={{ marginLeft: '0.5rem' }}>You</span>}
              </td>
              <td>{u.email}</td>
              <td>
                {u.is_admin
                  ? <span className="badge badge-active">Admin</span>
                  : <span className="badge badge-past">User</span>}
              </td>
              <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
              <td>
                {u.id !== currentUserId && (
                  <>
                    <button className="tbl-btn" onClick={() => toggleAdmin(u)}>
                      {u.is_admin ? 'Remove Admin' : 'Make Admin'}
                    </button>
                    <button className="tbl-btn danger" onClick={() => deleteUser(u)}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── AdminPanel ────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tab, setTab] = useState('rooms');

  useEffect(() => {
    if (user && !user.is_admin) navigate('/');
  }, [user, navigate]);

  if (!user?.is_admin) return null;

  const tabs = [
    { key: 'rooms', label: 'Rooms' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'users', label: 'Users' },
  ];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-title-row">
          <button className="back-btn" style={{ marginBottom: 0 }} onClick={() => navigate('/')}>
            ← Back
          </button>
          <h1 className="admin-heading">Admin Panel</h1>
        </div>
        <div className="admin-tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`admin-tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-content">
        {tab === 'rooms' && <RoomsTab />}
        {tab === 'bookings' && <BookingsTab />}
        {tab === 'users' && <UsersTab currentUserId={user.id} />}
      </div>
    </div>
  );
}
