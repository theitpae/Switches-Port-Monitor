import React from 'react';
import '../globals.css';

export default function VlanManagement() {
  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="brand">Cisco Monitor</div>
        <nav>
          <a href="/" className="nav-link">Dashboard</a>
          <a href="/ports" className="nav-link">Switches & Ports</a>
          <a href="/vlan" className="nav-link active">VLAN Management</a>
          <a href="#" className="nav-link">Audit Logs</a>
          <a href="/admin" className="nav-link">Admin Settings</a>
        </nav>
      </aside>

      <main className="main-content">
        <header className="header">
          <div>
            <h2>VLAN Configuration</h2>
            <p>Manage Virtual LANs globally across branches</p>
          </div>
          <button style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--accent-blue)', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
            + Create New VLAN
          </button>
        </header>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>VLAN ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Ports Assigned</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>10</strong></td>
                <td>Management_VLAN</td>
                <td><span className="status-up"><span className="status-dot"></span> Active</span></td>
                <td>Gi0/1, Gi0/24</td>
                <td><button className="btn-action">Edit / Assign Ports</button></td>
              </tr>
              <tr>
                <td><strong>20</strong></td>
                <td>Staff_VLAN</td>
                <td><span className="status-up"><span className="status-dot"></span> Active</span></td>
                <td>Gi0/2 - Gi0/10</td>
                <td><button className="btn-action">Edit / Assign Ports</button></td>
              </tr>
              <tr>
                <td><strong>30</strong></td>
                <td>Guest_WiFi</td>
                <td><span className="status-down"><span className="status-dot"></span> Suspended</span></td>
                <td>None</td>
                <td><button className="btn-action">Edit / Assign Ports</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
