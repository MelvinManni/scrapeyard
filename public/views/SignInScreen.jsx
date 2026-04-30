(() => {
  const { useState } = React;
  const api = window.SY_API;

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

  window.SignInScreen = SignInScreen;
})();
