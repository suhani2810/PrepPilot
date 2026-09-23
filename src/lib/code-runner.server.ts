type SupportedLanguage = "javascript" | "python" | "c" | "cpp" | "csharp";

type HiddenTest = {
  input: Record<string, unknown>;
  expected: unknown;
};

export type CodeRunnerResult = {
  status:
    "accepted" | "wrong_answer" | "compile_error" | "runtime_error" | "timeout" | "runner_error";
  passedTests: number;
  totalTests: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  stdout: string;
  stderr: string;
  results: Array<{ test: number; passed: boolean; error?: string }>;
};

const PUBLIC_PISTON_URL = "https://emkc.org/api/v2/piston/execute";

const PISTON_LANGUAGES: Record<SupportedLanguage, { language: string; version: string }> = {
  javascript: { language: "javascript", version: "18.15.0" },
  python: { language: "python", version: "3.10.0" },
  c: { language: "c", version: "10.2.0" },
  cpp: { language: "c++", version: "10.2.0" },
  csharp: { language: "csharp", version: "6.12.0" },
};

const SOURCE_FILENAMES: Record<SupportedLanguage, string> = {
  javascript: "main.js",
  python: "main.py",
  c: "main.c",
  cpp: "main.cpp",
  csharp: "main.cs",
};

function normalizeTests(value: unknown): HiddenTest[] {
  if (!Array.isArray(value)) throw new Error("Coding problem has no hidden tests");
  const tests = value.filter(
    (test): test is HiddenTest =>
      Boolean(test) &&
      typeof test === "object" &&
      "input" in test &&
      Boolean(test.input) &&
      typeof test.input === "object" &&
      "expected" in test,
  );
  if (!tests.length) throw new Error("Coding problem has no valid hidden tests");
  return tests.slice(0, 50);
}

function jsonString(value: unknown): string {
  return JSON.stringify(value);
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value) || value.some((item) => !Number.isSafeInteger(item))) {
    throw new Error("Invalid numeric-array test input");
  }
  return value as number[];
}

function integer(value: unknown): number {
  if (!Number.isSafeInteger(value)) throw new Error("Invalid integer test input");
  return Number(value);
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid string test input");
  return value;
}

function javascriptHarness(slug: string, sourceCode: string, tests: HiddenTest[], marker: string) {
  const calls: Record<string, string> = {
    "two-sum": "twoSum(test.input.nums, test.input.target)",
    "valid-parentheses": "isValid(test.input.s)",
    "binary-search": "search(test.input.nums, test.input.target)",
  };
  const call = calls[slug];
  if (!call) throw new Error("This problem does not have a JavaScript test harness");
  return `${sourceCode}

const __tests = ${jsonString(tests)};
const __results = [];
let __passed = 0;
for (let __index = 0; __index < __tests.length; __index += 1) {
  const test = __tests[__index];
  try {
    const actual = ${call};
    const passed = JSON.stringify(actual) === JSON.stringify(test.expected);
    if (passed) __passed += 1;
    __results.push({ test: __index + 1, passed });
  } catch (error) {
    __results.push({ test: __index + 1, passed: false, error: String(error?.message ?? error).slice(0, 300) });
  }
}
console.log(${jsonString(marker)} + JSON.stringify({ passedTests: __passed, totalTests: __tests.length, results: __results }));
`;
}

function pythonHarness(slug: string, sourceCode: string, tests: HiddenTest[], marker: string) {
  const calls: Record<string, string> = {
    "two-sum": "two_sum(test['input']['nums'], test['input']['target'])",
    "valid-parentheses": "is_valid(test['input']['s'])",
    "binary-search": "search(test['input']['nums'], test['input']['target'])",
  };
  const call = calls[slug];
  if (!call) throw new Error("This problem does not have a Python test harness");
  return `${sourceCode}

import json as __json
__tests = __json.loads(${jsonString(JSON.stringify(tests))})
__results = []
__passed = 0
for __index, test in enumerate(__tests):
    try:
        actual = ${call}
        passed = actual == test['expected']
        if passed:
            __passed += 1
        __results.append({'test': __index + 1, 'passed': passed})
    except Exception as error:
        __results.append({'test': __index + 1, 'passed': False, 'error': str(error)[:300]})
print(${jsonString(marker)} + __json.dumps({'passedTests': __passed, 'totalTests': len(__tests), 'results': __results}))
`;
}

function cTestExpression(slug: string, test: HiddenTest, index: number): string {
  if (slug === "two-sum") {
    const nums = numberArray(test.input.nums);
    const expected = numberArray(test.expected);
    if (expected.length !== 2) throw new Error("Two Sum expects a pair of indices");
    return `int nums_${index}[] = {${nums.join(",")}};
    int size_${index} = 0;
    int* answer_${index} = two_sum(nums_${index}, ${nums.length}, ${integer(test.input.target)}, &size_${index});
    bool ok_${index} = answer_${index} != NULL && size_${index} == 2 && answer_${index}[0] == ${expected[0]} && answer_${index}[1] == ${expected[1]};
    free(answer_${index});`;
  }
  if (slug === "valid-parentheses") {
    return `bool ok_${index} = is_valid(${jsonString(text(test.input.s))}) == ${test.expected === true ? "true" : "false"};`;
  }
  if (slug === "binary-search") {
    const nums = numberArray(test.input.nums);
    return `int nums_${index}[] = {${nums.join(",")}};
    bool ok_${index} = search(nums_${index}, ${nums.length}, ${integer(test.input.target)}) == ${integer(test.expected)};`;
  }
  throw new Error("This problem does not have a C test harness");
}

function cHarness(slug: string, sourceCode: string, tests: HiddenTest[], marker: string) {
  const cases = tests
    .map(
      (test, index) => `${cTestExpression(slug, test, index)}
    if (ok_${index}) passed += 1;`,
    )
    .join("\n    ");
  return `#include <stdio.h>
#include <stdbool.h>
#include <stdlib.h>
${sourceCode}

int main(void) {
    int passed = 0;
    ${cases}
    printf(${jsonString(`${marker}{"passedTests":%d,"totalTests":${tests.length},"results":[]}`)}, passed);
    return 0;
}
`;
}

function cppTestExpression(slug: string, test: HiddenTest, index: number): string {
  if (slug === "two-sum") {
    const nums = numberArray(test.input.nums);
    const expected = numberArray(test.expected);
    return `vector<int> nums_${index}{${nums.join(",")}};
    vector<int> expected_${index}{${expected.join(",")}};
    bool ok_${index} = twoSum(nums_${index}, ${integer(test.input.target)}) == expected_${index};`;
  }
  if (slug === "valid-parentheses") {
    return `bool ok_${index} = isValid(${jsonString(text(test.input.s))}) == ${test.expected === true ? "true" : "false"};`;
  }
  if (slug === "binary-search") {
    const nums = numberArray(test.input.nums);
    return `vector<int> nums_${index}{${nums.join(",")}};
    bool ok_${index} = search(nums_${index}, ${integer(test.input.target)}) == ${integer(test.expected)};`;
  }
  throw new Error("This problem does not have a C++ test harness");
}

function cppHarness(slug: string, sourceCode: string, tests: HiddenTest[], marker: string) {
  const cases = tests
    .map(
      (test, index) => `${cppTestExpression(slug, test, index)}
    if (ok_${index}) passed += 1;`,
    )
    .join("\n    ");
  return `#include <iostream>
#include <vector>
#include <string>
using namespace std;
${sourceCode}

int main() {
    int passed = 0;
    ${cases}
    cout << ${jsonString(`${marker}{"passedTests":`)} << passed << ${jsonString(`,"totalTests":${tests.length},"results":[]}`)};
    return 0;
}
`;
}

function csharpTestExpression(slug: string, test: HiddenTest, index: number): string {
  if (slug === "two-sum") {
    const nums = numberArray(test.input.nums);
    const expected = numberArray(test.expected);
    return `var answer${index} = solution.TwoSum(new int[] { ${nums.join(",")} }, ${integer(test.input.target)});
        bool ok${index} = answer${index} != null && answer${index}.Length == 2 && answer${index}[0] == ${expected[0]} && answer${index}[1] == ${expected[1]};`;
  }
  if (slug === "valid-parentheses") {
    return `bool ok${index} = solution.IsValid(${jsonString(text(test.input.s))}) == ${test.expected === true ? "true" : "false"};`;
  }
  if (slug === "binary-search") {
    const nums = numberArray(test.input.nums);
    return `bool ok${index} = solution.Search(new int[] { ${nums.join(",")} }, ${integer(test.input.target)}) == ${integer(test.expected)};`;
  }
  throw new Error("This problem does not have a C# test harness");
}

function csharpHarness(slug: string, sourceCode: string, tests: HiddenTest[], marker: string) {
  const cases = tests
    .map(
      (test, index) => `${csharpTestExpression(slug, test, index)}
        if (ok${index}) passed += 1;`,
    )
    .join("\n        ");
  return `${sourceCode}

public static class PrepPilotHarness {
    public static void Main() {
        var solution = new Solution();
        int passed = 0;
        ${cases}
        System.Console.Write(${jsonString(`${marker}{"passedTests":`)} + passed + ${jsonString(`,"totalTests":${tests.length},"results":[]}`)});
    }
}
`;
}

export function buildPistonProgram(options: {
  slug: string;
  language: SupportedLanguage;
  sourceCode: string;
  hiddenTests: unknown;
  marker: string;
}): string {
  const tests = normalizeTests(options.hiddenTests);
  const args = [options.slug, options.sourceCode, tests, options.marker] as const;
  if (options.language === "javascript") return javascriptHarness(...args);
  if (options.language === "python") return pythonHarness(...args);
  if (options.language === "c") return cHarness(...args);
  if (options.language === "cpp") return cppHarness(...args);
  return csharpHarness(...args);
}

function clipped(value: unknown): string {
  return String(value ?? "").slice(0, 4_000);
}

export async function runWithPiston(options: {
  slug: string;
  language: SupportedLanguage;
  sourceCode: string;
  hiddenTests: unknown;
  signal: AbortSignal;
}): Promise<CodeRunnerResult> {
  const marker = `__PREPPILOT_${crypto.randomUUID().replaceAll("-", "")}__`;
  const program = buildPistonProgram({ ...options, marker });
  const runtime = PISTON_LANGUAGES[options.language];
  const runnerUrl = process.env.CODE_RUNNER_URL?.trim() || PUBLIC_PISTON_URL;
  const response = await fetch(runnerUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...runtime,
      files: [{ name: SOURCE_FILENAMES[options.language], content: program }],
      compile_timeout: 10_000,
      run_timeout: 3_000,
      compile_memory_limit: 256 * 1024 * 1024,
      run_memory_limit: 128 * 1024 * 1024,
    }),
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`Piston returned HTTP ${response.status}`);
  const payload = (await response.json()) as {
    compile?: { code?: number; stdout?: string; stderr?: string; output?: string };
    run?: {
      code?: number;
      signal?: string | null;
      stdout?: string;
      stderr?: string;
      output?: string;
    };
  };
  if (payload.compile && payload.compile.code !== 0) {
    return {
      status: "compile_error",
      passedTests: 0,
      totalTests: normalizeTests(options.hiddenTests).length,
      runtimeMs: null,
      memoryKb: null,
      stdout: clipped(payload.compile.stdout),
      stderr: clipped(payload.compile.stderr || payload.compile.output),
      results: [],
    };
  }
  const stdout = clipped(payload.run?.stdout);
  const markerIndex = stdout.lastIndexOf(marker);
  if (markerIndex < 0) {
    const timedOut = Boolean(payload.run?.signal?.toLowerCase().includes("kill"));
    return {
      status: timedOut ? "timeout" : "runtime_error",
      passedTests: 0,
      totalTests: normalizeTests(options.hiddenTests).length,
      runtimeMs: null,
      memoryKb: null,
      stdout,
      stderr: clipped(payload.run?.stderr || payload.run?.output),
      results: [],
    };
  }
  const resultText = stdout.slice(markerIndex + marker.length).split(/\r?\n/, 1)[0];
  const parsed = JSON.parse(resultText) as {
    passedTests?: number;
    totalTests?: number;
    results?: Array<{ test: number; passed: boolean; error?: string }>;
  };
  const totalTests = Math.max(0, Number(parsed.totalTests ?? 0));
  const passedTests = Math.min(totalTests, Math.max(0, Number(parsed.passedTests ?? 0)));
  return {
    status: totalTests > 0 && passedTests === totalTests ? "accepted" : "wrong_answer",
    passedTests,
    totalTests,
    runtimeMs: null,
    memoryKb: null,
    stdout: stdout.slice(0, markerIndex).slice(0, 4_000),
    stderr: clipped(payload.run?.stderr),
    results: Array.isArray(parsed.results) ? parsed.results.slice(0, 50) : [],
  };
}
