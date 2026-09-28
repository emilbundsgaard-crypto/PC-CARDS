"use client";

import { useEffect, useState } from "react";

type Row = Record<string, string | number | null>;

type SearchResult = {
  rows: Row[];
  rowCount: number;
  truncated: boolean;
  total: number;
  field: string;
  keyword: string;
  year: number;
};

const COLUMNS = ["TransactionDate", "PostedDate", "FullName", "Amount", "Vendor", "Description", "MCC"];

/** Starter keywords for each prohibited category, per the OSU P-Card procedure. */
const SUGGESTED: { category: string; description: string[]; vendor: string[] }[] = [
  { category: "Alcohol", description: ["WINE", "BEER", "LIQUOR"], vendor: ["LIQUOR", "BOTTLE SHOP", "BREWING"] },
  { category: "Cash / ATM", description: ["CASH", "ATM"], vendor: ["ATM", "CASH ADVANCE"] },
  { category: "Decorations", description: ["DECORATION", "BALLOON", "BANNER"], vendor: ["PARTY", "HOBBY LOBBY"] },
  { category: "Donations / sponsorships", description: ["DONATION", "SPONSOR"], vendor: ["FOUNDATION", "CHARIT"] },
  { category: "Gasoline", description: ["FUEL", "GASOLINE", "UNLEADED"], vendor: ["OIL", "SHELL", "PHILLIPS 66"] },
  { category: "Gifts / gift cards", description: ["GIFT CARD", "GIFT CERT", "GIFT BAG"], vendor: ["GIFT", "HALLMARK"] },
  { category: "Insurance", description: ["INSURANCE", "PREMIUM"], vendor: ["INSURANCE", "ALLSTATE"] },
  { category: "Late fees", description: ["LATE FEE", "FINANCE CHARGE", "PENALTY"], vendor: [] },
  { category: "Mail / postage", description: ["POSTAGE", "STAMPS"], vendor: ["USPS", "POSTAL", "PITNEY"] },
  { category: "Moving expenses", description: ["MOVING", "RELOCATION"], vendor: ["U-HAUL", "MAYFLOWER", "PENSKE"] },
  { category: "Personal purchases", description: ["PERSONAL"], vendor: ["NETFLIX", "SPA", "SALON"] },
  { category: "Memberships / dues", description: ["MEMBERSHIP", "DUES"], vendor: ["CLUB", "ASSOCIATION"] },
  { category: "Salaries / wages", description: ["SALARY", "WAGES", "PAYROLL", "BONUS"], vendor: ["PAYROLL", "STAFFING"] },
  { category: "Awards / employee items", description: ["AWARD", "PLAQUE", "TROPHY", "ENGRAV"], vendor: ["TROPHY", "AWARDS"] },
];

function money(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function DashboardTab() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number>(2014);
  const [descKeyword, setDescKeyword] = useState("");
  const [vendorKeyword, setVendorKeyword] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState<"" | "Description" | "Vendor">("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/search")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.years) && d.years.length) {
          setYears(d.years);
          setYear(d.years.includes(2014) ? 2014 : d.years[0]);
        }
      })
      .catch(() => setError("Could not load the list of years."));
  }, []);

  async function search(field: "Description" | "Vendor", keyword: string) {
    if (!keyword.trim() || loading) return;
    setLoading(field);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, keyword, year }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Search failed.");
      else setResult(data);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading("");
    }
  }

  return (
    <>
      <h2>Prohibited-purchase dashboard</h2>
      <p className="hint">
        Search transactions for evidence of purchases that OSU&rsquo;s P-Card procedure prohibits.
      </p>

      <div className="instructions">
        <strong>How to use this dashboard</strong>
        <ol>
          <li>Pick the calendar year you are auditing.</li>
          <li>
            Use <em>Description search</em> to search the line-item description field &mdash; best for what was bought
            (e.g. <code>GIFT CARD</code>, <code>MEMBERSHIP</code>). Note that roughly two-thirds of records carry the
            generic description &ldquo;GENERAL PURCHASE&rdquo;, so also run a vendor search.
          </li>
          <li>
            Use <em>Vendor search</em> to search the merchant name &mdash; best for who was paid (e.g. <code>USPS</code>,
            <code> LIQUOR</code>).
          </li>
          <li>
            Click a suggested keyword below to run a common test, or type your own. Matching is case-insensitive and
            partial.
          </li>
          <li>
            Results are sorted largest amount first and show everything needed for follow-up. A hit is a{" "}
            <strong>risk indicator only</strong> &mdash; confirm against the receipt and business purpose before
            concluding a violation occurred.
          </li>
        </ol>
      </div>

      <div style={{ marginBottom: 20, maxWidth: 200 }}>
        <label htmlFor="year">Audit year</label>
        <select id="year" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: "100%" }}>
          {years.length === 0 && <option value={2014}>2014</option>}
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gap: 22, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <section>
          <h3>Description search</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search("Description", descKeyword);
            }}
          >
            <div className="grow">
              <label htmlFor="desc">Keyword in transaction description</label>
              <input
                id="desc"
                type="text"
                value={descKeyword}
                placeholder="e.g. GIFT CARD"
                style={{ width: "100%" }}
                onChange={(e) => setDescKeyword(e.target.value)}
              />
            </div>
            <button className="primary" type="submit" disabled={!!loading || !descKeyword.trim()}>
              {loading === "Description" ? "Searching…" : "Search"}
            </button>
          </form>
        </section>

        <section>
          <h3>Vendor search</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search("Vendor", vendorKeyword);
            }}
          >
            <div className="grow">
              <label htmlFor="vend">Keyword in vendor name</label>
              <input
                id="vend"
                type="text"
                value={vendorKeyword}
                placeholder="e.g. USPS"
                style={{ width: "100%" }}
                onChange={(e) => setVendorKeyword(e.target.value)}
              />
            </div>
            <button className="primary" type="submit" disabled={!!loading || !vendorKeyword.trim()}>
              {loading === "Vendor" ? "Searching…" : "Search"}
            </button>
          </form>
        </section>
      </div>

      <div style={{ marginTop: 26 }}>
        <h3>Suggested tests by prohibited category</h3>
        {SUGGESTED.map((s) => (
          <div key={s.category} style={{ marginBottom: 9, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 190 }}>{s.category}</span>
            {s.description.map((k) => (
              <button
                key={`d-${k}`}
                className="chip"
                type="button"
                title={`Search descriptions for "${k}"`}
                onClick={() => {
                  setDescKeyword(k);
                  search("Description", k);
                }}
              >
                desc: {k}
              </button>
            ))}
            {s.vendor.map((k) => (
              <button
                key={`v-${k}`}
                className="chip"
                type="button"
                title={`Search vendors for "${k}"`}
                onClick={() => {
                  setVendorKeyword(k);
                  search("Vendor", k);
                }}
              >
                vendor: {k}
              </button>
            ))}
          </div>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="result">
          <div className="summary-bar">
            <div>
              Matches
              <strong>{result.rowCount}{result.truncated ? "+" : ""}</strong>
            </div>
            <div>
              Total value
              <strong>{money(result.total)}</strong>
            </div>
            <div>
              Search
              <strong>
                {result.field === "Vendor" ? "Vendor" : "Description"} &ldquo;{result.keyword}&rdquo;
              </strong>
            </div>
            <div>
              Year
              <strong>{result.year}</strong>
            </div>
          </div>

          {result.rows.length === 0 ? (
            <div className="empty">
              No {result.year} transactions matched &ldquo;{result.keyword}&rdquo; in the{" "}
              {result.field === "Vendor" ? "vendor" : "description"} field.
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {COLUMNS.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i}>
                        {COLUMNS.map((c) => (
                          <td key={c} className={c === "Amount" ? "num" : ""}>
                            {c === "Amount" ? money(row[c]) : (row[c] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.truncated && (
                <div className="note">
                  Showing the first 500 matches. Narrow the keyword to see the full population.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
