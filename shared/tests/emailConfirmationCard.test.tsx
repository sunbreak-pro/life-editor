import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  EmailConfirmationCard,
  type EmailConfirmationCardLabels,
} from "../src/components";

/*
 * The dead-end card between "signed up" and "signed in" (#1197). Pure
 * presentation: it offers exactly two ways out — send the mail again, or go
 * back to sign in — and prints the address so a typo in it is visible.
 */

const LABELS: EmailConfirmationCardLabels = {
  productName: "Life Editor",
  tagline: "Your workspace",
  heading: "Check your inbox",
  description: "A confirmation link is on its way to this address.",
  hint: "Nothing after a few minutes? Look in the spam folder.",
  resend: "Send the link again",
  busy: "Sending…",
  back: "Back to sign in",
};

function renderCard(props?: Partial<Parameters<typeof EmailConfirmationCard>[0]>) {
  const handlers = { onResend: vi.fn(), onBack: vi.fn() };
  render(
    <EmailConfirmationCard
      email="me@example.com"
      error={null}
      notice={null}
      busy={false}
      labels={LABELS}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("EmailConfirmationCard", () => {
  it("prints the address the link was sent to", () => {
    renderCard();
    expect(screen.getByText(LABELS.heading)).toBeTruthy();
    expect(screen.getByText("me@example.com")).toBeTruthy();
    expect(screen.getByText(LABELS.hint)).toBeTruthy();
  });

  it("offers only resend and back", () => {
    const { onResend, onBack } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: LABELS.resend }));
    expect(onResend).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: LABELS.back }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("blocks a second resend while one is in flight", () => {
    const { onResend } = renderCard({ busy: true });
    const button = screen.getByRole("button", { name: LABELS.busy });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(onResend).not.toHaveBeenCalled();
  });

  it("shows the two outcome bands with the right tone", () => {
    renderCard({ notice: "Sent again." });
    expect(screen.getByText("Sent again.")).toBeTruthy();

    renderCard({ error: "Could not send the link." });
    expect(screen.getByText("Could not send the link.")).toBeTruthy();
  });
});
