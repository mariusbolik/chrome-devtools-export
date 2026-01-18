window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== "DEVTOOLS_EXPORT_LOG") return;
  if (!event.data.data || typeof event.data.data !== "object") return;

  try {
    chrome.runtime.sendMessage({ type: "console-log", data: event.data.data });
  } catch {
    // Ignore messaging errors (e.g. extension unloaded)
  }
});

const injectMainScript = () => {
  if (document.documentElement.getAttribute("data-devtools-export-logger") === "true") return;
  document.documentElement.setAttribute("data-devtools-export-logger", "true");

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("content-main.js");
  script.async = false;
  script.onerror = () => {
    document.documentElement.removeAttribute("data-devtools-export-logger");
  };
  if (document.head) {
    document.head.appendChild(script);
  } else if (document.documentElement) {
    document.documentElement.appendChild(script);
  } else {
    return;
  }
  script.onload = () => script.remove();
};

injectMainScript();

try {
  chrome.runtime.sendMessage({ type: "console-bridge-ready" });
} catch {
  // Ignore messaging errors (e.g. extension unloaded)
}
