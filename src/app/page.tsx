"use client";

import { useState } from "react";
import AskTab from "./AskTab";
import DashboardTab from "./DashboardTab";

export default function Home() {
  const [tab, setTab] = useState<"ask" | "dashboard">("ask");

  return (
    <main className="wrap">
      <header>
        <h1>OSU P-Card Audit Tool</h1>
        <p>Internal audit review of Oklahoma State University purchasing-card transactions, 2010&ndash;2014.</p>
      </header>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          className="tab"
          aria-selected={tab === "ask"}
          onClick={() => setTab("ask")}
        >
          Ask a question
        </button>
        <button
          role="tab"
          className="tab"
          aria-selected={tab === "dashboard"}
          onClick={() => setTab("dashboard")}
        >
          Prohibited-purchase dashboard
        </button>
      </div>

      <div className="panel">{tab === "ask" ? <AskTab /> : <DashboardTab />}</div>
    </main>
  );
}
