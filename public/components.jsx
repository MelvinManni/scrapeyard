// Shared hooks and small presentational components used across screens.
// Each file in this app runs as a classic <script> via Babel standalone, so
// they share a single global scope. To avoid `const`/`let` collisions across
// files we wrap each module body in an IIFE and publish bindings on `window`.

(() => {
  const { useState, useEffect } = React;

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

  function useViewport() {
    const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    useEffect(() => {
      const onR = () => setW(window.innerWidth);
      window.addEventListener('resize', onR);
      return () => window.removeEventListener('resize', onR);
    }, []);
    return { w, isDesktop: w >= 900 };
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

  Object.assign(window, { useToast, useViewport, StatusPill, KeywordChip, TopBar, JobCard });
})();
