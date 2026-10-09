import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const catalogURL = new URL('../www/learning-catalog.mjs', import.meta.url);

// Real Python, fresh namespace and temporary working directory for every run.
// This mirrors the app's contract: stdout is captured before checks execute,
// and input values are supplied only to the student program, never the checks.
const harness = String.raw`
import contextlib, io, json, os, sys, tempfile, traceback
request = json.load(sys.stdin)
namespace = {"__name__": "__main__"}
output = io.StringIO()
inputs = request.get("stdin", [])
sys.stdin = io.StringIO("\n".join(inputs) + ("\n" if inputs else ""))
original_directory = os.getcwd()
with tempfile.TemporaryDirectory() as directory:
    os.chdir(directory)
    try:
        with contextlib.redirect_stdout(output):
            exec(compile(request["program"], "<lesson>", "exec"), namespace)
        namespace["__mupad_output"] = output.getvalue()
        exec(compile(request.get("checks", ""), "<checks>", "exec"), namespace)
    except BaseException:
        traceback.print_exc()
        sys.exit(1)
    finally:
        os.chdir(original_directory)
`;

function runPython(program, checks = '', stdin = []) {
  const result = spawnSync(process.env.PYTHON || 'python3', ['-I', '-X', 'utf8', '-c', harness], {
    input: JSON.stringify({ program, checks, stdin }),
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.ifError(result.error);
  return result;
}

function requirePass(result, label) {
  assert.equal(result.status, 0, `${label}\n${result.stderr}`);
}

test('six progressive courses contain 36 original executable, gradeable lessons', async () => {
  const catalog = await import(catalogURL);
  assert.equal(catalog.courses.length, 6);
  const ids = new Set();
  const titles = new Set();
  const explanations = new Set();
  for (const course of catalog.courses) {
    assert.ok(course.id && course.title && course.level && course.description.length >= 70);
    assert.ok(!ids.has(course.id), `duplicate course id: ${course.id}`);
    ids.add(course.id);
    assert.equal(course.lessons.length, 6, course.id);
    for (const lesson of course.lessons) {
      assert.match(lesson.id, /^[a-z][a-z0-9-]+$/);
      assert.ok(!ids.has(lesson.id), `duplicate lesson id: ${lesson.id}`);
      ids.add(lesson.id);
      assert.ok(!titles.has(lesson.title), `duplicate title: ${lesson.title}`);
      titles.add(lesson.title);
      assert.ok(lesson.explanation.length >= 220, `thin explanation: ${lesson.id}`);
      assert.ok(!explanations.has(lesson.explanation), `recycled prose: ${lesson.id}`);
      explanations.add(lesson.explanation);
      const task = lesson.task;
      assert.ok(task.prompt.length >= 100, `unclear task: ${lesson.id}`);
      assert.equal(task.hints.length, 2, lesson.id);
      assert.ok(task.hints.every(hint => hint.length >= 30), lesson.id);
      assert.notEqual(task.hints[0], task.hints[1], lesson.id);
      assert.ok(task.starter.trim() && task.solution.trim() && task.checks.includes('assert '));
      assert.notEqual(task.starter, task.solution, lesson.id);
      if (task.stdin !== undefined) {
        assert.ok(Array.isArray(task.stdin) && task.stdin.every(value => typeof value === 'string'));
      }
      requirePass(runPython(lesson.example), `${lesson.id}: example`);
      requirePass(runPython(task.solution, task.checks, task.stdin), `${lesson.id}: solution/checks`);
      assert.notEqual(runPython(task.starter, task.checks, task.stdin).status, 0,
        `${lesson.id}: unfinished starter incorrectly passes`);
      assert.notEqual(runPython('', task.checks, task.stdin).status, 0,
        `${lesson.id}: empty submission incorrectly passes`);
    }
  }
  assert.deepEqual(catalog.courses.map(course => course.level),
    ['Beginner', 'Beginner', 'Intermediate', 'Intermediate', 'Advanced', 'Advanced']);
});

test('checks reject plausible answers with conceptual or edge-case mistakes', async (t) => {
  const { findLesson } = await import(catalogURL);
  const mistakes = [
    ['hello-output', 'print("Hello, Python!")\nprint("I can write code.")\nprint()'],
    ['typed-input', 'minutes_text = input("Minutes? ")\nminutes = int(minutes_text)\nseconds = minutes * 60\nprint(f"{seconds} seconds")'],
    ['temperature-branches', 'def temperature_label(degrees):\n    return "cold" if degrees <= 10 else "mild" if degrees < 25 else "hot"'],
    ['range-total', 'def sum_to(n):\n    return sum(range(1, n))'],
    ['while-digits', 'def digit_sum(number):\n    return sum(int(digit) for digit in str(number))'],
    ['list-filter', 'def nonnegative(values):\n    return [value for value in values if value > 0]'],
    ['dictionary-stock', 'def restock(stock, item, amount):\n    stock[item] = stock.get(item, 0) + amount\n    return stock'],
    ['safe-defaults', 'def add_guest(name, guests=[]):\n    guests.append(name)\n    return guests'],
    ['word-frequency', 'def word_counts(text):\n    return {word: text.split().count(word) for word in text.split()}'],
    ['tuple-summary', 'def summarize(values):\n    return (sum(values), sum(values) / len(values))'],
    ['recursive-flatten', 'def flatten(items):\n    result = []\n    for item in items:\n        if isinstance(item, (list, tuple)):\n            result.extend(flatten(item))\n        else:\n            result.append(item)\n    return result'],
    ['class-counter', 'class Counter:\n    value = 0\n    def __init__(self, start=0):\n        Counter.value = start\n    def increment(self, step=1):\n        Counter.value += step\n        return Counter.value'],
    ['iterable-countdown', 'class Countdown:\n    def __init__(self, start):\n        self.start = start\n    def __iter__(self):\n        while self.start >= 0:\n            yield self.start\n            self.start -= 1'],
    ['binary-search', 'def binary_find(values, target):\n    for index, value in enumerate(values):\n        if value == target:\n            return index\n    return -1'],
    ['balanced-brackets', 'def balanced(text):\n    return text.count("(") == text.count(")") and text.count("[") == text.count("]") and text.count("{") == text.count("}")'],
    ['dynamic-coins', 'def min_coins(coins, amount):\n    count = 0\n    for coin in sorted(coins, reverse=True):\n        count += amount // coin\n        amount %= coin\n    return count if amount == 0 else None'],
  ];
  for (const [id, program] of mistakes) {
    await t.test(id, () => {
      const { task } = findLesson(id);
      assert.notEqual(runPython(program, task.checks, task.stdin).status, 0,
        `${id}: a conceptually wrong answer was accepted`);
    });
  }
});

test('insertion-sort checks reject ordinary built-in sorting shortcuts', async (t) => {
  const { findLesson } = await import(catalogURL);
  const { task } = findLesson('insertion-sort');
  // These mutants cover ordinary prohibited shortcuts, not every algorithm or
  // deliberate attempts to bypass the grader.
  const shortcuts = [
    ['sorted()', 'def insertion_sort(values):\n    return sorted(values)'],
    ['copy + list.sort()', 'def insertion_sort(values):\n    result = list(values)\n    result.sort()\n    return result'],
  ];
  for (const [label, program] of shortcuts) {
    await t.test(label, () => {
      const result = runPython(program, task.checks, task.stdin);
      assert.notEqual(result.status, 0, `${label}: prohibited shortcut was accepted`);
      assert.match(result.stderr, /Use insertion sort, not sorted\(\) or list\.sort\(\)\./);
    });
  }
});

test('insertion-sort reference retains stable ordering and the copy/edge-case contract', async () => {
  const { findLesson } = await import(catalogURL);
  const { task } = findLesson('insertion-sort');
  const stabilityChecks = String.raw`
class _TaggedNumber(float):
    pass
_first, _second = _TaggedNumber(2), _TaggedNumber(2)
_small = _TaggedNumber(1)
_original = [_first, _small, _second]
_result = insertion_sort(_original)
assert _result is not _original
assert all(actual is expected for actual, expected in zip(_result, [_small, _first, _second]))
assert all(actual is expected for actual, expected in zip(_original, [_first, _small, _second]))
`;
  requirePass(runPython(task.solution, `${task.checks}\n${stabilityChecks}`, task.stdin),
    'insertion-sort: reference solution, stability, unchanged input, copy and edge cases');
});

test('findLesson returns the original lesson by exact id, or undefined when absent', async () => {
  const { courses, findLesson } = await import(catalogURL);
  assert.equal(typeof findLesson, 'function');
  for (const course of courses) {
    for (const lesson of course.lessons) {
      assert.equal(findLesson(lesson.id), lesson, lesson.id);
    }
    assert.equal(findLesson(course.id), undefined, 'Course ids are not lesson ids.');
  }
  for (const absent of ['', 'HELLO-OUTPUT', 'missing-lesson', null, undefined]) {
    assert.equal(findLesson(absent), undefined);
  }
});
