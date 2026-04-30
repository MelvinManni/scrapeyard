(() => {
  const { useState, useEffect, useCallback } = React;
  const api = window.SY_API;

  function AdminScreen({ onBack, toast }) {
    const [tab, setTab] = useState('requests');
    const [requests, setRequests] = useState([]);
    const [users, setUsers] = useState([]);

    const load = useCallback(async () => {
      const [rq, us] = await Promise.all([api.get('/admin/requests'), api.get('/admin/users')]);
      setRequests(rq.requests);
      setUsers(us.users);
    }, []);
    useEffect(() => { load(); }, [load]);

    const approve = async (id) => {
      try {
        const out = await api.post(`/admin/requests/${id}/approve`);
        if (out.tempPassword) toast(`Approved · temp password: ${out.tempPassword}`);
        else toast('Approved');
        await load();
      } catch (e) { toast(e.message, 'error'); }
    };
    const deny = async (id) => {
      try { await api.post(`/admin/requests/${id}/deny`); toast('Denied'); await load(); }
      catch (e) { toast(e.message, 'error'); }
    };

    return (
      <div className="screen">
        <div className="screen-scroll">
          <TopBar
            title="Admin"
            subtitle={`${requests.length} pending · ${users.length} users`}
            leading={<button className="icon-btn" onClick={onBack}><I.Back size={16} /></button>}
            tight
          />
          <div className="tabset">
            <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>
              Requests {requests.length > 0 && <span style={{ marginLeft: 6, padding: '1px 6px', background: 'var(--accent)', color: 'white', borderRadius: 99, fontSize: 10 }}>{requests.length}</span>}
            </button>
            <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users</button>
          </div>

          {tab === 'requests' && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {requests.map(r => (
                <div key={r.id} style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                      <div className="avatar">{(r.name||'?').split(' ').map(s => s[0]).join('').slice(0,2)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>{r.email}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{r.requested}</div>
                  </div>
                  {r.reason && (
                    <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-subtle)', letterSpacing: 0.6, marginRight: 6 }}>{r.team}</span>
                      {r.reason}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn secondary sm" style={{ flex: 1 }} onClick={() => deny(r.id)}>Deny</button>
                    <button className="btn primary sm" style={{ flex: 1 }} onClick={() => approve(r.id)}>Approve</button>
                  </div>
                </div>
              ))}
              {!requests.length && (
                <div className="empty">
                  <div className="e-icon"><I.Check size={20} /></div>
                  <div className="e-title">All caught up</div>
                  <div className="e-text">No pending access requests right now.</div>
                </div>
              )}
            </div>
          )}

          {tab === 'users' && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {users.map(u => (
                <div key={u.id} style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="avatar">{u.name.split(' ').map(s => s[0]).join('').slice(0,2)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {u.name}
                      {u.role === 'Admin' && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--fg-muted)' }}>ADMIN</span>}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>{u.email}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{u.last}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  window.AdminScreen = AdminScreen;
})();
