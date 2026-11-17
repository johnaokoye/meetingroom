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

function details(booking) {
  const lines = [
    `Room: ${booking.room_name}`,
    `Title: ${booking.title}`,
    `Start: ${fmt(booking.start_time)}`,
    `End: ${fmt(booking.end_time)}`,
  ];
  if (booking.meeting_link) lines.push(`Meeting link: ${booking.meeting_link}`);
  return lines.join('\n');
}

function attachments(agenda) {
  return agenda
    ? [{ filename: agenda.filename, content: agenda.data, contentType: agenda.mimetype }]
    : undefined;
}

async function sendBookingConfirmation(email, name, booking, agenda) {
  const transport = createTransport();
  if (!transport) return;
  const invitees = booking.invitees?.length ? `\nInvitees: ${booking.invitees.join(', ')}` : '';
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Booking Confirmed: ${booking.room_name}`,
    text: `Hi ${name},\n\nYour booking has been confirmed.\n\n${details(booking)}${invitees}\n\nThank you!`,
    attachments: attachments(agenda),
  });
}

async function sendCancellationNotice(email, name, booking) {
  const transport = createTransport();
  if (!transport) return;
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Booking Cancelled: ${booking.room_name}`,
    text: `Hi ${name},\n\nYour booking has been cancelled.\n\n${details(booking)}`,
  });
}

// Invitees are sent in BCC so they don't see each other's addresses
async function sendInvitations(invitees, organizer, booking, agenda) {
  const transport = createTransport();
  if (!transport) return;
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    replyTo: organizer.email,
    bcc: invitees,
    subject: `Invitation: ${booking.title}`,
    text: `Hi,\n\n${organizer.name} has invited you to a meeting.\n\n${details(booking)}`
      + (agenda ? `\n\nThe agenda is attached (${agenda.filename}).` : '')
      + `\n\nReply to this e-mail to contact the organizer.`,
    attachments: attachments(agenda),
  });
}

async function sendInviteeCancellation(invitees, organizer, booking) {
  const transport = createTransport();
  if (!transport) return;
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    replyTo: organizer.email,
    bcc: invitees,
    subject: `Cancelled: ${booking.title}`,
    text: `Hi,\n\n${organizer.name} has cancelled this meeting.\n\n${details(booking)}`,
  });
}

module.exports = {
  sendBookingConfirmation,
  sendCancellationNotice,
  sendInvitations,
  sendInviteeCancellation,
};
