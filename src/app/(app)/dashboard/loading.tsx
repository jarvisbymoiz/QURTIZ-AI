export default function DashboardLoading() {
  return (
    <section className="dashboard-loading" role="status" aria-label="Loading dashboard" aria-busy="true">
      <p className="sr-only">Loading your workspace dashboard…</p>
      <div aria-hidden="true">
        <span className="dashboard-loading-header" />
        <div className="dashboard-loading-grid">{[0, 1, 2, 3].map(i => <span key={i} />)}</div>
        <span className="dashboard-loading-panel" />
      </div>
    </section>
  );
}
