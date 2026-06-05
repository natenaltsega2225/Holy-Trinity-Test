export default function ReconciliationTable({
  rows,
  selected,
  setSelected,
  onCompare,
}) {
  function toggle(id) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  }

  return (
    <table className="recon-table">
      <thead>
        <tr>
          <th></th>
          <th>Name</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Match</th>
        </tr>
      </thead>

      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <input
                type="checkbox"
                checked={selected.includes(r.id)}
                onChange={() => toggle(r.id)}
              />
            </td>
            <td>{r.full_name}</td>
            <td>${r.amount}</td>
            <td>
              {r.reconciled ? "Matched" : "Unmatched"}
            </td>
            <td>
              <button onClick={() => onCompare(r)}>
                Compare
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}