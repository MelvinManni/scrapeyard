// Scrape Yard — production SPA. Reuses the design's visual language
// (job cards, status pills, kw chips, filter bar, admin tables) and wires
// every interaction to the live REST API.

const { useState, useEffect, useCallback, useMemo } = React;
const api = window.SY_API;

// ── helpers ─────────────────────────────────────────────
function useToast() {
  const [t, setT] = useState(null);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), 2400);
    return () => clearTimeout(id);
  }, [t]);
  const show = (msg, kind = 'info') => setT({ msg, kind });
  const node = t ? <div className={`toast ${t.kind === 'error' ? 'error' : ''}`}>{t.msg}</div> : null;
  return [show, node];
}

const StatusPill = ({ status }) => {
  const labels = { running: 'Running', paused: 'Paused', error: 'Error', fresh: 'New' };
  return (
    <span className={`status ${status}`}>
      <span className="dot" />{labels[status] || status}
    </span>
  );
};

const KeywordChip = ({ children, onRemove, muted }) => (
  <span className={`kw-chip ${muted ? 'muted' : ''}`}>
    {children}
    {onRemove && (
      <button onClick={onRemove} aria-label="Remove">
        <I.Close size={10} sw={2} />
      </button>
    )}
  </span>
);

const TopBar = ({ title, subtitle, leading, trailing, tight }) => (
  <div className={`app-top ${tight ? 'tight' : ''}`}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
      {leading}
      <div style={{ minWidth: 0 }}>
        <h2 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h2>
        {subtitle && <div className="top-sub">{subtitle}</div>}
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>{trailing}</div>
  </div>
);

function useViewport() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  return { w, isDesktop: w >= 900 };
}

// ── 1. SIGN IN ─────────────────────────────────────────
function SignInScreen({ onSignedIn, onRequestAccess, toast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) return toast('email and password required', 'error');
    setBusy(true);
    try {
      const out = await api.post('/auth/signin', { email, password });
      onSignedIn(out.user);
    } catch (e) {
      toast(e.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <div className="screen-scroll">
        <div className="auth signin">
          <div className="auth-brand">
            <div className="auth-glyph">SY</div>
            <div>
              <h1>Sign in to Scrape Yard</h1>
              <p className="sub">Internal research tool. Access is granted by an admin — request below if you don't have an account.</p>
            </div>
          </div>
          <div className="form">
            <div className="field">
              <label className="field-label">Work email</label>
              <input className="input" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="you@company.com" type="email" autoComplete="email" />
            </div>
            <div className="field">
              <label className="field-label">Password</label>
              <input className="input" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="••••••••" autoComplete="current-password" />
            </div>
            <button className="btn primary lg full" onClick={submit} disabled={busy}>
              {busy ? <div className="spin" /> : 'Sign in'}
            </button>
            <div className="switch">
              No account yet? <button onClick={onRequestAccess}>Request access</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 2. REQUEST ACCESS ──────────────────────────────────
function RequestAccessScreen({ onBack, toast }) {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', team: '', reason: '' });
  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    if (!form.name || !form.email) return toast('name and email required', 'error');
    setBusy(true);
    try {
      await api.post('/auth/request-access', form);
      setSubmitted(true);
    } catch (e) {
      toast(e.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <div className="screen-scroll">
        <TopBar
          title="Request access"
          leading={<button className="icon-btn" onClick={onBack}><I.Back size={16} /></button>}
        />
        {submitted ? (
          <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--bg-elev)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center' }}>
              <I.Check size={22} sw={2} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Request submitted</div>
              <div style={{ fontSize: 13, color: 'var(--fg-muted)', maxWidth: 280, lineHeight: 1.5 }}>
                An admin will review and email you at <span style={{ fontFamily: 'var(--font-mono)' }}>{form.email}</span> within 1 business day.
              </div>
            </div>
            <button className="btn secondary" onClick={onBack}>Back to sign in</button>
          </div>
        ) : (
          <div style={{ padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto', width: '100%' }}>
            <div className="field">
              <label className="field-label">Full name</label>
              <input className="input" value={form.name} onChange={update('name')} placeholder="Jane Doe" />
            </div>
            <div className="field">
              <label className="field-label">Work email</label>
              <input className="input" value={form.email} onChange={update('email')} placeholder="you@acme.io" type="email" />
              <span className="field-help">Must match an approved company domain.</span>
            </div>
            <div className="field">
              <label className="field-label">Team</label>
              <input className="input" value={form.team} onChange={update('team')} placeholder="Marketing, Sales, Research…" />
            </div>
            <div className="field">
              <label className="field-label">What will you use it for?</label>
              <textarea className="textarea" value={form.reason} onChange={update('reason')} placeholder="One or two sentences helps the admin approve faster." />
            </div>
            <button className="btn primary lg full" onClick={submit} disabled={busy}>
              {busy ? <div className="spin" /> : 'Submit request'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── job card (mobile) ──────────────────────────────────
function JobCard({ job, onOpen }) {
  return (
    <div className={`job-card ${job.status === 'error' ? 'error' : ''}`} onClick={() => onOpen(job.id)}>
      <div className="job-head">
        <div style={{ minWidth: 0 }}>
          <div className="job-name">{job.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>
            {job.cronLabel}
          </div>
        </div>
        <StatusPill status={job.status} />
      </div>
      <div className="keyword-row">
        {job.keywords.slice(0, 3).map((k, i) => <KeywordChip key={i} muted>{k}</KeywordChip>)}
        {job.keywords.length > 3 && <span style={{ fontSize: 11, color: 'var(--fg-subtle)', alignSelf: 'center', fontFamily: 'var(--font-mono)' }}>+{job.keywords.length - 3}</span>}
      </div>
      <div className="job-meta">
        <div><span className="label">last</span>{job.lastRun}</div>
        <div><span className="label">next</span>{job.nextRun}</div>
        <div style={{ marginLeft: 'auto' }}><span className="label">results</span>{job.results}</div>
      </div>
    </div>
  );
}

// ── 3. DASHBOARD (mobile) ──────────────────────────────
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

// ── 4. NEW / EDIT JOB ──────────────────────────────────
function JobBuilderScreen({ existing, onBack, onSaved, toast }) {
  const [name, setName] = useState(existing?.name || '');
  const [keywords, setKeywords] = useState(existing?.keywords || []);
  const [kwInput, setKwInput] = useState('');
  const [cron, setCron] = useState(existing?.cron || 'daily');
  const [filterPrompt, setFilterPrompt] = useState(existing?.filterPrompt || '');
  const [busy, setBusy] = useState(false);

  const addKw = (raw) => {
    const v = raw.trim();
    if (v && !keywords.includes(v)) setKeywords([...keywords, v]);
    setKwInput('');
  };
  const removeKw = (k) => setKeywords(keywords.filter(x => x !== k));

  const presets = [
    { id: 'hourly', title: 'Hourly', sub: 'Every hour, on the hour' },
    { id: 'daily', title: 'Daily', sub: 'Every day at 09:00' },
    { id: 'weekly', title: 'Weekly', sub: 'Mondays at 08:00' },
    { id: 'manual', title: 'Manual', sub: 'Run on-demand only' },
  ];

  const save = async () => {
    if (!name.trim()) return toast('name required', 'error');
    if (!keywords.length) return toast('add at least one keyword', 'error');
    setBusy(true);
    try {
      const body = { name: name.trim(), keywords, cron, filterPrompt };
      const out = existing
        ? await api.patch(`/jobs/${existing.id}`, body)
        : await api.post('/jobs', body);
      onSaved(out.job);
    } catch (e) {
      toast(e.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <div className="screen-scroll">
        <TopBar
          title={existing ? 'Edit job' : 'New job'}
          leading={<button className="icon-btn" onClick={onBack}><I.Close size={16} /></button>}
          trailing={<button className="btn primary sm" onClick={save} disabled={busy}>
            {busy ? <div className="spin" /> : 'Save'}
          </button>}
        />
        <div style={{ padding: '20px 20px 100px', display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 640, margin: '0 auto', width: '100%' }}>
          <div className="field">
            <label className="field-label">Job name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. AI Funding Tracker" />
          </div>

          <div className="field">
            <label className="field-label">Keywords</label>
            <div className="kw-input-wrap">
              {keywords.map(k => <KeywordChip key={k} onRemove={() => removeKw(k)}>{k}</KeywordChip>)}
              <input
                value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKw(kwInput); }
                  else if (e.key === 'Backspace' && !kwInput && keywords.length) {
                    setKeywords(keywords.slice(0, -1));
                  }
                }}
                placeholder={keywords.length ? '' : 'type a keyword, press Enter'}
              />
            </div>
            <span className="field-help">Each keyword runs as a separate query. Use quotes for exact phrases.</span>
          </div>

          <div className="field">
            <label className="field-label">Schedule</label>
            <div className="radio-grid">
              {presets.map(p => (
                <button key={p.id} className={`radio-card ${cron === p.id ? 'active' : ''}`} onClick={() => setCron(p.id)}>
                  <span className="rc-title">{p.title}</span>
                  <span className="rc-sub">{p.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              Filter prompt
              <span style={{ fontWeight: 400, color: 'var(--fg-muted)', marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>optional</span>
            </label>
            <textarea className="textarea" value={filterPrompt} onChange={e => setFilterPrompt(e.target.value)}
              placeholder="Tell the model what to keep — e.g. only include rounds above $5M, skip rumors, surface only North American companies." />
            <span className="field-help">Applied to every result before it shows up.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 5. RESULTS ─────────────────────────────────────────
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

// ── 6. ADMIN ───────────────────────────────────────────
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

// ── DESKTOP shell + views ──────────────────────────────
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

// ── ROOT APP ──────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);
  const [view, setView] = useState({ name: 'signin' }); // {name, jobId?, editJob?}
  const [toast, toastNode] = useToast();
  const { isDesktop } = useViewport();

  // boot — try /me
  useEffect(() => {
    api.get('/auth/me')
      .then(({ user }) => { setUser(user); setView({ name: 'dashboard' }); })
      .catch(() => setView({ name: 'signin' }))
      .finally(() => setBooted(true));
  }, []);

  const logout = async () => {
    try { await api.post('/auth/signout'); } catch {}
    setUser(null); setView({ name: 'signin' });
  };

  if (!booted) return <div className="splash">scrape yard…</div>;

  if (!user) {
    if (view.name === 'request') {
      return (<><div className={`app mobile`}>
        <RequestAccessScreen onBack={() => setView({ name: 'signin' })} toast={toast} />
      </div>{toastNode}</>);
    }
    return (<><div className={`app mobile`}>
      <SignInScreen
        onSignedIn={(u) => { setUser(u); setView({ name: 'dashboard' }); }}
        onRequestAccess={() => setView({ name: 'request' })}
        toast={toast}
      />
    </div>{toastNode}</>);
  }

  // Authenticated views
  const shellClass = `app ${isDesktop ? 'desktop' : 'mobile'}`;

  // mobile rendering
  if (!isDesktop) {
    let screen = null;
    switch (view.name) {
      case 'builder':
        screen = <JobBuilderScreen
          existing={view.editJob}
          onBack={() => setView({ name: view.editJob ? 'results' : 'dashboard', jobId: view.editJob?.id })}
          onSaved={() => setView({ name: 'dashboard' })}
          toast={toast}
        />; break;
      case 'results':
        screen = <ResultsScreen
          jobId={view.jobId}
          onBack={() => setView({ name: 'dashboard' })}
          onEdit={() => {
            api.get(`/jobs/${view.jobId}`).then(o => setView({ name: 'builder', editJob: o.job }));
          }}
          toast={toast}
        />; break;
      case 'admin':
        screen = <AdminScreen onBack={() => setView({ name: 'dashboard' })} toast={toast} />; break;
      case 'dashboard':
      default:
        screen = <DashboardScreen
          user={user}
          onOpenJob={(id) => setView({ name: 'results', jobId: id })}
          onNewJob={() => setView({ name: 'builder' })}
          onAdmin={() => setView({ name: 'admin' })}
          onLogout={logout}
        />;
    }
    return <><div className={shellClass}>{screen}</div>{toastNode}</>;
  }

  // desktop rendering
  let view$ = null;
  switch (view.name) {
    case 'builder':
      view$ = <DesktopShell active="jobs" user={user} onLogout={logout}
        onNav={(v) => setView({ name: v === 'admin' ? 'admin' : 'dashboard' })}
        headerTitle={view.editJob ? 'Edit job' : 'New job'}>
        <div style={{ maxWidth: 720 }}>
          <JobBuilderScreen
            existing={view.editJob}
            onBack={() => setView({ name: 'dashboard' })}
            onSaved={() => setView({ name: 'dashboard' })}
            toast={toast}
          />
        </div>
      </DesktopShell>;
      break;
    case 'results':
      view$ = <DesktopResultsView user={user} onLogout={logout} jobId={view.jobId}
        onJobs={() => setView({ name: 'dashboard' })}
        onAdmin={() => setView({ name: 'admin' })} toast={toast} />;
      break;
    case 'admin':
      view$ = <DesktopAdminView user={user} onLogout={logout}
        onJobs={() => setView({ name: 'dashboard' })}
        onResults={() => setView({ name: 'dashboard' })} toast={toast} />;
      break;
    default:
      view$ = <DesktopJobsView user={user} onLogout={logout}
        onOpen={(id) => setView({ name: 'results', jobId: id })}
        onNew={() => setView({ name: 'builder' })}
        onAdmin={() => setView({ name: 'admin' })}
        onResults={() => setView({ name: 'dashboard' })}
        toast={toast} />;
  }
  return <><div className={shellClass}>{view$}</div>{toastNode}</>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
