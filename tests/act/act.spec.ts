/**
 * Casos de teste oficiais das regras ACT do W3C (seção 7.2).
 *
 * - caso `failed`  → a extensão deve marcar violação por uma regra mapeada;
 * - caso `passed` ou `inapplicable` → nenhuma violação das regras mapeadas.
 *
 * Falso positivo (violação em caso passed/inapplicable) sempre falha o teste.
 * Falso negativo só é aceito se estiver em `known-false-negatives.json`, com
 * justificativa. O relatório por regra é gravado em `reports/act-report.{json,md}`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULE_META } from '../../src/rules/catalog';
import { BASE_URL, expect, tabIdOf, test, waitForIdle } from '../e2e-support/extension';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

interface ActCase {
  ruleId: string;
  ruleName: string;
  testcaseId: string;
  testcaseTitle: string;
  expected: 'passed' | 'failed' | 'inapplicable';
  relativePath: string;
  approved?: boolean;
}

interface KnownFalseNegative {
  testcaseId: string;
  ruleId: string;
  reason: string;
}

const { testcases } = JSON.parse(
  readFileSync(resolve(here, 'testcases.json'), 'utf8'),
) as {
  testcases: ActCase[];
};
const known = new Map(
  (
    JSON.parse(
      readFileSync(resolve(here, 'known-false-negatives.json'), 'utf8'),
    ) as KnownFalseNegative[]
  ).map((k) => [k.testcaseId, k]),
);

/** Regras da extensão mapeadas para cada regra ACT. */
function mappedRules(actId: string): Set<string> {
  return new Set(RULE_META.filter((r) => r.actRuleIds.includes(actId)).map((r) => r.id));
}

type Verdict = 'ok' | 'false-positive' | 'false-negative' | 'known-false-negative';
interface CaseResult {
  ruleId: string;
  ruleName: string;
  testcaseId: string;
  title: string;
  expected: string;
  approved: boolean;
  flagged: boolean;
  verdict: Verdict;
  details: string;
}

/**
 * Um arquivo por caso: workers reiniciados após falhas não perdem resultados.
 * O nome inclui a regra porque o W3C reusa o mesmo testcaseId em regras diferentes.
 */
const CASES_DIR = resolve(root, 'test-results/act-cases');

function record(r: CaseResult): void {
  mkdirSync(CASES_DIR, { recursive: true });
  writeFileSync(resolve(CASES_DIR, `${r.ruleId}-${r.testcaseId}.json`), JSON.stringify(r));
}

function allResults(): CaseResult[] {
  if (!existsSync(CASES_DIR)) return [];
  return readdirSync(CASES_DIR).map(
    (f) => JSON.parse(readFileSync(resolve(CASES_DIR, f), 'utf8')) as CaseResult,
  );
}

test.afterAll(() => {
  const results = allResults();
  if (results.length === 0) return;
  const byRule = new Map<string, CaseResult[]>();
  for (const r of results) byRule.set(r.ruleId, [...(byRule.get(r.ruleId) ?? []), r]);
  const rows = [...byRule.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ruleId, list]) => ({
      ruleId,
      ruleName: list[0]?.ruleName ?? '',
      total: list.length,
      correct: list.filter((r) => r.verdict === 'ok').length,
      falsePositives: list.filter((r) => r.verdict === 'false-positive').length,
      knownFalseNegatives: list.filter((r) => r.verdict === 'known-false-negative')
        .length,
      falseNegatives: list.filter((r) => r.verdict === 'false-negative').length,
    }));
  mkdirSync(resolve(root, 'reports'), { recursive: true });
  writeFileSync(
    resolve(root, 'reports/act-report.json'),
    `${JSON.stringify({ rows, cases: results }, null, 2)}\n`,
  );
  const md = [
    '# Relatório ACT',
    '',
    '| Regra ACT | Nome | Acertos / total | Falsos positivos | Falsos negativos conhecidos | Falsos negativos novos |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.ruleId} | ${r.ruleName} | ${r.correct} / ${r.total} | ${r.falsePositives} | ${r.knownFalseNegatives} | ${r.falseNegatives} |`,
    ),
    '',
    '## Casos não acertados',
    '',
    ...results
      .filter((r) => r.verdict !== 'ok')
      .map(
        (r) =>
          `- **${r.ruleId}** ${r.title} (${r.expected}, ${r.approved ? 'aprovado' : 'proposto'}): ${r.verdict} — ${r.details}`,
      ),
    '',
  ].join('\n');
  writeFileSync(resolve(root, 'reports/act-report.md'), md);
});

for (const c of testcases) {
  const short = c.testcaseId.slice(0, 8);
  test(`${c.ruleId} ${c.expected} — ${c.testcaseTitle} [${short}]`, async ({ ext }) => {
    const page = await ext.context.newPage();
    try {
      await page.goto(`${BASE_URL}/WAI/content-assets/wcag-act-rules/${c.relativePath}`, {
        waitUntil: 'load',
      });
      const tabId = await tabIdOf(ext, page);
      const state = await waitForIdle(ext, tabId);
      const rules = mappedRules(c.ruleId);
      const violations = (state?.occurrences ?? []).filter((o) =>
        o.rules.some((r) => r.outcome === 'violation' && rules.has(r.ruleId)),
      );
      const flagged = violations.length > 0;
      const details = violations
        .map((v) => `${v.wcag} ${v.rules.map((r) => r.ruleId).join('|')} @ ${v.selector}`)
        .join('; ');
      let verdict: Verdict = 'ok';
      if (c.expected === 'failed' && !flagged) {
        verdict = known.has(c.testcaseId) ? 'known-false-negative' : 'false-negative';
      } else if (c.expected !== 'failed' && flagged) {
        verdict = 'false-positive';
      }
      record({
        ruleId: c.ruleId,
        ruleName: c.ruleName,
        testcaseId: c.testcaseId,
        title: c.testcaseTitle,
        expected: c.expected,
        approved: c.approved !== false,
        flagged,
        verdict,
        details:
          verdict === 'known-false-negative'
            ? (known.get(c.testcaseId)?.reason ?? '')
            : details || (state ? 'sem violação' : 'sem content script'),
      });
      if (verdict === 'known-false-negative') {
        test.info().annotations.push({
          type: 'falso negativo conhecido',
          description: known.get(c.testcaseId)?.reason ?? '',
        });
      }
      expect(verdict === 'false-positive', `falso positivo: ${details}`).toBe(false);
      expect(
        verdict === 'false-negative',
        'falso negativo não documentado em known-false-negatives.json',
      ).toBe(false);
    } finally {
      await page.close();
    }
  });
}
