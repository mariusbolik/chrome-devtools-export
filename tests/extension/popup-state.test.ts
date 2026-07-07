import { describe, expect, test } from "bun:test";
import { createInitialPopupState, reducePopupState } from "../../src/popup-state";

describe("popup state", () => {
  test("starts idle with the Share Bug Report button enabled", () => {
    expect(createInitialPopupState()).toEqual({
      status: "idle",
      buttonDisabled: false,
      buttonText: "Share Bug Report",
      includeScreenshot: true,
      optionsDisabled: false,
      message: "Capture and upload the active tab.",
      shareUrl: null,
    });
  });

  test("shows loading progress while a share is running", () => {
    expect(reducePopupState(createInitialPopupState(), { type: "sharing" })).toEqual({
      status: "sharing",
      buttonDisabled: true,
      buttonText: "Sharing...",
      includeScreenshot: true,
      optionsDisabled: true,
      message: "Capturing DevTools snapshot...",
      shareUrl: null,
    });
  });

  test("lets the user disable screenshot capture before sharing", () => {
    expect(reducePopupState(createInitialPopupState(), { type: "setIncludeScreenshot", includeScreenshot: false })).toEqual({
      status: "idle",
      buttonDisabled: false,
      buttonText: "Share Bug Report",
      includeScreenshot: false,
      optionsDisabled: false,
      message: "Capture and upload the active tab.",
      shareUrl: null,
    });
  });

  test("shows a link after share succeeds", () => {
    expect(
      reducePopupState(createInitialPopupState(), {
        type: "success",
        url: "https://devtoolsexport.com/share/AbC234xy/",
      })
    ).toEqual({
      status: "success",
      buttonDisabled: false,
      buttonText: "Share Bug Report",
      includeScreenshot: true,
      optionsDisabled: false,
      message: "Bug report link ready.",
      shareUrl: "https://devtoolsexport.com/share/AbC234xy/",
    });
  });

  test("shows capture errors without asking for DevTools", () => {
    expect(
      reducePopupState(createInitialPopupState(), {
        type: "error",
        message: "Could not capture this tab.",
      })
    ).toEqual({
      status: "error",
      buttonDisabled: false,
      buttonText: "Share Bug Report",
      includeScreenshot: true,
      optionsDisabled: false,
      message: "Could not capture this tab.",
      shareUrl: null,
    });
  });
});
