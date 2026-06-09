import React, { useState, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

// Anchor dates for min/max — day/month ignored by RBC, only HH:MM matters
const WORK_START = new Date(0, 0, 0, 7, 0, 0);  // 7 am
const WORK_END   = new Date(0, 0, 0, 21, 0, 0); // 9 pm

export default function RoomCalendar({ events, onSelectSlot, onSelectEvent, userId, themeColor }) {
  const color = themeColor
    || getComputedStyle(document.documentElement).getPropertyValue('--theme').trim()
    || '#2d6a4f';

  const isMobile = window.innerWidth < 768;
  const [calView, setCalView] = useState(() => isMobile ? 'day' : 'week');

  const eventStyleGetter = event => ({
    style: {
      backgroundColor: event.user_id === userId ? color : '#9ca3af',
      borderRadius: '5px',
      border: 'none',
      color: 'white',
      fontSize: isMobile ? '0.78rem' : '0.82rem',
      padding: '2px 5px',
    },
  });

  // Scroll to earliest booking today, or 8 am if none
  const scrollToTime = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const todayEvents = events.filter(e => e.start >= todayStart && e.start <= todayEnd);
    if (todayEvents.length > 0) {
      const earliest = todayEvents.reduce((a, b) => a.start < b.start ? a : b);
      const t = new Date(earliest.start);
      t.setMinutes(t.getMinutes() - 30);
      return t;
    }
    const d = new Date(); d.setHours(8, 0, 0, 0);
    return d;
  }, [events]);

  // 14 visible hours (7am–9pm), 2 groups/hour, target ≥ 48 px/group
  const calHeight = isMobile ? Math.max(window.innerHeight - 140, 480) : 14 * 2 * 48;

  return (
    <Calendar
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      style={{ height: calHeight }}
      min={WORK_START}
      max={WORK_END}
      selectable
      onSelectSlot={onSelectSlot}
      onSelectEvent={onSelectEvent}
      eventPropGetter={eventStyleGetter}
      view={calView}
      onView={setCalView}
      step={30}
      timeslots={1}
      scrollToTime={scrollToTime}
    />
  );
}
