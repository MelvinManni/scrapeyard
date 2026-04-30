(() => {
  const { useState } = React;
  const api = window.SY_API;

  function RequestAccessScreen({ onBack, toast }) {
    const [submitted, setSubmitted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', team: '', reason: '' });
    const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const submit = async () => {
      if (!form.name || !form.email) return toast('name and email required', 'error');
      if (!form.password) return toast('password required', 'error');
      if (form.password.length < 8) return toast('password must be at least 8 characters', 'error');
      if (form.password !== form.confirm) return toast('passwords do not match', 'error');
      setBusy(true);
      try {
        const { confirm, ...payload } = form;
        await api.post('/auth/request-access', payload);
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
                <label className="field-label">Password</label>
                <input className="input" value={form.password} onChange={update('password')} placeholder="At least 8 characters" type="password" autoComplete="new-password" />
                <span className="field-help">You'll use this to sign in once approved.</span>
              </div>
              <div className="field">
                <label className="field-label">Confirm password</label>
                <input className="input" value={form.confirm} onChange={update('confirm')} placeholder="Re-enter password" type="password" autoComplete="new-password" />
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

  window.RequestAccessScreen = RequestAccessScreen;
})();
