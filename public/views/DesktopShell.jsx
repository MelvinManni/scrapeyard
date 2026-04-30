(() => {
  const { useState, useEffect } = React;
  const api = window.SY_API;

  function DesktopShell({ active, onNav, user, onLogout, children, headerTitle, headerSub, headerRight }) {
    const [counts, setCounts] = useState({ jobs: 0, requests: 0 });
    useEffect(() => {
      api.get('/jobs').then(o => setCounts(c => ({ ...c, jobs: o.jobs.length }))).catch(() => {});
      if (user.role === 'admin') {
        api.get('/admin/requests').then(o => setCounts(c => ({ ...c, requests: o.requests.length }))).catch(() => {});
      }
    }, [user, active]);

    return (
      <div className="desk">
        <aside className="desk-side">
          <div className="brand-mark">
            <div className="glyph">SY</div>
            <div className="name">Scrape Yard</div>
          </div>
          <div className="side-section">Workspace</div>
          <button className={`nav-item ${active === 'jobs' ? 'active' : ''}`} onClick={() => onNav('jobs')}>
            <I.List size={14} /> Jobs <span className="count">{counts.jobs}</span>
          </button>
          <button className={`nav-item ${active === 'results' ? 'active' : ''}`} onClick={() => onNav('results')}>
            <I.Search size={14} /> Recent results
          </button>
          {user.role === 'admin' && <>
            <div className="side-section">Admin</div>
            <button className={`nav-item ${active === 'admin' ? 'active' : ''}`} onClick={() => onNav('admin')}>
              <I.Users size={14} /> Access requests <span className="count">{counts.requests}</span>
            </button>
          </>}
          <div className="user-block">
            <div className="avatar">{user.name.split(' ').map(s => s[0]).join('').slice(0,2)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{user.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)' }}>{user.role}</div>
            </div>
            <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={onLogout} title="Sign out">
              <I.Logout size={13} />
            </button>
          </div>
        </aside>
        <section className="desk-main">
          <header className="desk-header">
            <div>
              <h1>{headerTitle}</h1>
              {headerSub && <div className="h-sub">{headerSub}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>{headerRight}</div>
          </header>
          <div className="desk-content">{children}</div>
        </section>
      </div>
    );
  }

  window.DesktopShell = DesktopShell;
})();
