// SummaryCard — displays a financial summary figure.
// The optional `change` prop (a number %) shows a month-over-month trend.
// If no `change` is provided, the trend row is hidden (no fake numbers).
function SummaryCard({ title, amount, icon, type, change }) {
  return (
    <div className={`summary-card ${type}`}>
      <div className="card-top">
        <span>{title}</span>
        <span className="card-icon">{icon}</span>
      </div>

      <h2>{amount}</h2>

      {change != null && (
        <div className="card-bottom">
          <span className={change >= 0 ? "positive" : "negative"}>
            {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
          </span>
          <span>vs last month</span>
        </div>
      )}
    </div>
  );
}

export default SummaryCard;