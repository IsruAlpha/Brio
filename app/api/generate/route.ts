import { NextResponse } from "next/server";
import { generateNames } from "@/app/lib/gemini";
import type { QueryType } from "@/app/lib/types";

export const runtime = "nodejs";

type Body = {
  input?: string;
  type?: QueryType;
  exclude?: string[];
};

function isQueryType(value: unknown): value is QueryType {
  return value === "idea" || value === "competitor" || value === "seed";
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  const type = isQueryType(body.type) ? body.type : null;
  const exclude = Array.isArray(body.exclude)
    ? body.exclude.filter((name): name is string => typeof name === "string" && name.length > 0)
    : [];

  if (!input) {
    return NextResponse.json({ error: "Missing input" }, { status: 400 });
  }

  if (!type) {
    return NextResponse.json({ error: "Invalid query type" }, { status: 400 });
  }

  try {
    const names = await generateNames(input, type, exclude);
    return NextResponse.json({ names });
  } catch (err) {
    console.error("[generate] route failed:", err);
    const message = err instanceof Error ? err.message : "Name generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
