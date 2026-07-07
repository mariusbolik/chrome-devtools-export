import { createInitialPopupState, reducePopupState, type PopupState } from "./popup-state";

type ShareActiveTabResponse =
  | { ok: true; url: string }
  | { ok: false; error: string };

const statusText = document.getElementById("statusText")!;
const shareButton = document.getElementById("shareButton") as HTMLButtonElement;
const openExportPanel = document.getElementById("openExportPanel") as HTMLButtonElement;
const includeScreenshot = document.getElementById("includeScreenshot") as HTMLInputElement;
const progress = document.getElementById("progress")!;
const shareLink = document.getElementById("shareLink") as HTMLAnchorElement;
const devtoolsHint = document.getElementById("devtoolsHint")!;
const header = document.querySelector(".header")!;
const DEVTOOLS_PANEL_HINT = "Open Chrome DevTools (Mac: Cmd+Option+I, Windows/Linux: Ctrl+Shift+I), then select the DevTools Export panel.";

let state = createInitialPopupState();

function render(next: PopupState) {
  state = next;
  statusText.textContent = state.message;
  shareButton.disabled = state.buttonDisabled;
  shareButton.textContent = state.buttonText;
  openExportPanel.disabled = state.optionsDisabled;
  includeScreenshot.checked = state.includeScreenshot;
  includeScreenshot.disabled = state.optionsDisabled;
  progress.hidden = state.status !== "sharing";
  header.classList.toggle("error", state.status === "error");
  if (state.status === "sharing" || state.status === "success") {
    devtoolsHint.hidden = true;
  }

  if (state.shareUrl) {
    shareLink.href = state.shareUrl;
    shareLink.textContent = state.shareUrl;
    shareLink.classList.add("show");
  } else {
    shareLink.removeAttribute("href");
    shareLink.textContent = "";
    shareLink.classList.remove("show");
  }
}

async function getActiveTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id ?? null;
}

async function shareBugReport() {
  render(reducePopupState(state, { type: "sharing" }));

  const tabId = await getActiveTabId();
  if (tabId === null) {
    render(reducePopupState(state, { type: "error", message: "No active tab found." }));
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "share-active-tab",
    tabId,
    includeScreenshot: state.includeScreenshot,
  }) as ShareActiveTabResponse;

  if (response.ok) {
    render(reducePopupState(state, { type: "success", url: response.url }));
    try {
      await navigator.clipboard.writeText(response.url);
    } catch {
      // The visible link is enough if the browser denies clipboard access.
    }
    return;
  }

  render(reducePopupState(state, { type: "error", message: response.error }));
}

shareButton.addEventListener("click", () => {
  void shareBugReport();
});

openExportPanel.addEventListener("click", () => {
  devtoolsHint.textContent = DEVTOOLS_PANEL_HINT;
  devtoolsHint.hidden = false;
  statusText.textContent = DEVTOOLS_PANEL_HINT;
});

includeScreenshot.addEventListener("change", () => {
  render(reducePopupState(state, {
    type: "setIncludeScreenshot",
    includeScreenshot: includeScreenshot.checked,
  }));
});

render(state);
