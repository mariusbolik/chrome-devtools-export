// Create a DevTools panel for exporting network requests
chrome.devtools.panels.create(
  "Export",
  "",
  "panel.html",
  (panel) => {
    console.log("Export panel created", panel);
  }
);
