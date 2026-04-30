(() => {
  const { useState, useEffect, useCallback } = React;
  const api = window.SY_API;

  function DesktopResultsView({ user, onLogout, jobId, onJobs, onAdmin, toast }) {
    const [job, setJob] = useState(null);
    const [results, setResults] = useState([]);
    const [filter, setFilter] = useState('');
    const [applied, setApplied] = useState(null);
    const [thinking, setThinking] = useState(false);
    const [running, setRunning] = useState(false);
    const [runs, setRuns] = useState([]);

    const load = useCallback(async () => {
      if (!jobId) return;
      try {
        const o = await api.get(`/jobs/${jobId}/results`);
        setJob(o.job); setResults(o.results);
        const r2 = await api.get(`/jobs/${jobId}/runs`); setRuns(r2.runs);
      } catch (e) { toast(e.message, 'error'); }
    }, [jobId, toast]);
    useEffect(() => { load(); }, [load]);

    const apply = async () => {
      if (!filter.trim()) return;
      setThinking(true);
      try {
        const o = await api.post(`/jobs/${jobId}/filter`, { prompt: filter.trim() });
        setResults(o.results);
        setApplied(filter.trim());
        setFilter('');
      } catch (e) { toast(e.message, 'error'); }
      finally { setThinking(false); }
    };
    const runNow = async () => {
      setRunning(true);
      try { await api.post(`/jobs/${jobId}/run`); toast('Run complete'); await load(); }
      catch (e) { toast(e.message, 'error'); }
      finally { setRunning(false); }
    };
    const togglePause = async () => {
      if (!job) return;
      const next = job.status === 'paused' ? 'running' : 'paused';
      await api.patch(`/jobs/${jobId}`, { status: next });
      await load();
    };

    if (!job) return (
      <DesktopShell active="results" onNav={(v) => v === 'jobs' ? onJobs() : v === 'admin' ? onAdmin() : null}
        user={user} onLogout={onLogout} headerTitle="Loading…">
        <div className="splash">loading…</div>
      </DesktopShell>
    );

    return (
      <DesktopShell active="results" onNav={(v) => v === 'jobs' ? onJobs() : v === 'admin' ? onAdmin() : null}
        user={user} onLogout={onLogout}
        headerTitle={job.name}
        headerSub={`${results.length} results · ${job.cronLabel} · last run ${job.lastRun}`}
        headerRight={<>
          <StatusPill status={job.status} />
          <button className="btn secondary" onClick={runNow} disabled={running}>
            {running ? <div className="spin" style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: 'black' }}/> : <I.Refresh size={13} />} Run now
          </button>
          <button className="btn secondary" onClick={togglePause}>
            {job.status === 'paused' ? <I.Play size={13}/> : <I.Pause size={13}/>}
          </button>
        </>}
      >
        <div className="results-split">
          <div>
            <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <I.Sparkle size={14} stroke="var(--fg-muted)" />
                <span style={{ fontSize: 12, fontWeight: 500 }}>Filter prompt</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', marginLeft: 'auto' }}>
                  applied to {results.length} results
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea className="textarea" value={filter} onChange={e => setFilter(e.target.value)}
                  placeholder="Tell the model what to keep — e.g. only Series A or later, surface only North American companies, skip rumors."
                  style={{ flex: 1, minHeight: 60 }} />
                <button className="btn primary" onClick={apply} disabled={!filter.trim() || thinking}>
                  {thinking ? <div className="spin"/> : <I.Sparkle size={12} stroke="white"/>} Apply
                </button>
              </div>
              {applied && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-sunk)', borderRadius: 6, fontSize: 12, color: 'var(--fg-muted)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-subtle)', letterSpacing: 0.6, flexShrink: 0, marginTop: 1 }}>Active</span>
                  <span style={{ flex: 1, color: 'var(--fg)' }}>{applied}</span>
                  <button onClick={() => { setApplied(null); load(); }} style={{ color: 'var(--fg-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>clear</button>
                </div>
              )}
            </div>

            <div className="results-panel">
              <div className="results-panel-head">
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontWeight: 500 }}>Results</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>{results.length} items</span>
                </div>
              </div>
              <div className="results-list">
                {results.map(r => (
                  <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="result-card source-link">
                    {r.image
                      ? <img className="result-thumb" src={r.image} alt="" style={{ width: 88, height: 88, objectFit: 'cover' }} />
                      : <div className="result-thumb" style={{ width: 88, height: 88 }} />}
                    <div className="result-body">
                      <div className="result-source">
                        <span>{r.source}</span>
                        <span style={{ color: 'var(--fg-subtle)' }}>·</span>
                        <span>{r.time}</span>
                      </div>
                      <div className="result-title" style={{ fontSize: 15 }}>{r.title}</div>
                      {r.snippet && <div className="result-snippet">{r.snippet}</div>}
                      <div className="result-foot"><I.External size={10} /> view source</div>
                    </div>
                  </a>
                ))}
                {!results.length && (
                  <div className="empty">
                    <div className="e-icon"><I.Empty size={20}/></div>
                    <div className="e-title">No results yet</div>
                    <div className="e-text">Click <b>Run now</b> to fetch.</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="aside-card">
              <h3>Configuration</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-subtle)', letterSpacing: 0.6, marginBottom: 6 }}>Keywords</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {job.keywords.map(k => <KeywordChip key={k}>{k}</KeywordChip>)}
                  </div>
                </div>
                <div className="meta-row"><span>Schedule</span><span className="v">{job.cronLabel}</span></div>
                <div className="meta-row"><span>Next run</span><span className="v">{job.nextRun}</span></div>
                <div className="meta-row"><span>Status</span><span className="v">{job.status}</span></div>
              </div>
            </div>
            <div className="aside-card">
              <h3>Recent runs</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {runs.length ? runs.slice(0, 6).map(h => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{h.time}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>+{h.count}</span>
                  </div>
                )) : <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>No runs yet</span>}
              </div>
            </div>
          </div>
        </div>
      </DesktopShell>
    );
  }

  window.DesktopResultsView = DesktopResultsView;
})();
