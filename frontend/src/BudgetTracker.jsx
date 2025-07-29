import React, { useState } from "react";
import "./App.css";

function BudgetTracker() {
  const [entries, setEntries] = useState([
    { type: "EXPENSE", amount: 5000, description: "child support", date: "2025-09-05T04:00:00.000Z" },
    { type: "INCOME", amount: 20000, description: "law suit", date: "2025-08-27T04:00:00.000Z" },
    { type: "INCOME", amount: 1500, description: "advance", date: "2025-08-25T04:00:00.000Z" },
  ]);

  return (
    <div className="App">
      <h1>Budget Tracker</h1>
      <table className="entries-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Amount</th>
            <th>Description</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr key={idx}>
              <td>{entry.type}</td>
              <td>${entry.amount.toFixed(2)}</td>
              <td>{entry.description}</td>
              <td>{new Date(entry.date).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BudgetTracker;
