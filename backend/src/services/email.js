const nodemailer = require('nodemailer');

function createTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

function fmt(date) {
  return new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

async function sendBookingConfirmation(email, name, booking) {
  const transport = createTransport();
  if (!transport) return;
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Booking Confirmed: ${booking.room_name}`,
    text: `Hi ${name},\n\nYour booking has been confirmed.\n\nRoom: ${booking.room_name}\nTitle: ${booking.title}\nStart: ${fmt(booking.start_time)}\nEnd: ${fmt(booking.end_time)}\n\nThank you!`,
  });
}

async function sendCancellationNotice(email, name, booking) {
  const transport = createTransport();
  if (!transport) return;
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Booking Cancelled: ${booking.room_name}`,
    text: `Hi ${name},\n\nYour booking has been cancelled.\n\nRoom: ${booking.room_name}\nTitle: ${booking.title}\nStart: ${fmt(booking.start_time)}\nEnd: ${fmt(booking.end_time)}`,
  });
}

module.exports = { sendBookingConfirmation, sendCancellationNotice };
