import {
  GoogleGenAI,
  ApiError,
  ThinkingLevel,
  Type,
  type Content,
  type FunctionDeclaration,
} from "@google/genai";
import { NextResponse } from "next/server";
import { runSelect, UnsafeQueryError } from "@/lib/db";
import { SCHEMA_PROMPT } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

// Google retires older models for new API keys, so this default moves over time.
// If it 404s, the error tells you which model to use instead — set GEMINI_MODEL
// in .env.local rather than editing this file.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const MAX_TURNS = 8;

const RUN_SQL: FunctionDeclaration = {
  name: "run_sql",
  description:
    "Execute a read-only SQLite SELECT query against the pcards table and return the rows. " +
    "Call this whenever answering the question depends on data you have not already retrieved. " +
    "Only a single SELECT or WITH statement is permitted; the connection is read-only. " +
    "Results are capped at 500 rows, so aggregate rather than dumping raw rows.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      sql: {
        type: Type.STRING,
        description: "A single read-only SQLite SELECT (or WITH ... SELECT) statement.",
      },
    },
    required: ["sql"],
  },
};

/** One step of the transcript, returned so the UI can show the work. */
type Step =
  | { kind: "sql"; sql: string; columns: string[]; rows: unknown[][]; rowCount: number; truncated: boolean }
  | { kind: "sql_error"; sql: string; error: string };

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey, " +
          "copy .env.local.example to .env.local, paste the key in, and restart the dev server.",
      },
      { status: 503 },
    );
  }

  let question: string;
  try {
    const body = await req.json();
    question = String(body.question ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "Please enter a question." }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: "Question is too long (2000 character maximum)." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });
  const contents: Content[] = [{ role: "user", parts: [{ text: question }] }];
  const steps: Step[] = [];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SCHEMA_PROMPT,
          tools: [{ functionDeclarations: [RUN_SQL] }],
          temperature: 0,
          maxOutputTokens: 8000,
          // Gemini 3 thinks hard by default, which pushed round trips past 90s.
          // The schema prompt already spells out the query rules, and a wrong
          // query self-corrects on the next tool turn, so deep reasoning buys
          // little here. LOW keeps answers accurate at a usable speed.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const calls = response.functionCalls ?? [];

      if (calls.length === 0) {
        const answer = (response.text ?? "").trim();
        return NextResponse.json({
          answer: answer || "I wasn't able to produce an answer for that question.",
          steps,
        });
      }

      // Echo the model's turn back verbatim so the function calls stay paired
      // with their responses.
      const modelParts = response.candidates?.[0]?.content?.parts;
      contents.push({ role: "model", parts: modelParts ?? calls.map((fc) => ({ functionCall: fc })) });

      const responseParts = calls.map((call) => {
        const sql = String((call.args as { sql?: unknown } | undefined)?.sql ?? "");
        let payload: Record<string, unknown>;

        try {
          const result = runSelect(sql);
          steps.push({ kind: "sql", sql, ...result });
          payload = {
            columns: result.columns,
            rows: result.rows,
            rowCount: result.rowCount,
            truncated: result.truncated,
          };
        } catch (err) {
          const message =
            err instanceof UnsafeQueryError
              ? `Rejected: ${err.message}`
              : `SQL error: ${err instanceof Error ? err.message : String(err)}`;
          steps.push({ kind: "sql_error", sql, error: message });
          payload = { error: message };
        }

        return {
          functionResponse: {
            id: call.id,
            name: call.name ?? RUN_SQL.name,
            response: payload,
          },
        };
      });

      contents.push({ role: "user", parts: responseParts });
    }

    return NextResponse.json({
      answer:
        "I ran out of query steps before reaching an answer. Try narrowing the question — for example, name a specific year, cardholder, vendor or category.",
      steps,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 400 || err.status === 401 || err.status === 403) {
        return NextResponse.json(
          { error: "The Gemini API rejected the key. Check GEMINI_API_KEY in .env.local." },
          { status: 401 },
        );
      }
      if (err.status === 429) {
        return NextResponse.json(
          { error: "Free-tier rate limit reached. Wait a minute and try again." },
          { status: 429 },
        );
      }
      if (err.status === 404) {
        // Google retires models for new keys. The message names the replacement,
        // so surface it with the fix rather than dumping raw JSON at the user.
        const suggested = err.message.match(/models\/([\w.-]+) for the latest/)?.[1];
        return NextResponse.json(
          {
            error:
              `The model "${MODEL}" is not available to your API key.` +
              (suggested ? ` Google suggests "${suggested}".` : "") +
              ` Set GEMINI_MODEL in .env.local to a model your key supports, then reload.`,
          },
          { status: 502 },
        );
      }
      return NextResponse.json({ error: `Gemini API error (${err.status}): ${err.message}` }, { status: 502 });
    }
    console.error("ask route failed:", err);
    return NextResponse.json({ error: "Something went wrong answering that question." }, { status: 500 });
  }
}
