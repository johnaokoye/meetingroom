import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../App';
import api from '../api';

const RoomIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
    <path d="M3 13h1v7c0 .55.45 1 1 1h4v-5h6v5h4c.55 0 1-.45 1-1v-7h1l-9-9-9 9z"/>
  </svg>
);

export default function Login() {
  const { login } = useContext(AuthContext);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <RoomIcon />
        Meeting Room Scheduler
      </div>
      <div className="auth-card">
        <h2>Sign In</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} required />
          <label>Password</label>
          <input type="password" value={form.password} onChange={set('password')} required />
          <button type="submit">Sign In</button>
        </form>
        <p>Don't have an account? <Link to="/register">Register</Link></p>
      </div>
    </div>
  );
}
