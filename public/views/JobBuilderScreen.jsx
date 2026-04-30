(() => {
  const { useState } = React;
  const api = window.SY_API;

  function JobBuilderScreen({ existing, onBack, onSaved, toast }) {
    const [name, setName] = useState(existing?.name || '');
    const [keywords, setKeywords] = useState(existing?.keywords || []);
    const [kwInput, setKwInput] = useState('');
    const [cron, setCron] = useState(existing?.cron || 'daily');
    const [filterPrompt, setFilterPrompt] = useState(existing?.filterPrompt || '');
    const [busy, setBusy] = useState(false);

    const addKw = (raw) => {
      const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length) {
        setKeywords(prev => {
          const next = [...prev];
          for (const p of parts) if (!next.includes(p)) next.push(p);
          return next;
        });
      }
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
                  onChange={e => {
                    const v = e.target.value;
                    if (v.includes(',')) addKw(v);
                    else setKwInput(v);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); addKw(kwInput); }
                    else if (e.key === 'Backspace' && !kwInput && keywords.length) {
                      setKeywords(keywords.slice(0, -1));
                    }
                  }}
                  onPaste={e => {
                    const text = e.clipboardData.getData('text');
                    if (text.includes(',')) {
                      e.preventDefault();
                      addKw(kwInput + text);
                    }
                  }}
                  onBlur={() => { if (kwInput.trim()) addKw(kwInput); }}
                  placeholder={keywords.length ? '' : 'type or paste keywords, separated by commas'}
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

  window.JobBuilderScreen = JobBuilderScreen;
})();
