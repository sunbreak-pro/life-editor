import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthCard, type AuthCardLabels } from "../src/components";

/*
 * Shell-independent pre-login card (target-IA D8). Email / password sign-in
 * form + inline error band + busy submit. Pure presentation: the host injects
 * copy and owns the signIn call. There is no sign-up mode (#2752).
 */

const LABELS: AuthCardLabels = {
  productName: "Life Editor",
  tagline: "Your workspace",
  signIn: "Sign in",
  email: "Email address",
  emailPlaceholder: "you@example.com",
  password: "Password",
  showPassword: "Show password",
  hidePassword: "Hide password",
  busy: "Working…",
  forgotPassword: "Forgot your password?",
};

function renderCard(props?: Partial<Parameters<typeof AuthCard>[0]>) {
  const handlers = {
    onEmailChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onSubmit: vi.fn(),
    onForgotPassword: vi.fn(),
  };
  render(
    <AuthCard
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
  it("renders the brand header, both fields, and the sign-in submit", () => {
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
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("offers no way to create an account", () => {
    // Sign-up was removed (#2752): no mode toggle, no second submit.
    renderCard();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Sign in" })).toHaveLength(1);
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

  it("offers the way out of a forgotten password", () => {
    // The only entry point to recovery (#919) — losing it strands the user.
    const { onForgotPassword } = renderCard();
    fireEvent.click(
      screen.getByRole("button", { name: "Forgot your password?" }),
    );
    expect(onForgotPassword).toHaveBeenCalledTimes(1);
  });

  it("leaves the new-password floor off the password field", () => {
    // The account's existing password predates every raise of the minimum
    // (#956). Enforced here, the browser would refuse to submit the real
    // password and strand the owner outside their own account.
    renderCard();
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("minlength");
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
    const submit = screen.getByRole("button", { name: "Working…" });
    expect(submit).toBeDisabled();
  });
});
