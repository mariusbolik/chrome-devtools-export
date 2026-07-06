export type PopupStatus = "idle" | "sharing" | "success" | "error";

export interface PopupState {
  status: PopupStatus;
  buttonDisabled: boolean;
  buttonText: string;
  message: string;
  shareUrl: string | null;
}

export type PopupEvent =
  | { type: "sharing" }
  | { type: "success"; url: string }
  | { type: "error"; message: string }
  | { type: "reset" };

export function createInitialPopupState(): PopupState {
  return {
    status: "idle",
    buttonDisabled: false,
    buttonText: "Share Bug Report",
    message: "Capture and upload the active tab.",
    shareUrl: null,
  };
}

export function reducePopupState(_state: PopupState, event: PopupEvent): PopupState {
  if (event.type === "sharing") {
    return {
      status: "sharing",
      buttonDisabled: true,
      buttonText: "Sharing...",
      message: "Capturing DevTools snapshot...",
      shareUrl: null,
    };
  }

  if (event.type === "success") {
    return {
      status: "success",
      buttonDisabled: false,
      buttonText: "Share Bug Report",
      message: "Bug report link ready.",
      shareUrl: event.url,
    };
  }

  if (event.type === "error") {
    return {
      status: "error",
      buttonDisabled: false,
      buttonText: "Share Bug Report",
      message: event.message,
      shareUrl: null,
    };
  }

  return createInitialPopupState();
}
