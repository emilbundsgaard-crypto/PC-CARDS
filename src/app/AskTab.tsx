"use client";

import { useEffect, useState } from "react";

type Step =
  | { kind: "sql"; sql: string; columns: string[]; rows: unknown[][]; rowCount: number; truncated: boolean }
  | { kind: "sql_error"; sql: string; error: string };

const EXAMPLES = [
  "Which cardholders spent more than $50,000 in 2014?",
  "Show 2014 transactions over $5,000, largest first.",
  "Did anyone split a purchase across two vendors on the same day in 2014?",
  "Which vendors were used by only one cardholder but received over $10,000 in 2014?",
  "How much was spent at hotels in 2014, and by whom?",
];

export default function AskTab() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [answer, setAnswer] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState("");

  // Answers take roughly 30-90s: the model writes SQL, reads the rows, and
  // often queries again. Without a visible clock that reads as a hung page.
  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [loading]);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError("");
    setAnswer("");
    setSteps([]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed.");
      } else {
        setAnswer(data.answer);
        setSteps(data.steps ?? []);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2>Ask a question about the P-Card data</h2>
      <p className="hint">
        Ask in plain English. The model writes and runs read-only SQL against the transaction database, then explains
        what it found. You can expand the queries it ran to verify the work. Answers usually take 30&ndash;90 seconds.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <div className="grow" style={{ flexBasis: "100%" }}>
          <label htmlFor="q">Your question</label>
          <textarea
            id="q"
            value={question}
            placeholder="e.g. Which cardholders had the most transactions just under the $5,000 limit in 2014?"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                ask(question);
              }
            }}
          />
        </div>
        <button className="primary" type="submit" disabled={loading || !question.trim()}>
          {loading ? "Analysing…" : "Ask"}
        </button>
      </form>

      {loading && (
        <div className="working">
          <span className="spinner" aria-hidden="true" />
          <span>
            Writing SQL, running it against 489,178 transactions, and interpreting the results —{" "}
            <strong>{elapsed}s</strong>. This normally takes 30&ndash;90 seconds.
          </span>
        </div>
      )}

      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="chip"
            onClick={() => {
              setQuestion(ex);
              ask(ex);
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      {(answer || steps.length > 0) && (
        <div className="result">
          {answer && <div className="answer">{answer}</div>}

          {steps.length > 0 && (
            <details className="steps">
              <summary>
                {steps.length} quer{steps.length === 1 ? "y" : "ies"} run &mdash; click to inspect
              </summary>
              {steps.map((step, i) => (
                <div key={i}>
                  <pre className="sql">{step.sql}</pre>
                  {step.kind === "sql_error" ? (
                    <div className="error">{step.error}</div>
                  ) : (
                    <>
                      <div className="note">
                        {step.rowCount} row{step.rowCount === 1 ? "" : "s"}
                        {step.truncated && " (truncated to 500)"}
                      </div>
                      {step.rows.length > 0 && (
                        <div className="table-scroll" style={{ marginTop: 8 }}>
                          <table>
                            <thead>
                              <tr>
                                {step.columns.map((c) => (
                                  <th key={c}>{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {step.rows.slice(0, 20).map((row, r) => (
                                <tr key={r}>
                                  {row.map((cell, c) => (
                                    <td key={c} className={typeof cell === "number" ? "num" : ""}>
                                      {cell === null ? "—" : String(cell)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {step.rows.length > 20 && (
                        <div className="note">Showing the first 20 of {step.rows.length} returned rows.</div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </>
  );
}
