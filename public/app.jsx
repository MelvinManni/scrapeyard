// Scrape Yard — root component. Boots the session, picks mobile vs desktop,
// and routes between screens. Each screen lives in its own file under views/.

(() => {
  const { useState, useEffect } = React;
  const api = window.SY_API;

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
})();
