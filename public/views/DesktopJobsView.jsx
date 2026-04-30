(() => {
  const { useState, useEffect, useCallback } = React;
  const api = window.SY_API;

  function DesktopJobsView({ user, onLogout, onOpen, onNew, onAdmin, onResults, toast }) {
    const [jobs, setJobs] = useState([]);
    const refresh = useCallback(async () => {
      try { const o = await api.get('/jobs'); setJobs(o.jobs); }
      catch (e) { toast(e.message, 'error'); }
    }, [toast]);
    useEffect(() => { refresh(); }, [refresh]);

    return (
      <DesktopShell active="jobs" onNav={(v) => v === 'admin' ? onAdmin() : v === 'results' ? onResults() : null}
        user={user} onLogout={onLogout}
        headerTitle="Jobs"
        headerSub={`${jobs.length} active`}
        headerRight={<>
          <button className="btn secondary" onClick={refresh}><I.Refresh size={13} /> Sync</button>
          <button className="btn primary" onClick={onNew}><I.Plus size={13} stroke="white" /> New job</button>
        </>}
      >
        {jobs.length ? (
          <div className="table">
            <div className="table-row table-head">
              <div>Name</div><div>Keywords</div><div>Schedule</div><div>Last run</div><div>Status</div><div></div>
            </div>
            {jobs.map(j => (
              <div key={j.id} className="table-row body" onClick={() => onOpen(j.id)}>
                <div>
                  <div className="cell-name">{j.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>{j.results} results</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {j.keywords.slice(0, 2).map((k, i) => <KeywordChip key={i} muted>{k}</KeywordChip>)}
                  {j.keywords.length > 2 && <span style={{ fontSize: 11, color: 'var(--fg-subtle)', alignSelf: 'center', fontFamily: 'var(--font-mono)' }}>+{j.keywords.length - 2}</span>}
                </div>
                <div className="cell-mono">{j.cronLabel}</div>
                <div className="cell-mono">{j.lastRun}</div>
                <div><StatusPill status={j.status} /></div>
                <div style={{ textAlign: 'right' }}><I.Chevron size={14} stroke="var(--fg-subtle)" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="e-icon"><I.Empty size={20} /></div>
            <div className="e-title">No jobs yet</div>
            <div className="e-text">Click <b>New job</b> to start scraping.</div>
          </div>
        )}
      </DesktopShell>
    );
  }

  window.DesktopJobsView = DesktopJobsView;
})();
