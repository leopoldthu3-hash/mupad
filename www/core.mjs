const STARTER = 'print("Hello from MuPad!")\n';
const validName = name => /^[A-Za-z_][A-Za-z0-9_]*\.py$/.test(name);

function normalizedName(input) {
  const name = String(input || "").trim();
  const withExtension = name.endsWith(".py") ? name : `${name}.py`;
  if (!validName(withExtension)) throw new Error("Use a simple Python filename, for example ideas.py");
  return withExtension;
}

function clone(workspace) {
  return {activeFile: workspace.activeFile, files: workspace.files.map(file => ({...file}))};
}

function fileIndex(workspace, name) {
  const index = workspace.files.findIndex(file => file.name === name);
  if (index < 0) throw new Error(`Could not find ${name}`);
  return index;
}

export function createWorkspace() {
  return {activeFile: "main.py", files: [{name: "main.py", content: STARTER}]};
}

export function createFile(workspace, inputName) {
  const next = clone(workspace);
  const name = normalizedName(inputName);
  if (next.files.some(file => file.name === name)) throw new Error("That filename already exists");
  next.files.push({name, content: "# Write Python here\n"});
  next.activeFile = name;
  return next;
}

export function saveFile(workspace, name, content) {
  const next = clone(workspace);
  next.files[fileIndex(next, name)].content = String(content);
  return next;
}

export function renameFile(workspace, oldName, inputName) {
  const next = clone(workspace);
  const newName = normalizedName(inputName);
  const index = fileIndex(next, oldName);
  if (oldName !== newName && next.files.some(file => file.name === newName)) throw new Error("That filename already exists");
  next.files[index].name = newName;
  if (next.activeFile === oldName) next.activeFile = newName;
  return next;
}

export function runResult({stdout = "", error = "", elapsedMs = 0}) {
  const elapsed = Math.max(0, Math.round(elapsedMs));
  if (error) return {kind: "error", text: String(error), meta: `Stopped after ${elapsed} ms`};
  return {kind: "success", text: String(stdout).replace(/\n$/, "") || "Program finished with no output.", meta: `Finished in ${elapsed} ms`};
}
