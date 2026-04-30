(() => {
  const { useState, useEffect, useCallback } = React;
  const api = window.SY_API;

  function ResultsScreen({ jobId, onBack, onEdit, toast }) {
    const [job, setJob] = useState(null);
    const [results, setResults] = useState([]);
    const [tab, setTab] = useState('results');
    const [filter, setFilter] = useState('');
    const [appliedPrompt, setAppliedPrompt] = useState(null);
    const [thinking, setThinking] = useState(false);
    const [running, setRunning] = useState(false);
    const [runs, setRuns] = useState([]);

    const load = useCallback(async () => {
      const out = await api.get(`/jobs/${jobId}/results`);
      setJob(out.job);
      setResults(out.results);
    }, [jobId]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
      if (tab === 'history' && job) {
        api.get(`/jobs/${jobId}/runs`).then(o => setRuns(o.runs)).catch(() => {});
      }
    }, [tab, job, jobId]);

    const apply = async () => {
      if (!filter.trim()) return;
      setThinking(true);
      try {
        const out = await api.post(`/jobs/${jobId}/filter`, { prompt: filter.trim() });
        setResults(out.results);
        setAppliedPrompt(filter.trim());
      } catch (e) {
        toast(e.message, 'error');
      } finally { setThinking(false); }
    };
    const clear = async () => {
      setAppliedPrompt(null); setFilter('');
      await load();
    };
    const runNow = async () => {
      setRunning(true);
      try {
        await api.post(`/jobs/${jobId}/run`);
        toast('Run complete');
        await load();
      } catch (e) { toast(e.message, 'error'); }
      finally { setRunning(false); }
    };
    const togglePause = async () => {
      if (!job) return;
      const next = job.status === 'paused' ? 'running' : 'paused';
      try {
        await api.patch(`/jobs/${jobId}`, { status: next });
        await load();
        toast(next === 'paused' ? 'Job paused' : 'Job resumed');
      } catch (e) { toast(e.message, 'error'); }
    };
    const remove = async () => {
      if (!confirm('Delete this job and its results?')) return;
      try { await api.del(`/jobs/${jobId}`); onBack(); }
      catch (e) { toast(e.message, 'error'); }
    };

    if (!job) return <div className="splash">loading job…</div>;

    return (
      <div className="screen">
        <div className="screen-scroll">
          <TopBar
            title={job.name}
            subtitle={`${results.length} results · ${job.cronLabel}`}
            leading={<button className="icon-btn" onClick={onBack}><I.Back size={16} /></button>}
            trailing={<>
              <button className="icon-btn" onClick={runNow} title="Run now" disabled={running}>
                {running ? <div className="spin" style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: 'black' }}/> : <I.Refresh size={15} />}
              </button>
              <button className="icon-btn" onClick={togglePause} title={job.status === 'paused' ? 'Resume' : 'Pause'}>
                {job.status === 'paused' ? <I.Play size={14}/> : <I.Pause size={14}/>}
              </button>
            </>}
            tight
          />
          <div className="tabset">
            <button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>Results</button>
            <button className={tab === 'config' ? 'active' : ''} onClick={() => setTab('config')}>Configuration</button>
            <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Run history</button>
          </div>

          {tab === 'results' && (
            <>
              {appliedPrompt && (
                <div className="filter-applied">
                  <I.Sparkle size={14} stroke="var(--fg-muted)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="label">Filter applied</div>
                    <div style={{ color: 'var(--fg)', lineHeight: 1.4 }}>{appliedPrompt}</div>
                  </div>
                  <button className="clear" onClick={clear}>clear</button>
                </div>
              )}
              <div className="results-list">
                {results.map(r => (
                  <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="result-card source-link">
                    {r.image
                      ? <img className="result-thumb" src={r.image} alt="" style={{ objectFit: 'cover' }} />
                      : <div className="result-thumb" />}
                    <div className="result-body">
                      <div className="result-source">
                        <span>{r.source}</span>
                        <span style={{ color: 'var(--fg-subtle)' }}>·</span>
                        <span>{r.time}</span>
                      </div>
                      <div className="result-title">{r.title}</div>
                      {r.snippet && <div className="result-snippet">{r.snippet}</div>}
                    </div>
                  </a>
                ))}
                {!results.length && (
                  <div className="empty">
                    <div className="e-icon"><I.Empty size={20} /></div>
                    <div className="e-title">No results yet</div>
                    <div className="e-text">Next scheduled run is {job.nextRun}, or trigger one manually.</div>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'config' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 640 }}>
              <div className="field">
                <label className="field-label">Keywords</label>
                <div className="keyword-row">
                  {job.keywords.map(k => <KeywordChip key={k}>{k}</KeywordChip>)}
                </div>
              </div>
              <div className="field">
                <label className="field-label">Schedule</label>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{job.cronLabel}</div>
              </div>
              <div className="field">
                <label className="field-label">Default filter prompt</label>
                <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.5, color: 'var(--fg-muted)' }}>
                  {job.filterPrompt || <span style={{ color: 'var(--fg-subtle)' }}>None set.</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn secondary" style={{ flex: 1 }} onClick={togglePause}>
                  {job.status === 'paused' ? <><I.Play size={12}/> Resume</> : <><I.Pause size={12}/> Pause</>}
                </button>
                <button className="btn secondary" style={{ flex: 1 }} onClick={runNow} disabled={running}>
                  <I.Refresh size={12} /> Run now
                </button>
                <button className="btn secondary" style={{ flex: 1 }} onClick={onEdit}>Edit</button>
              </div>
              <button className="btn ghost sm" onClick={remove} style={{ alignSelf: 'flex-start', color: 'var(--red)' }}>
                <I.Trash size={12} stroke="var(--red)"/> Delete job
              </button>
            </div>
          )}

          {tab === 'history' && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {runs.length ? runs.map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{h.time}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                      {h.count} new · {h.duration} · {h.status}
                    </div>
                  </div>
                  <I.Chevron size={14} stroke="var(--fg-subtle)" />
                </div>
              )) : (
                <div className="empty">
                  <div className="e-icon"><I.Clock size={20} /></div>
                  <div className="e-title">No runs yet</div>
                </div>
              )}
            </div>
          )}
        </div>

        {tab === 'results' && (
          <div className="filter-bar">
            <textarea
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Refine results — e.g. only Series A or later, exclude rumors…"
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) apply(); }}
            />
            <button className="send" disabled={!filter.trim() || thinking} onClick={apply}>
              {thinking ? <div className="spin"/> : <I.Send size={16} stroke="white" />}
            </button>
          </div>
        )}
      </div>
    );
  }

  window.ResultsScreen = ResultsScreen;
})();
