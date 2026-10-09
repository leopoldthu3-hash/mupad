// Pyodide's Node loader expects filesystem paths, not URL.pathname on Windows.
// Browser/WKWebView/Electron workers must keep their actual asset protocol.
export function pyodideIndexURL(directory) {
  if (directory.protocol !== 'file:') return directory.href;
  return decodeURIComponent(directory.pathname).replace(/^\/(?=[A-Za-z]:\/)/, '');
}