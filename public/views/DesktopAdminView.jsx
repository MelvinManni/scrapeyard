(() => {
  const { useState, useEffect, useCallback } = React;
  const api = window.SY_API;

  function DesktopAdminView({ user, onLogout, onJobs, onResults, toast }) {
    const [requests, setRequests] = useState([]);
    const [users, setUsers] = useState([]);
    const load = useCallback(async () => {
      try {
        const [rq, us] = await Promise.all([api.get('/admin/requests'), api.get('/admin/users')]);
        setRequests(rq.requests); setUsers(us.users);
      } catch (e) { toast(e.message, 'error'); }
    }, [toast]);
    useEffect(() => { load(); }, [load]);

    const approve = async (id) => {
      const out = await api.post(`/admin/requests/${id}/approve`).catch(e => { toast(e.message, 'error'); });
      if (out?.tempPassword) toast(`Approved · temp password: ${out.tempPassword}`);
      else if (out) toast('Approved');
      await load();
    };
    const deny = async (id) => {
      await api.post(`/admin/requests/${id}/deny`).catch(e => toast(e.message, 'error'));
      await load();
    };

    return (
      <DesktopShell active="admin" onNav={(v) => v === 'jobs' ? onJobs() : v === 'results' ? onResults() : null}
        user={user} onLogout={onLogout}
        headerTitle="Access requests"
        headerSub={`${requests.length} pending · ${users.filter(u=>u.active).length} active members`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-subtle)', letterSpacing: 0.08, marginBottom: 10 }}>Pending requests</div>
            <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div className="admin-row head">
                <div>Person</div><div>Reason</div><div>Team</div><div>Requested</div><div></div>
              </div>
              {requests.length ? requests.map(r => (
                <div key={r.id} className="admin-row">
                  <div className="person">
                    <div className="avatar">{r.name.split(' ').map(s => s[0]).join('').slice(0,2)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="name">{r.name}</div>
                      <div className="email">{r.email}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.4 }}>{r.reason}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>{r.team}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>{r.requested}</div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn ghost sm" onClick={() => deny(r.id)}>Deny</button>
                    <button className="btn primary sm" onClick={() => approve(r.id)}>Approve</button>
                  </div>
                </div>
              )) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>No pending requests.</div>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-subtle)', letterSpacing: 0.08, marginBottom: 10 }}>Members</div>
            <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div className="admin-row head">
                <div>Person</div><div>Team</div><div>Role</div><div>Last active</div><div></div>
              </div>
              {users.map(u => (
                <div key={u.id} className="admin-row">
                  <div className="person">
                    <div className="avatar">{u.name.split(' ').map(s => s[0]).join('').slice(0,2)}</div>
                    <div>
                      <div className="name">{u.name}</div>
                      <div className="email">{u.email}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>{u.team}</div>
                  <div style={{ fontSize: 12 }}>
                    {u.role === 'Admin'
                      ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg)' }}>ADMIN</span>
                      : 'Member'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: u.active ? 'var(--fg-muted)' : 'var(--fg-subtle)' }}>{u.last}</div>
                  <div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DesktopShell>
    );
  }

  window.DesktopAdminView = DesktopAdminView;
})();
