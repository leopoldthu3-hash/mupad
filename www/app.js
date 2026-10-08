import {createWorkspace, createFile, renameFile, saveFile, runResult} from "./core.mjs";
import {loadPyodide} from "./pyodide/pyodide.mjs";

const STORAGE_KEY = "mupad-workspace-v1";
const $ = selector => document.querySelector(selector);
let workspace = loadWorkspace();
let pyodide;

function loadWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.activeFile && Array.isArray(saved.files) && saved.files.length) return saved;
  } catch { /* Use a fresh workspace. */ }
  return createWorkspace();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  $("#saveStatus").textContent = "Saved locally";
}

function activeFile() {
  return workspace.files.find(file => file.name === workspace.activeFile);
}

function renderFiles() {
  $("#fileList").replaceChildren(...workspace.files.map(file => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `file ${file.name === workspace.activeFile ? "active" : ""}`;
    button.textContent = file.name;
    button.addEventListener("click", () => {
      saveEditor();
      workspace.activeFile = file.name;
      render();
    });
    return button;
  }));
}

function render() {
  const file = activeFile();
  $("#activeName").textContent = file.name;
  $("#editor").value = file.content;
  renderFiles();
}

function saveEditor() {
  workspace = saveFile(workspace, workspace.activeFile, $("#editor").value);
  persist();
}

function showOutput(result) {
  const consolePanel = $(".console");
  consolePanel.classList.toggle("error", result.kind === "error");
  $("#output").textContent = result.text;
  $("#runMeta").textContent = result.meta;
}

async function getPython() {
  if (pyodide) return pyodide;
  $("#runtimeStatus").textContent = "Loading local Python…";
  pyodide = await loadPyodide({indexURL: new URL("./pyodide/", location.href).href});
  $("#runtimeStatus").textContent = "Python loaded locally";
  return pyodide;
}

async function runCode() {
  saveEditor();
  const button = $("#runButton");
  button.disabled = true;
  button.textContent = "Running…";
  const started = performance.now();
  let stdout = "";
  let stderr = "";
  try {
    const runtime = await getPython();
    runtime.setStdout({batched: text => { stdout += `${text}\n`; }});
    runtime.setStderr({batched: text => { stderr += `${text}\n`; }});
    await runtime.runPythonAsync($("#editor").value);
    showOutput(runResult({stdout, elapsedMs: performance.now() - started}));
  } catch (error) {
    showOutput(runResult({error: stderr || error.message || String(error), elapsedMs: performance.now() - started}));
  } finally {
    button.disabled = false;
    button.textContent = "▶ Run";
  }
}

$("#editor").addEventListener("input", () => { $("#saveStatus").textContent = "Unsaved changes"; });
$("#editor").addEventListener("keydown", event => {
  if (event.key === "Tab") {
    event.preventDefault();
    const input = event.currentTarget;
    const start = input.selectionStart;
    input.setRangeText("  ", start, input.selectionEnd, "end");
    input.dispatchEvent(new Event("input"));
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveEditor();
  }
});
$("#saveButton").addEventListener("click", saveEditor);
$("#runButton").addEventListener("click", runCode);
$("#newFileButton").addEventListener("click", () => {
  const name = prompt("New Python filename", "untitled.py");
  if (!name) return;
  try { saveEditor(); workspace = createFile(workspace, name); persist(); render(); } catch (error) { alert(error.message); }
});
$("#renameButton").addEventListener("click", () => {
  const name = prompt("Rename this file", workspace.activeFile);
  if (!name || name === workspace.activeFile) return;
  try { saveEditor(); workspace = renameFile(workspace, workspace.activeFile, name); persist(); render(); } catch (error) { alert(error.message); }
});
$("#clearOutput").addEventListener("click", () => showOutput({kind: "success", text: "Output cleared.", meta: "Ready"}));

render();
