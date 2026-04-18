import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { createContext, type ReactNode } from "react";
import { createOptionalContextHook } from "./createOptionalContextHook";

interface TestValue {
  greet: () => string;
}

const TestContext = createContext<TestValue | null>(null);
const useTestContextOptional = createOptionalContextHook(TestContext);

describe("createOptionalContextHook", () => {
  it("returns null when called outside of the Provider", () => {
    const { result } = renderHook(() => useTestContextOptional());
    expect(result.current).toBeNull();
  });

  it("returns the context value when called inside the Provider", () => {
    const value: TestValue = { greet: () => "hello" };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TestContext.Provider value={value}>{children}</TestContext.Provider>
    );
    const { result } = renderHook(() => useTestContextOptional(), { wrapper });
    expect(result.current).toBe(value);
    expect(result.current?.greet()).toBe("hello");
  });
});
