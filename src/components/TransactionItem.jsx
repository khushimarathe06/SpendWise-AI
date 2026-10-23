function TransactionItem({
  icon,
  category,
  description,
  date,
  amount,
  type,
}) {
  return (
    <div className="transaction-row">

      <div className="transaction-info">

        <div className={`transaction-icon ${type}`}>
          {icon}
        </div>

        <div>
          <strong>{category}</strong>

          {description && (
            <small>{description}</small>
          )}

          <small>{date}</small>
        </div>

      </div>

      <span
        className={
          type === "income"
            ? "transaction-income"
            : "transaction-expense"
        }
      >
        {type === "income" ? "+" : "−"} {amount}
      </span>

    </div>
  );
}

export default TransactionItem;