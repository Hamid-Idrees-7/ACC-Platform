import "./Skeleton.css";

const range = (n) => Array.from({ length: n }, (_, i) => i);

export function SkeletonRows({ count = 6 }) {
  return (
    <div className="skl skl-rows" role="status" aria-label="Loading">
      {range(count).map((i) => (
        <div key={i} className="skl-row">
          <span className="skl-box skl-icon" />
          <span className="skl-lines">
            <span className="skl-box skl-line" style={{ width: `${55 - (i % 3) * 10}%` }} />
            <span className="skl-box skl-line skl-line-sm" style={{ width: `${80 - (i % 2) * 20}%` }} />
          </span>
          <span className="skl-box skl-tag" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6 }) {
  return (
    <div className="skl skl-cards" role="status" aria-label="Loading">
      {range(count).map((i) => (
        <div key={i} className="skl-card">
          <span className="skl-box skl-avatar" />
          <span className="skl-box skl-line" style={{ width: "60%" }} />
          <span className="skl-box skl-pill" />
          <span className="skl-box skl-line skl-line-sm" style={{ width: "75%" }} />
          <span className="skl-box skl-line skl-line-sm" style={{ width: "50%" }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage({ stats = 4, rows = 5 }) {
  return (
    <div className="skl skl-page" role="status" aria-label="Loading">
      <span className="skl-box skl-title" />
      <span className="skl-box skl-line skl-line-sm" style={{ width: "35%" }} />
      {stats > 0 && (
        <div className="skl-stats">
          {range(stats).map((i) => (
            <div key={i} className="skl-stat">
              <span className="skl-box skl-line skl-line-sm" style={{ width: "50%" }} />
              <span className="skl-box skl-number" />
            </div>
          ))}
        </div>
      )}
      <div className="skl-panel">
        {range(rows).map((i) => (
          <div key={i} className="skl-panel-row">
            <span className="skl-box skl-line" style={{ width: `${40 + (i % 3) * 12}%` }} />
            <span className="skl-box skl-line skl-line-sm" style={{ width: "18%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
