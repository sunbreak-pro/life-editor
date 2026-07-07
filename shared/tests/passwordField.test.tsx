import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasswordField } from "../src/components";

/*
 * Password input with a built-in show/hide toggle + helper text (Auth
 * design). The eye toggle flips the input type and its own aria state;
 * the value stays controlled by the host.
 */

const LABELS = { show: "Show password", hide: "Hide password" };

function renderField(
  props?: Partial<Parameters<typeof PasswordField>[0]>,
) {
  const onChange = vi.fn();
  render(
    <PasswordField
      value="secret"
      onChange={onChange}
      labels={LABELS}
      helperText="At least 6 characters"
      placeholder="password"
      {...props}
    />,
  );
  return { onChange };
}

describe("PasswordField", () => {
  it("masks the value by default and shows the helper text", () => {
    renderField();
    expect(screen.getByPlaceholderText("password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByText("At least 6 characters")).toBeInTheDocument();
  });

  it("reveals / re-masks the value via the eye toggle", () => {
    renderField();
    const input = screen.getByPlaceholderText("password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(hide);
    expect(input).toHaveAttribute("type", "password");
  });

  it("reports typed text via onChange", () => {
    const { onChange } = renderField();
    fireEvent.change(screen.getByPlaceholderText("password"), {
      target: { value: "secret-2" },
    });
    expect(onChange).toHaveBeenCalledWith("secret-2");
  });

  it("disables both the input and the toggle when disabled", () => {
    renderField({ disabled: true });
    expect(screen.getByPlaceholderText("password")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toBeDisabled();
  });
});
