import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  return (
    <nav className="navbar">
      <div className="nav-brand">Meeting Room Scheduler</div>
      {user && (
        <div className="nav-user">
          {user.is_admin && (
            <>
              <button className="nav-settings-btn" onClick={() => navigate('/admin')}>
                Admin
              </button>
              <button
                className="nav-settings-btn"
                onClick={() => window.dispatchEvent(new CustomEvent('open-admin-settings'))}
                title="Room Settings"
              >
                ⚙
              </button>
            </>
          )}
          <span>Hi, {user.name}</span>
          <button onClick={logout}>Sign Out</button>
        </div>
      )}
    </nav>
  );
}
