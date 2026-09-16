import {
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export const QUESTION_PROTOCOL_VERSION = 1 as const;
export const QUESTION_ANSWER_PREFIX = "PI_SUBAGENT_ANSWER_V1 ";

const QUESTION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface QuestionRequest {
  version: typeof QUESTION_PROTOCOL_VERSION;
  id: string;
  name: string;
  agent: string;
  question: string;
}

export interface QuestionAnswer {
  version: typeof QUESTION_PROTOCOL_VERSION;
  id: string;
  answer: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function isQuestionId(value: unknown): value is string {
  return typeof value === "string" && QUESTION_ID_PATTERN.test(value);
}

export function createQuestionId(): string {
  return randomUUID();
}

export function questionRequestPath(sessionFile: string): string {
  return `${sessionFile}.ask`;
}

export function questionAcknowledgmentPath(sessionFile: string): string {
  return `${sessionFile}.ask.ack`;
}

export function parseQuestionRequest(value: unknown): QuestionRequest | null {
  if (!isRecord(value) || !hasExactKeys(value, ["version", "id", "name", "agent", "question"])) {
    return null;
  }
  if (
    value.version !== QUESTION_PROTOCOL_VERSION ||
    !isQuestionId(value.id) ||
    typeof value.name !== "string" ||
    value.name.length === 0 ||
    typeof value.agent !== "string" ||
    typeof value.question !== "string" ||
    value.question.length === 0
  ) {
    return null;
  }
  return value as unknown as QuestionRequest;
}

export function readQuestionRequest(path: string): QuestionRequest | null {
  if (!existsSync(path)) return null;
  try {
    return parseQuestionRequest(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

export function encodeQuestionAnswer(id: string, answer: string): string {
  if (!isQuestionId(id)) throw new Error("Invalid question ID");
  return QUESTION_ANSWER_PREFIX + JSON.stringify({
    version: QUESTION_PROTOCOL_VERSION,
    id,
    answer,
  });
}

export type ParsedQuestionAnswer =
  | { private: false }
  | { private: true; answer: QuestionAnswer | null };

export function parseQuestionAnswer(text: string): ParsedQuestionAnswer {
  if (!text.startsWith(QUESTION_ANSWER_PREFIX)) return { private: false };
  let value: unknown;
  try {
    value = JSON.parse(text.slice(QUESTION_ANSWER_PREFIX.length));
  } catch {
    return { private: true, answer: null };
  }
  if (!isRecord(value) || !hasExactKeys(value, ["version", "id", "answer"])) {
    return { private: true, answer: null };
  }
  if (
    value.version !== QUESTION_PROTOCOL_VERSION ||
    !isQuestionId(value.id) ||
    typeof value.answer !== "string"
  ) {
    return { private: true, answer: null };
  }
  return { private: true, answer: value as unknown as QuestionAnswer };
}

export function atomicWriteText(path: string, text: string): void {
  const tempPath = join(dirname(path), `.${randomUUID()}.tmp`);
  try {
    writeFileSync(tempPath, text, "utf8");
    renameSync(tempPath, path);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {}
    throw error;
  }
}

export function writeQuestionRequest(path: string, request: QuestionRequest): void {
  const parsed = parseQuestionRequest(request);
  if (!parsed) throw new Error("Invalid question request");
  atomicWriteText(path, `${JSON.stringify(parsed)}\n`);
}

export function writeQuestionAcknowledgment(path: string, id: string): void {
  if (!isQuestionId(id)) throw new Error("Invalid question ID");
  atomicWriteText(path, `${id}\n`);
}

export function readQuestionAcknowledgment(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    const text = readFileSync(path, "utf8");
    if (!text.endsWith("\n") || text.slice(0, -1).includes("\n")) return null;
    const id = text.slice(0, -1);
    return isQuestionId(id) ? id : null;
  } catch {
    return null;
  }
}

export function removeMatchingQuestionRequest(path: string, id: string): boolean {
  const request = readQuestionRequest(path);
  if (!request || request.id !== id) return false;
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

export function removeMatchingQuestionAcknowledgment(path: string, id: string): boolean {
  if (readQuestionAcknowledgment(path) !== id) return false;
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}
