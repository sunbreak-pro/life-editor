import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnifiedColorPicker } from "./UnifiedColorPicker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

describe("UnifiedColorPicker", () => {
  it("calls onChange when a preset color is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<UnifiedColorPicker color="#ef4444" onChange={onChange} inline />);
    const blueSwatch = screen.getByLabelText("#3b82f6");
    await user.click(blueSwatch);
    expect(onChange).toHaveBeenCalledWith("#3b82f6");
  });

  it("preset button mousedown calls preventDefault so a focused input above does not blur", () => {
    const onChange = vi.fn();
    render(<UnifiedColorPicker color="#ef4444" onChange={onChange} inline />);
    const swatch = screen.getByLabelText("#3b82f6");
    const event = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    swatch.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("text-color reset button (Default) preventDefault on mousedown", () => {
    const onTextColorChange = vi.fn();
    render(
      <UnifiedColorPicker
        color="#ef4444"
        onChange={vi.fn()}
        showTextColor
        textColor="#ffffff"
        effectiveTextColor="#ffffff"
        onTextColorChange={onTextColorChange}
        inline
      />,
    );
    const textTab = screen.getByText("Text");
    const tabEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    textTab.dispatchEvent(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(true);

    fireEvent.click(textTab);
    const defaultBtn = screen.getByText("Default");
    const dEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    defaultBtn.dispatchEvent(dEvent);
    expect(dEvent.defaultPrevented).toBe(true);
  });

  it("embedded mode drops the wrapping border/background and uses w-full", () => {
    const { container, rerender } = render(
      <UnifiedColorPicker color="#ef4444" onChange={vi.fn()} inline />,
    );
    const standalone = container.firstChild as HTMLElement;
    expect(standalone.className).toContain("border");
    expect(standalone.className).toContain("w-[190px]");

    rerender(
      <UnifiedColorPicker color="#ef4444" onChange={vi.fn()} inline embedded />,
    );
    const embedded = container.firstChild as HTMLElement;
    expect(embedded.className).not.toContain("border");
    expect(embedded.className).toContain("w-full");
  });
});
