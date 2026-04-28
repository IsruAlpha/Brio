import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { QueryType } from "@/app/lib/types";
import { buildPrompt } from "@/app/config/prompts";
const GROQ_MODELS = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"];
const GROQ_API_BASE = "https://api.groq.com/openai/v1/chat/completions";
const PER_MODEL_TIMEOUT_MS = 8_000;

type GroqGenerateResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function extractJsonArray(raw: string): unknown {
  const cleaned = raw.replace(/```[a-z]*|```/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function parseNamesFromText(raw: string): string[] {
  const parsed = extractJsonArray(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((name): name is string => typeof name === "string");
}

function readEnvKeyFromFile(envPath: string, keyName: string): string {
  try {
    const envText = fs.readFileSync(envPath, "utf8");
    const match = envText.match(new RegExp(`^\\s*${keyName}\\s*=\\s*(.+)\\s*$`, "m"));
    return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
  } catch {
    return "";
  }
}

function listCandidateProjectDirs(root: string): string[] {
  const dirs = [root];

  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = path.join(root, entry.name);
      dirs.push(child);

      try {
        for (const nested of fs.readdirSync(child, { withFileTypes: true })) {
          if (nested.isDirectory()) {
            dirs.push(path.join(child, nested.name));
          }
        }
      } catch {
        // Ignore unreadable child dirs.
      }
    }
  } catch {
    // Ignore unreadable roots.
  }

  return dirs;
}

function readEnvKeyFromProjectFiles(keyName: string): string {
  const candidates = listCandidateProjectDirs(process.cwd()).flatMap((dir) => [
    path.join(dir, ".env.local"),
    path.join(dir, ".env"),
  ]);

  for (const candidate of candidates) {
    const key = readEnvKeyFromFile(candidate, keyName);
    if (key) return key;
  }

  return "";
}

function getGroqApiKey(): string {
  return process.env.GROQ_API_KEY || process.env["GROQ_API_KEY"] || readEnvKeyFromProjectFiles("GROQ_API_KEY");
}

async function callGroqModel(
  prompt: string,
  model: string,
  apiKey: string,
  timeoutMs: number = PER_MODEL_TIMEOUT_MS,
): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(GROQ_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 1,
        messages: [
          {
            role: "system",
            content: "Return only a JSON array of lowercase strings.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      cache: "no-store",
    });

    const data = (await res.json().catch(() => ({}))) as GroqGenerateResponse;
    if (!res.ok) {
      throw new Error(data.error?.message ?? `Groq ${model} request failed (${res.status})`);
    }

    return parseNamesFromText(data.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(timer);
  }
}

export async function generateNames(
  input: string,
  type: QueryType,
  exclude: string[],
): Promise<string[]> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY. Add it to .env.local and restart the dev server.");
  }

  const prompt = buildPrompt(input, type, exclude);

  let lastErr: unknown = null;
  for (const model of GROQ_MODELS) {
    try {
      const names = await callGroqModel(prompt, model, apiKey);
      if (names.length > 0) return names;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  return [];
}
