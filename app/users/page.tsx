'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firestore';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        console.log('Fetching users...');
        const snapshot = await getDocs(collection(db, 'users'));
        console.log('Snapshot size:', snapshot.size);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log('Users data:', data);
        setUsers(data);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 className="title-gradient" style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>
          User Management
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '8px' }}>
          Overview of all registered users in SewainAja
        </p>
      </div>

      <div className="glass" style={{ overflow: 'hidden' }}>
        {users.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
            <p>No users found in the database.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '16px 24px', fontWeight: '600', color: 'hsl(var(--muted-foreground))' }}>User</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', color: 'hsl(var(--muted-foreground))' }}>Role</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', color: 'hsl(var(--muted-foreground))' }}>ID</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr 
                  key={user.id} 
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontWeight: '500' }}>{user.name || 'Anonymous'}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <span style={{ 
                      padding: '4px 12px', 
                      borderRadius: '99px', 
                      fontSize: '0.75rem',
                      background: user.isRenter ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: user.isRenter ? '#d8b4fe' : '#93c5fd',
                      border: `1px solid ${user.isRenter ? 'rgba(168, 85, 247, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                    }}>
                      {user.isRenter ? 'Renter' : 'User'}
                    </span>
                  </td>
                  <td style={{ padding: '20px 24px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                    {user.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
