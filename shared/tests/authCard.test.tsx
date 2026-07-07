import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthCard, type AuthCardLabels } from "../src/components";

/*
 * Shell-independent pre-login card (target-IA D8). Mode toggle + email /
 * password form + inline error band + busy submit. Pure presentation:
 * the host injects copy and owns the signIn/signUp calls.
 */

const LABELS: AuthCardLabels = {
  productName: "Life Editor",
  tagline: "Your workspace",
  modeToggle: "Authentication mode",
  signIn: "Sign in",
  signUp: "Sign up",
  email: "Email address",
  emailPlaceholder: "you@example.com",
  password: "Password",
  passwordHelper: "At least 6 characters",
  showPassword: "Show password",
  hidePassword: "Hide password",
  busy: "Working…",
  footerSignIn: "No account yet?",
  footerSignUp: "Already have an account?",
};

function renderCard(props?: Partial<Parameters<typeof AuthCard>[0]>) {
  const handlers = {
    onModeChange: vi.fn(),
    onEmailChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onSubmit: vi.fn(),
  };
  render(
    <AuthCard
      mode="signIn"
      email=""
      password=""
      error={null}
      busy={false}
      labels={LABELS}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("AuthCard", () => {
  it("renders the brand header, both fields, and the mode-matched copy", () => {
    renderCard();
    expect(screen.getByText("Life Editor")).toBeInTheDocument();
    expect(screen.getByText("Your workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "type",
      "email",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(
      screen.getByRole("button", { name: "Sign in" }),
    ).toHaveAttribute("type", "submit");
    expect(screen.getByText("No account yet?")).toBeInTheDocument();
  });

  it("follows the sign-up mode: submit label, footer, autocomplete", () => {
    renderCard({ mode: "signUp" });
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(
      screen.getByRole("button", { name: "Sign up" }),
    ).toHaveAttribute("type", "submit");
    expect(screen.getByText("Already have an account?")).toBeInTheDocument();
  });

  it("reports mode changes from the toggle", () => {
    const { onModeChange } = renderCard();
    fireEvent.click(screen.getByRole("radio", { name: "Sign up" }));
    expect(onModeChange).toHaveBeenCalledWith("signUp");
  });

  it("fires onSubmit on form submit", () => {
    const { onSubmit } = renderCard({
      email: "a@example.com",
      password: "secret",
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Sign in" }).closest("form")!,
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows the error band as an alert", () => {
    renderCard({ error: "Email or password is incorrect" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Email or password is incorrect",
    );
  });

  it("dims into the busy state: disabled fields + spinner label", () => {
    renderCard({ busy: true });
    expect(screen.getByLabelText("Email address")).toBeDisabled();
    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Sign in" })).toBeDisabled();
    const submit = screen.getByRole("button", { name: "Working…" });
    expect(submit).toBeDisabled();
  });
});
