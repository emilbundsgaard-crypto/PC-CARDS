import { NextResponse } from "next/server";
import { getDb, availableYears, MAX_ROWS } from "@/lib/db";

export const runtime = "nodejs";

/** Year options for the dashboard's selector. */
export async function GET() {
  try {
    return NextResponse.json({ years: availableYears() });
  } catch (err) {
    console.error("years lookup failed:", err);
    return NextResponse.json({ error: "Could not read the database." }, { status: 500 });
  }
}

type SearchBody = { field?: unknown; keyword?: unknown; year?: unknown };

export async function POST(req: Request) {
  let body: SearchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const field = body.field === "Vendor" ? "Vendor" : "Description";
  const keyword = String(body.keyword ?? "").trim();
  const year = Number(body.year);

  if (!keyword) {
    return NextResponse.json({ error: "Enter a keyword to search for." }, { status: 400 });
  }
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: "Select a year." }, { status: 400 });
  }

  // The keyword is bound as a parameter, so it is never concatenated into SQL.
  // `field` is restricted to one of two literals above, so interpolating it is safe.
  const sql = `
    SELECT TransactionDate, PostedDate, FullName, Amount, Vendor, Description, MCC
    FROM   pcards
    WHERE  Year = ?
      AND  ${field} LIKE ?
    ORDER  BY Amount DESC
    LIMIT  ${MAX_ROWS + 1}
  `;

  try {
    const all = getDb().prepare(sql).all(year, `%${keyword}%`) as Record<string, unknown>[];
    const truncated = all.length > MAX_ROWS;
    const rows = truncated ? all.slice(0, MAX_ROWS) : all;

    const total = rows.reduce((sum, r) => sum + Number(r.Amount ?? 0), 0);

    return NextResponse.json({
      rows,
      rowCount: rows.length,
      truncated,
      total: Math.round(total * 100) / 100,
      field,
      keyword,
      year,
    });
  } catch (err) {
    console.error("search failed:", err);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
