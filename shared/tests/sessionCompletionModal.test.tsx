import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  SessionCompletionModal,
  type SessionCompletionModalProps,
} from "../src/components/SessionCompletionModal";

/*
 * WORK-completion modal. Pure primitive over <Modal> — props-injected copy
 * (§6.4). Covers the closed (nothing rendered) state and the three actions.
 */

const LABELS: SessionCompletionModalProps["labels"] = {
  title: "Session 2 complete",
  body: "Logged 25 min to “File taxes”. Take a 5-minute break.",
  startBreak: "Start break",
  oneMore: "One more session",
  close: "Close",
};

function renderModal(overrides?: Partial<SessionCompletionModalProps>) {
  const props: SessionCompletionModalProps = {
    open: true,
    onClose: vi.fn(),
    sessions: { total: 4, filled: 2 },
    labels: LABELS,
    onStartBreak: vi.fn(),
    onOneMore: vi.fn(),
    ...overrides,
  };
  render(<SessionCompletionModal {...props} />);
  return props;
}

describe("SessionCompletionModal", () => {
  it("renders nothing while closed", () => {
    renderModal({ open: false });
    expect(screen.queryByText("Session 2 complete")).not.toBeInTheDocument();
  });

  it("shows the title and body when open", () => {
    renderModal();
    expect(screen.getByText("Session 2 complete")).toBeInTheDocument();
    expect(screen.getByText(/Logged 25 min/)).toBeInTheDocument();
  });

  it("wires the three action buttons", () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Start break" }));
    expect(props.onStartBreak).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "One more session" }));
    expect(props.onOneMore).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
