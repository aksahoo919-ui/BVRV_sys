import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../utils/api';

export default function AdminPendingUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { refreshPending } = useOutletContext();

  async function load() {
    try {
      const r = await api.get('/admin/pending-users');
      setUsers(r.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function approve(id) {
    await api.patch(`/admin/users/${id}/approve`);
    load(); refreshPending();
  }

  async function reject(id) {
    await api.patch(`/admin/users/${id}/reject`);
    load(); refreshPending();
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Pending Approvals</h1>
      {users.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-lg">No pending approvals</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Joined</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} size={8} />
                      <div>
                        <p className="font-medium text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.role === 'instructor' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {u.role || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => approve(u.id)} className="btn-primary py-1 px-3 text-xs">Approve</button>
                      <button onClick={() => reject(u.id)} className="btn-danger py-1 px-3 text-xs">Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Avatar({ user, size = 8 }) {
  if (user.avatar_url) return <img src={user.avatar_url} className={`w-${size} h-${size} rounded-full`} alt="" />;
  return (
    <div className={`w-${size} h-${size} rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs`}>
      {user.name?.[0]?.toUpperCase()}
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}
