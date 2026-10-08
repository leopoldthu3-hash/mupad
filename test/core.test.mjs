import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkspace,
  createFile,
  renameFile,
  saveFile,
  runResult
} from "../core.mjs";

test("a new workspace contains a runnable main.py starter file", () => {
  const workspace = createWorkspace();
  assert.deepEqual(workspace.files, [{name: "main.py", content: 'print("Hello from MuPad!")\n'}]);
  assert.equal(workspace.activeFile, "main.py");
});

test("files use safe unique Python filenames", () => {
  const workspace = createWorkspace();
  const created = createFile(workspace, "ideas");
  assert.equal(created.activeFile, "ideas.py");
  assert.throws(() => createFile(created, "ideas.py"), /already exists/i);
  assert.throws(() => createFile(created, "../unsafe"), /filename/i);
});

test("saving and renaming keeps the active code file", () => {
  const workspace = createWorkspace();
  const saved = saveFile(workspace, "main.py", "print(42)\n");
  const renamed = renameFile(saved, "main.py", "practice.py");
  assert.equal(renamed.activeFile, "practice.py");
  assert.deepEqual(renamed.files, [{name: "practice.py", content: "print(42)\n"}]);
});

test("run results present stdout, errors, and timing consistently", () => {
  assert.deepEqual(runResult({stdout: "hello\n", elapsedMs: 18}), {kind: "success", text: "hello", meta: "Finished in 18 ms"});
  assert.deepEqual(runResult({error: "NameError: x", elapsedMs: 5}), {kind: "error", text: "NameError: x", meta: "Stopped after 5 ms"});
});
