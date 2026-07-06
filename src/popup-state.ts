export type PopupStatus = "idle" | "sharing" | "success" | "error";

export interface PopupState {
  status: PopupStatus;
  buttonDisabled: boolean;
  buttonText: string;
  includeScreenshot: boolean;
  optionsDisabled: boolean;
  message: string;
  shareUrl: string | null;
}

export type PopupEvent =
  | { type: "sharing" }
  | { type: "success"; url: string }
  | { type: "error"; message: string }
  | { type: "setIncludeScreenshot"; includeScreenshot: boolean }
  | { type: "reset" };

export function createInitialPopupState(): PopupState {
  return {
    status: "idle",
    buttonDisabled: false,
    buttonText: "Share Bug Report",
    includeScreenshot: true,
    optionsDisabled: false,
    message: "Capture and upload the active tab.",
    shareUrl: null,
  };
}

export function reducePopupState(state: PopupState, event: PopupEvent): PopupState {
  if (event.type === "sharing") {
    return {
      status: "sharing",
      buttonDisabled: true,
      buttonText: "Sharing...",
      includeScreenshot: state.includeScreenshot,
      optionsDisabled: true,
      message: "Capturing DevTools snapshot...",
      shareUrl: null,
    };
  }

  if (event.type === "success") {
    return {
      status: "success",
      buttonDisabled: false,
      buttonText: "Share Bug Report",
      includeScreenshot: state.includeScreenshot,
      optionsDisabled: false,
      message: "Bug report link ready.",
      shareUrl: event.url,
    };
  }

  if (event.type === "error") {
    return {
      status: "error",
      buttonDisabled: false,
      buttonText: "Share Bug Report",
      includeScreenshot: state.includeScreenshot,
      optionsDisabled: false,
      message: event.message,
      shareUrl: null,
    };
  }

  if (event.type === "setIncludeScreenshot") {
    return {
      ...state,
      includeScreenshot: event.includeScreenshot,
    };
  }

  return createInitialPopupState();
}
