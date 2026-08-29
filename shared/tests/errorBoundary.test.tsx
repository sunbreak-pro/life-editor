import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary, type ErrorBoundaryLabels } from "../src/components";

/*
 * The render-crash floor (#1199). Before this boundary existed, any throw
 * during render unmounted the whole tree and left a white page.
 *
 * React itself writes the caught error to console.error, so every case here
 * silences it — an expected throw should not read as a failing suite.
 */

const LABELS: ErrorBoundaryLabels = {
  title: "Something went wrong",
  description: "Try again or reload.",
  retry: "Try again",
  reload: "Reload",
};

function Boom({ message = "kaboom" }: { message?: string }): never {
  throw new Error(message);
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("ErrorBoundary", () => {
  it("renders its children while nothing throws", () => {
    render(
      <ErrorBoundary labels={LABELS}>
        <p>section content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("section content")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("catches a child throw and renders the fallback instead of nothing", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary labels={LABELS} onError={onError}>
        <Boom message="render blew up" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(LABELS.title)).toBeTruthy();
    // The message is surfaced so the user can quote it; the stack is not.
    expect(screen.getByText("render blew up")).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("offers reload only on the page variant, retry + reload on a section", () => {
    const { unmount } = render(
      <ErrorBoundary labels={LABELS} variant="page" onError={vi.fn()}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: LABELS.reload })).toBeTruthy();
    expect(screen.queryByRole("button", { name: LABELS.retry })).toBeNull();
    unmount();

    render(
      <ErrorBoundary labels={LABELS} variant="section" onError={vi.fn()}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: LABELS.retry })).toBeTruthy();
    expect(screen.getByRole("button", { name: LABELS.reload })).toBeTruthy();
  });

  it("retry re-renders the subtree, so a transient throw recovers in place", () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error("first pass only");
      return <p>recovered</p>;
    }
    render(
      <ErrorBoundary labels={LABELS} variant="section" onError={vi.fn()}>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: LABELS.retry }));

    expect(screen.getByText("recovered")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the error when resetKey changes (walking to another section)", () => {
    const { rerender } = render(
      <ErrorBoundary labels={LABELS} resetKey="todos" onError={vi.fn()}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    rerender(
      <ErrorBoundary labels={LABELS} resetKey="notes" onError={vi.fn()}>
        <p>notes body</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("notes body")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
