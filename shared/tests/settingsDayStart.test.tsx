import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsDayStart } from "../src/components";

/*
 * Day-start hour card (#373 — write side of the #218 rollover pref). Pure
 * presentation: the host owns useDayStartHourPref. What matters here is the
 * 0–23 option set, that the current hour is the selected one, and that the
 * change reaches the host as a NUMBER — a <select> hands back a string, and
 * the pref serializes straight to localStorage, so a leaked string would put
 * a value in there that parseDayStartHour has to rescue.
 */
const LABELS = {
  heading: "Date & time",
  description: "Choose when one day ends and the next begins.",
  hourLabel: "A new day starts at",
  hint: "Takes effect the next time today is worked out.",
};

function renderCard(value = 0) {
  const onChange = vi.fn();
  render(
    <SettingsDayStart value={value} onChange={onChange} labels={LABELS} />,
  );
  return { onChange, select: screen.getByRole("combobox") };
}

describe("SettingsDayStart", () => {
  it("offers every hour of the day, zero-padded", () => {
    renderCard();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(24);
    expect(options[0]).toHaveTextContent("00:00");
    expect(options[4]).toHaveTextContent("04:00");
    expect(options[23]).toHaveTextContent("23:00");
  });

  it("selects the current hour and renders the injected copy", () => {
    const { select } = renderCard(4);
    expect(select).toHaveValue("4");
    expect(screen.getByText("A new day starts at")).toBeInTheDocument();
    expect(screen.getByText(LABELS.hint)).toBeInTheDocument();
  });

  it("reports a change as a number, not the select's string", () => {
    const { onChange, select } = renderCard(0);
    fireEvent.change(select, { target: { value: "4" } });
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
