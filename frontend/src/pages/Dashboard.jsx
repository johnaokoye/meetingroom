import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { AuthContext } from '../App';
import api from '../api';
import RoomHero from '../components/RoomHero';
import RoomCalendar from '../components/RoomCalendar';
import BookingModal from '../components/BookingModal';
import AdminSettings from '../components/AdminSettings';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [view, setView] = useState('hero');
  const [rooms, setRooms] = useState([]);
  const [room, setRoom] = useState(null);
  const [events, setEvents] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [modal, setModal] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data);
      setRoom(prev => {
        if (!prev && data.length > 0) return data[0];
        const found = data.find(r => r.id === prev?.id);
        return found ?? data[0] ?? null;
      });
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  useEffect(() => {
    const openHandler = () => setShowSettings(true);
    const updatedHandler = () => fetchRooms();
    window.addEventListener('open-admin-settings', openHandler);
    window.addEventListener('room-settings-updated', updatedHandler);
    return () => {
      window.removeEventListener('open-admin-settings', openHandler);
      window.removeEventListener('room-settings-updated', updatedHandler);
    };
  }, [fetchRooms]);

  // Close sidebar when switching to hero
  const goToHero = () => { setView('hero'); setSidebarOpen(false); };

  const fetchBookings = useCallback(async () => {
    if (!room) return;
    const [roomRes, mineRes] = await Promise.all([
      api.get('/bookings', { params: { roomId: room.id } }),
      api.get('/bookings/mine'),
    ]);
    setEvents(roomRes.data.map(b => ({
      ...b,
      raw_title: b.title,
      title: `${b.title} — ${b.user_name}`,
      start: new Date(b.start_time),
      end: new Date(b.end_time),
    })));
    setMyBookings(mineRes.data);
  }, [room]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleQuickBook = async minutes => {
    const start = new Date();
    const end = new Date(start.getTime() + minutes * 60000);
    try {
      await api.post('/bookings', { roomId: room.id, title: 'Quick Booking', startTime: start.toISOString(), endTime: end.toISOString() });
      fetchBookings();
      showToast(`Booked for ${minutes} minutes`);
    } catch (err) {
      showToast(err.response?.data?.error || 'Booking failed');
    }
  };

  const activeBooking = useMemo(() => {
    const now = new Date();
    return events.find(e => e.start <= now && e.end > now) || null;
  }, [events]);

  const isMyActiveBooking = activeBooking?.user_id === user.id;

  const handleCheckIn = async () => {
    if (!activeBooking) return;
    try {
      await api.post(`/bookings/${activeBooking.id}/checkin`);
      fetchBookings();
      showToast('Checked in!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Check-in failed');
    }
  };

  const handleCreate = async ({ title, startTime, endTime }) => {
    try {
      await api.post('/bookings', {
        roomId: room.id,
        title,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
      setModal(null);
      fetchBookings();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create booking');
    }
  };

  const handleCancel = async bookingId => {
    try {
      await api.delete(`/bookings/${bookingId}`);
      setModal(null);
      fetchBookings();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to cancel booking');
    }
  };

  const openEvent = event => {
    if (event.user_id === user.id) {
      setModal({ type: 'existing', booking: { id: event.id, title: event.raw_title, start: event.start, end: event.end } });
    }
  };

  return (
    <>
      {view === 'hero' ? (
        <RoomHero
          room={room}
          events={events}
          isAdmin={user.is_admin}
          activeBooking={activeBooking}
          isMyActiveBooking={isMyActiveBooking}
          onQuickBook={handleQuickBook}
          onOtherBook={() => setModal({ type: 'new', start: new Date(), end: new Date(Date.now() + 3600000) })}
          onViewSchedule={() => setView('schedule')}
          onCheckIn={handleCheckIn}
        />
      ) : (
        <div className="dashboard">
          {/* Mobile backdrop */}
          <div
            className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />

          <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
            <button className="back-btn" onClick={goToHero}>← Back to room</button>

            {rooms.length > 1 && (
              <>
                <h3>Rooms</h3>
                <div className="room-list">
                  {rooms.map(r => (
                    <button
                      key={r.id}
                      className={`room-chip${room?.id === r.id ? ' active' : ''}`}
                      onClick={() => { setRoom(r); setSidebarOpen(false); }}
                    >
                      {r.name}
                      {r.capacity && <span className="room-chip-cap">{r.capacity}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}

            <h3 style={{ marginTop: rooms.length > 1 ? '1.25rem' : 0 }}>My Upcoming Bookings</h3>
            {myBookings.length === 0 && <p className="muted">No upcoming bookings</p>}
            {myBookings.map(b => (
              <div key={b.id} className="my-booking">
                <div className="booking-title">{b.title}</div>
                <div className="booking-time">
                  {new Date(b.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  {' · '}
                  {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <button className="view-btn" onClick={() => {
                  setSidebarOpen(false);
                  setModal({ type: 'existing', booking: { id: b.id, title: b.title, start: new Date(b.start_time), end: new Date(b.end_time) } });
                }}>View / Cancel</button>
              </div>
            ))}
          </aside>

          <main className="main-content">
            <div className="schedule-topbar">
              <button
                className="sidebar-toggle"
                onClick={() => setSidebarOpen(o => !o)}
                aria-label="Toggle sidebar"
              >
                ☰
              </button>
              <h2>{room?.name || 'Conference Room'} — Schedule</h2>
            </div>
            <RoomCalendar
              events={events}
              onSelectSlot={({ start, end }) => setModal({ type: 'new', start, end })}
              onSelectEvent={openEvent}
              userId={user.id}
              themeColor={room?.theme_color}
            />
          </main>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {modal?.type === 'new' && (
        <BookingModal slot={{ start: modal.start, end: modal.end }} onCreate={handleCreate} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'existing' && (
        <BookingModal booking={modal.booking} onCancel={handleCancel} onClose={() => setModal(null)} />
      )}
      {showSettings && (
        <AdminSettings onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}
