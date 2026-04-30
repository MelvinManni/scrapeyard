(() => {
  const { useState, useEffect, useCallback } = React;
  const api = window.SY_API;

  function DashboardScreen({ user, onOpenJob, onNewJob, onAdmin, onLogout }) {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const refresh = useCallback(async () => {
      setLoading(true);
      try { const out = await api.get('/jobs'); setJobs(out.jobs); }
      finally { setLoading(false); }
    }, []);
    useEffect(() => { refresh(); }, [refresh]);

    return (
      <div className="screen" style={{ position: 'relative' }}>
        <div className="screen-scroll">
          <TopBar
            title="Scrape Yard"
            subtitle={`${jobs.length} job${jobs.length === 1 ? '' : 's'} · ${user.email}`}
            trailing={<>
              <button className="icon-btn" onClick={refresh} title="Refresh"><I.Refresh size={15} /></button>
              {user.role === 'admin' && (
                <button className="icon-btn" onClick={onAdmin} title="Admin"><I.Users size={16} /></button>
              )}
              <button className="icon-btn" onClick={onLogout} title="Sign out"><I.Logout size={15} /></button>
            </>}
          />
          {loading && jobs.length === 0 ? (
            <div className="empty"><div className="e-icon"><I.Refresh size={20} /></div>
              <div className="e-title">Loading…</div></div>
          ) : jobs.length ? (
            <div className="job-list">
              {jobs.map(j => <JobCard key={j.id} job={j} onOpen={onOpenJob} />)}
            </div>
          ) : (
            <div className="empty">
              <div className="e-icon"><I.Empty size={20} /></div>
              <div className="e-title">No jobs yet</div>
              <div className="e-text">Tap the + to create your first scrape job.</div>
            </div>
          )}
        </div>
        <button className="fab" onClick={onNewJob} aria-label="New job">
          <I.Plus size={22} sw={2} stroke="white" />
        </button>
      </div>
    );
  }

  window.DashboardScreen = DashboardScreen;
})();
