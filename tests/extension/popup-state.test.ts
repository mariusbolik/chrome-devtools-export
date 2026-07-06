import { describe, expect, test } from "bun:test";
import { createInitialPopupState, reducePopupState } from "../../src/popup-state";

describe("popup state", () => {
  test("starts idle with the Share Bug Report button enabled", () => {
    expect(createInitialPopupState()).toEqual({
      status: "idle",
      buttonDisabled: false,
      buttonText: "Share Bug Report",
      message: "Capture from the open DevTools Export panel.",
      shareUrl: null,
    });
  });

  test("shows loading progress while a share is running", () => {
    expect(reducePopupState(createInitialPopupState(), { type: "sharing" })).toEqual({
      status: "sharing",
      buttonDisabled: true,
      buttonText: "Sharing...",
      message: "Capturing DevTools snapshot...",
      shareUrl: null,
    });
  });

  test("shows a link after share succeeds", () => {
    expect(
      reducePopupState(createInitialPopupState(), {
        type: "success",
        url: "https://devtools-export.mcb-software.workers.dev/share/AbC234xy/",
      })
    ).toEqual({
      status: "success",
      buttonDisabled: false,
      buttonText: "Share Bug Report",
      message: "Bug report link ready.",
      shareUrl: "https://devtools-export.mcb-software.workers.dev/share/AbC234xy/",
    });
  });

  test("explains when the DevTools panel is not connected", () => {
    expect(
      reducePopupState(createInitialPopupState(), {
        type: "error",
        message: "Open DevTools and select the Export panel first.",
      })
    ).toEqual({
      status: "error",
      buttonDisabled: false,
      buttonText: "Share Bug Report",
      message: "Open DevTools and select the Export panel first.",
      shareUrl: null,
    });
  });
});
