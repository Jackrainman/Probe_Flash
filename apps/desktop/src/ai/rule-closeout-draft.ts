import type { InvestigationRecord } from "../domain/schemas/investigation-record.ts";
import type { IssueCard } from "../domain/schemas/issue-card.ts";
import {
  PolishCloseoutOutputSchema,
  SuggestPreventionOutputSchema,
  SummarizeRecordsOutputSchema,
} from "./prompt-templates.ts";

export interface RuleCloseoutDraft {
  problemSummary: string;
  category: string;
  rootCause: string;
  resolution: string;
  prevention: string;
  keySignals: string[];
  checklistItems: string[];
  caveats: string[];
  confidence: "low" | "medium" | "high";
}

function textFromRecord(record: InvestigationRecord): string {
  return (record.polishedText || record.rawText || "").trim();
}

function sortRecords(records: InvestigationRecord[]): InvestigationRecord[] {
  return [...records].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function findLatestRecord(records: InvestigationRecord[], types: InvestigationRecord["type"][]): string | null {
  for (const record of [...records].reverse()) {
    if (!types.includes(record.type)) continue;
    const text = textFromRecord(record);
    if (text) return text;
  }
  return null;
}

function categoryFromIssue(issue: IssueCard): string {
  return firstNonEmpty(issue.tags[0], issue.severity, "uncategorized") ?? "uncategorized";
}

function confidenceFromRecords(records: InvestigationRecord[]): "low" | "medium" | "high" {
  if (records.some((record) => record.type === "conclusion")) return "high";
  if (records.some((record) => record.type === "result")) return "medium";
  return "low";
}

export function buildRuleCloseoutDraft(issue: IssueCard, records: InvestigationRecord[]): RuleCloseoutDraft {
  const sortedRecords = sortRecords(records);
  const summary = firstNonEmpty(
    issue.symptomSummary,
    issue.normalizedSummary,
    issue.rawInput,
    issue.title,
  ) ?? "当前问题描述为空，请先补充问题现象。";
  const keySignals = uniqueNonEmpty([
    ...sortedRecords.map(textFromRecord),
    ...issue.suspectedDirections.map((direction) => `可疑方向：${direction}`),
  ]).slice(0, 4);
  const rootCauseSeed = firstNonEmpty(
    findLatestRecord(sortedRecords, ["conclusion", "result"]),
    issue.suspectedDirections[0],
  );
  const resolutionSeed = firstNonEmpty(
    findLatestRecord(sortedRecords, ["conclusion", "result", "action"]),
    issue.suggestedActions[0],
  );
  const category = categoryFromIssue(issue);
  const confidence = confidenceFromRecords(sortedRecords);
  const caveats = ["规则草稿，需人工确认后才能结案写库"];

  const polishOutput = PolishCloseoutOutputSchema.parse({
    task: "polish_closeout",
    draftOnly: true,
    confidence,
    category,
    rootCause: rootCauseSeed
      ? `规则草稿：${rootCauseSeed}`
      : `规则草稿：${summary} 的根因尚未完全确认，请补充确认依据。`,
    resolution: resolutionSeed
      ? `规则草稿：${resolutionSeed}`
      : "规则草稿：请补充实际修复动作、绕过方案或结案依据。",
    prevention: "规则草稿：把本次定位方法和修复验证点加入后续调试检查清单，避免同类问题重复排查。",
    caveats,
  });
  const summaryOutput = SummarizeRecordsOutputSchema.parse({
    task: "summarize_records",
    draftOnly: true,
    confidence,
    summary,
    keySignals: keySignals.length > 0 ? keySignals : [summary],
    unresolvedQuestions: rootCauseSeed ? [] : ["根因仍需人工补充确认依据"],
    caveats,
  });
  const checklistItems = uniqueNonEmpty([
    `复盘问题：${issue.title}`,
    resolutionSeed ? `验证修复：${resolutionSeed}` : "补充修复验证记录后再结案",
    issue.relatedFiles[0] ? `检查相关文件：${issue.relatedFiles[0]}` : "记录相关文件或硬件位置",
  ]);
  const preventionOutput = SuggestPreventionOutputSchema.parse({
    task: "suggest_prevention",
    draftOnly: true,
    confidence,
    prevention: polishOutput.prevention,
    checklistItems,
    riskLevel: issue.severity,
    caveats,
  });

  return {
    problemSummary: summaryOutput.summary,
    category: polishOutput.category,
    rootCause: polishOutput.rootCause,
    resolution: polishOutput.resolution,
    prevention: preventionOutput.prevention,
    keySignals: summaryOutput.keySignals,
    checklistItems: preventionOutput.checklistItems,
    caveats: preventionOutput.caveats,
    confidence: polishOutput.confidence,
  };
}
