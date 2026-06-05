export default function ReconciliationSummary({ data }) {
  return (
    <div className="recon-cards">
      <Card title="Total" value={data.total} />
      <Card title="Matched" value={data.matched} />
      <Card title="Unmatched" value={data.unmatched} />
      <Card title="Match %" value={`${data.match_rate || 0}%`} />
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="recon-card">
      <h4>{title}</h4>
      <p>{value}</p>
    </div>
  );
}