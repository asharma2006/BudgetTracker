import React, { useState, useEffect, useMemo } from "react";
import useMeasure from "react-use-measure";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import "./App.css";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28EFF", "#FF6B6B"];

// AI fetch helper function (calls your backend securely)
const askAI = async (prompt, token) => {
  try {
    const response = await fetch("http://localhost:3001/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error("Failed to get response from AI");
    }

    const data = await response.json();
    return data.reply;
  } catch (err) {
    console.error("AI fetch error:", err);
    return "Error contacting AI";
  }
};

function App() {
  const [ref, bounds] = useMeasure();

  // Auth states
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  // Budget limit states
  const [incomeLimit, setIncomeLimit] = useState(() => {
    const val = localStorage.getItem("incomeLimit");
    return val ? parseFloat(val) : 0;
  });
  const [expenseLimit, setExpenseLimit] = useState(() => {
    const val = localStorage.getItem("expenseLimit");
    return val ? parseFloat(val) : 0;
  });

  // Entry states
  const [entries, setEntries] = useState([]);

  const [formData, setFormData] = useState({
    type: "INCOME",
    amount: "",
    description: "",
    date: "",
  });

  const [editingIndex, setEditingIndex] = useState(null);

  // Filter and sort state
  const [filterType, setFilterType] = useState("ALL");
  const [sortBy, setSortBy] = useState("date_desc");

  // Login/Register form state
  const [isRegistering, setIsRegistering] = useState(false);

  const [authData, setAuthData] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  // Notifications
  const [notification, setNotification] = useState("");

  // --- AI Assistant states ---
  const [aiInput, setAiInput] = useState("");
  const [aiResponse, setAiResponse] = useState("");

  // --- Auth functions ---

  useEffect(() => {
    if (token) {
      fetchUserData();
      fetchEntries();
    }
  }, [token]);

  async function fetchUserData() {
    try {
      const res = await fetch("/api/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        logout();
      }
    } catch {
      logout();
    }
  }

  async function fetchEntries() {
    try {
      const res = await fetch("/api/entries", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Convert all amounts to numbers here:
        const entriesWithNumbers = data.map((entry) => ({
          ...entry,
          amount: Number(entry.amount),
        }));
        setEntries(entriesWithNumbers);
      }
    } catch (err) {
      console.error("Failed to fetch entries", err);
    }
  }

  async function login(e) {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authData),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        localStorage.setItem("token", data.token);
        setUser(data.user);
        setAuthData({ username: "", password: "" });
        setAuthSuccess("");
        fetchEntries();
      } else {
        const err = await res.json();
        setAuthError(err.message || "Login failed");
      }
    } catch {
      setAuthError("Network error");
    }
  }

  async function register(e) {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    if (authData.username.trim().length < 3) {
      setAuthError("Username must be at least 3 characters");
      return;
    }
    if (authData.password.length < 6) {
      setAuthError("Password must be at least 6 characters");
      return;
    }
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authData),
      });
      if (res.ok) {
        setAuthSuccess("Registration successful! Please log in.");
        setIsRegistering(false);
        setAuthData({ username: "", password: "" });
      } else {
        const err = await res.json();
        setAuthError(err.message || "Registration failed");
      }
    } catch {
      setAuthError("Network error");
    }
  }

  function logout() {
    setUser(null);
    setToken("");
    localStorage.removeItem("token");
    setEntries([]);
  }

  // --- Entry form handlers ---

  const validateEntry = () => {
    if (!formData.amount || isNaN(formData.amount) || Number(formData.amount) <= 0) {
      alert("Amount must be a positive number");
      return false;
    }
    if (!formData.description.trim()) {
      alert("Description cannot be empty");
      return false;
    }
    if (!formData.date) {
      alert("Date is required");
      return false;
    }
    return true;
  };

  async function saveEntriesToBackend(updatedEntries) {
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entries: updatedEntries }),
      });
      if (!res.ok) {
        console.error("Failed to save entries");
      }
    } catch (err) {
      console.error("Error saving entries:", err);
    }
  }

  // Function to update income limit
  function updateIncomeLimit(e) {
    const val = parseFloat(e.target.value);
    setIncomeLimit(val);
    localStorage.setItem("incomeLimit", val);
  }

  // Function to update expense limit
  function updateExpenseLimit(e) {
    const val = parseFloat(e.target.value);
    setExpenseLimit(val);
    localStorage.setItem("expenseLimit", val);
  }

  // Add or edit entry handler
  function handleAddEntry(e) {
    e.preventDefault();
    if (!validateEntry()) return;

    const updatedEntries = [...entries];

    if (editingIndex !== null) {
      updatedEntries[editingIndex] = { ...formData, amount: Number(formData.amount) };
      setEditingIndex(null);
    } else {
      updatedEntries.push({ ...formData, amount: Number(formData.amount) });
    }
    setEntries(updatedEntries);
    saveEntriesToBackend(updatedEntries);

    setFormData({ type: "INCOME", amount: "", description: "", date: "" });
  }

  // Filtering entries based on filterType
  const filteredEntries = useMemo(() => {
    let filtered = [...entries];
    if (filterType !== "ALL") {
      filtered = filtered.filter((entry) => entry.type === filterType);
    }
    // Sorting
    switch (sortBy) {
      case "date_desc":
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
      case "date_asc":
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case "amount_desc":
        filtered.sort((a, b) => b.amount - a.amount);
        break;
      case "amount_asc":
        filtered.sort((a, b) => a.amount - b.amount);
        break;
      default:
        break;
    }
    return filtered;
  }, [entries, filterType, sortBy]);

  // Calculations for summary
  const totalIncome = entries
    .filter((entry) => entry.type === "INCOME")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const totalExpense = entries
    .filter((entry) => entry.type === "EXPENSE")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const balance = totalIncome - totalExpense;

  // Chart data for Income vs Expense
  const chartData = [
    { name: "Income", amount: totalIncome },
    { name: "Expense", amount: totalExpense },
  ];

  // Monthly trend example (fixed for type keys)
  const monthlyTrend = useMemo(() => {
    const map = {};
    entries.forEach(({ date, type, amount }) => {
      const monthKey = date.slice(0, 7); // 'YYYY-MM'
      if (!map[monthKey]) map[monthKey] = { month: monthKey, Income: 0, Expense: 0 };
      if (type === "INCOME") {
        map[monthKey].Income += amount;
      } else if (type === "EXPENSE") {
        map[monthKey].Expense += amount;
      }
    });
    return Object.values(map).sort((a, b) => (a.month > b.month ? 1 : -1));
  }, [entries]);

  // --- AI Assistant: send message function ---
  async function sendAiMessage() {
    if (!aiInput.trim()) return;

    setAiResponse("Thinking...");

    const reply = await askAI(aiInput, token);
    setAiResponse(reply);
    setAiInput("");
  }

  // --- Styles ---

  const containerStyle = {
    padding: 20,
    border: "1px solid #ccc",
    resize: "both",
    overflow: "auto",
    maxWidth: 700,
    margin: "0 auto",
    fontFamily: "Arial, sans-serif",
  };

  const responsiveFlex = {
    display: "flex",
    flexWrap: "wrap",
    gap: 20,
  };

  const flexChild = {
    flex: "1 1 300px",
  };

  // --- Render ---

  if (!token || !user) {
    return (
      <div style={{ maxWidth: 400, margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
        <h2>{isRegistering ? "Register" : "Login"} to Budget Tracker</h2>
        <form onSubmit={isRegistering ? register : login}>
          <label>
            Username:
            <input
              type="text"
              value={authData.username}
              onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
              required
              minLength={3}
            />
          </label>
          <br />
          <label>
            Password:
            <input
              type="password"
              value={authData.password}
              onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
              required
              minLength={6}
            />
          </label>
          <br />
          <button type="submit">{isRegistering ? "Register" : "Login"}</button>
        </form>
        <p style={{ color: "red" }}>{authError}</p>
        <p style={{ color: "green" }}>{authSuccess}</p>
        <p>
          {isRegistering ? "Already have an account? " : "Don't have an account? "}
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setAuthError("");
              setAuthSuccess("");
              setAuthData({ username: "", password: "" });
            }}
            style={{
              background: "none",
              border: "none",
              color: "blue",
              textDecoration: "underline",
              cursor: "pointer",
              padding: 0,
              fontSize: "inherit",
            }}
          >
            {isRegistering ? "Login here" : "Register here"}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div ref={ref} style={containerStyle}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2>🚀 Budget Tracker - Welcome, {user.username}</h2>
        <button onClick={logout}>Logout</button>
      </header>

      {/* Budget Limits */}
      <section style={{ marginBottom: 20 }}>
        <h3>Budget Limits</h3>
        <label>
          Income Limit: $
          <input
            type="number"
            value={incomeLimit}
            min="0"
            step="0.01"
            onChange={updateIncomeLimit}
            style={{ width: 100, marginRight: 20 }}
          />
        </label>
        <label>
          Expense Limit: $
          <input
            type="number"
            value={expenseLimit}
            min="0"
            step="0.01"
            onChange={updateExpenseLimit}
            style={{ width: 100 }}
          />
        </label>
      </section>

      {/* Notification */}
      {notification && (
        <section
          style={{
            backgroundColor: "#ffdddd",
            color: "#900",
            padding: 10,
            borderRadius: 5,
            marginBottom: 20,
            fontWeight: "bold",
          }}
          role="alert"
        >
          {notification}
        </section>
      )}

      {/* Filters and Sorting */}
      <section style={{ marginBottom: 20 }}>
        <label>
          Filter by Type:{" "}
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="ALL">All</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>
        </label>
        <label style={{ marginLeft: 20 }}>
          Sort by:{" "}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date_desc">Date (Newest First)</option>
            <option value="date_asc">Date (Oldest First)</option>
            <option value="amount_desc">Amount (High to Low)</option>
            <option value="amount_asc">Amount (Low to High)</option>
          </select>
        </label>
      </section>

      {/* Summary Section */}
      <section style={{ marginBottom: 20 }}>
        <h3>Summary</h3>
        <p>Income: ${totalIncome.toFixed(2)}</p>
        <p>Expense: ${totalExpense.toFixed(2)}</p>
        <p>
          <strong>Balance: ${balance.toFixed(2)}</strong>
        </p>
      </section>

      {/* Add/Edit Entry Form */}
      <section style={{ marginBottom: 20 }}>
        <h3>{editingIndex !== null ? "Edit Entry" : "Add New Entry"}</h3>
        <form onSubmit={handleAddEntry}>
          <label>
            Type:
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </label>
          <br />
          <label>
            Amount: $
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </label>
          <br />
          <label>
            Description:
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </label>
          <br />
          <label>
            Date:
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </label>
          <br />
          <button type="submit">{editingIndex !== null ? "Update" : "Add"} Entry</button>
          {editingIndex !== null && (
            <button
              type="button"
              onClick={() => {
                setEditingIndex(null);
                setFormData({ type: "INCOME", amount: "", description: "", date: "" });
              }}
              style={{ marginLeft: 10 }}
            >
              Cancel
            </button>
          )}
        </form>
      </section>

      {/* Entries List */}
      <section style={{ marginBottom: 20, maxHeight: 300, overflowY: "auto" }}>
        <h3>Entries</h3>
        {filteredEntries.length === 0 && <p>No entries to display.</p>}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ccc" }}>Type</th>
              <th style={{ borderBottom: "1px solid #ccc" }}>Amount</th>
              <th style={{ borderBottom: "1px solid #ccc" }}>Description</th>
              <th style={{ borderBottom: "1px solid #ccc" }}>Date</th>
              <th style={{ borderBottom: "1px solid #ccc" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry, index) => (
              <tr key={index}>
                <td>{entry.type}</td>
                <td>${entry.amount.toFixed(2)}</td>
                <td>{entry.description}</td>
                <td>{entry.date}</td>
                <td>
                  <button
                    onClick={() => {
                      setEditingIndex(index);
                      setFormData({
                        type: entry.type,
                        amount: entry.amount,
                        description: entry.description,
                        date: entry.date,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      const updatedEntries = [...entries];
                      updatedEntries.splice(index, 1);
                      setEntries(updatedEntries);
                      saveEntriesToBackend(updatedEntries);
                      if (editingIndex === index) {
                        setEditingIndex(null);
                        setFormData({ type: "INCOME", amount: "", description: "", date: "" });
                      }
                    }}
                    style={{ marginLeft: 10 }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Charts */}
      <section style={responsiveFlex}>
        {/* Pie Chart for Income vs Expense */}
        <div style={{ ...flexChild, height: 300 }}>
          <h3>Income vs Expense</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart for Monthly Trend */}
        <div style={{ ...flexChild, height: 300 }}>
          <h3>Monthly Income and Expenses</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrend} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Income" fill="#00C49F" />
              <Bar dataKey="Expense" fill="#FF8042" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* AI Assistant */}
      <section style={{ marginTop: 40 }}>
        <h3>AI Budget Assistant</h3>
        <textarea
          rows={3}
          style={{ width: "100%", marginBottom: 10 }}
          placeholder="Ask your budget assistant for advice..."
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
        />
        <button onClick={sendAiMessage} disabled={!aiInput.trim()}>
          Ask AI
        </button>
        <pre
          style={{
            backgroundColor: "#f5f5f5",
            padding: 10,
            marginTop: 10,
            minHeight: 60,
            whiteSpace: "pre-wrap",
          }}
        >
          {aiResponse}
        </pre>
      </section>
    </div>
  );
}

export default App;
