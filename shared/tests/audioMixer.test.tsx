import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Cloud, Flame } from "lucide-react";
import { AudioMixer, type AudioMixerProps } from "../src/components/AudioMixer";

/*
 * Ambient mixer row restyle. Pure primitive — props-injected copy (§6.4).
 * Covers the toggle wiring, the disabled-slider-while-off rule, the volume
 * readout and the #714 save footer (volume is audible per drag, persisted per
 * press — the two-stage split lives in AudioProvider, pinned separately in
 * audioProviderVolumeSave.test.tsx).
 */

const SOUNDS: AudioMixerProps["sounds"] = [
  { id: "rain", label: "Rain", icon: Cloud },
  { id: "fire", label: "Fire", icon: Flame },
];

const LABELS: AudioMixerProps["labels"] = {
  heading: "Ambient sounds",
  toggle: "Toggle",
  volume: "Volume",
  save: "Save",
  saved: "Saved",
  unsaved: "Unsaved",
};

function renderMixer(overrides?: Partial<AudioMixerProps>) {
  const props: AudioMixerProps = {
    sounds: SOUNDS,
    settings: {
      rain: { volume: 60, enabled: true },
      fire: { volume: 30, enabled: false },
    },
    labels: LABELS,
    onToggle: vi.fn(),
    onVolumeChange: vi.fn(),
    dirty: false,
    onSave: vi.fn(),
    ...overrides,
  };
  render(<AudioMixer {...props} />);
  return props;
}

describe("AudioMixer", () => {
  it("reflects each row's enabled state on the switch", () => {
    renderMixer();
    expect(
      screen.getByRole("switch", { name: "Toggle: Rain" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Toggle: Fire" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("fires onToggle with the flipped enabled flag", () => {
    const props = renderMixer();
    fireEvent.click(screen.getByRole("switch", { name: "Toggle: Fire" }));
    expect(props.onToggle).toHaveBeenCalledWith("fire", true);
  });

  it("disables the slider on a muted row and shows the volume", () => {
    renderMixer();
    expect(screen.getByRole("slider", { name: "Volume: Fire" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Volume: Rain" })).toBeEnabled();
    expect(screen.getByText("60")).toBeInTheDocument();
  });

  it("reports a drag straight away — the sound must not wait for the button", () => {
    const props = renderMixer();
    fireEvent.change(screen.getByRole("slider", { name: "Volume: Rain" }), {
      target: { value: "80" },
    });
    expect(props.onVolumeChange).toHaveBeenCalledWith("rain", 80);
    // The button is a separate press; moving the slider must not write.
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("names the pending state and only saves while something is pending", () => {
    const clean = renderMixer({ dirty: false });
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    cleanup();

    const pending = renderMixer({ dirty: true });
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(pending.onSave).toHaveBeenCalledOnce();
    expect(clean.onSave).not.toHaveBeenCalled();
  });

  /*
   * Same button, second copy: this class string and PomodoroSettings' SAVE_BTN
   * were written identically, so the #880 band showed up in both places. The
   * assertion is duplicated on purpose — the two constants are not shared, and
   * a guard on only one of them would let the other drift back.
   */
  /*
   * #1474, and duplicated for the same reason the #880 case above is: this
   * class string and PomodoroSettings' SAVE_BTN are separate constants, so a
   * guard on one of them would let the other drift back to the accent fade.
   */
  it("drops the disabled save button to a surface fill (#1474)", () => {
    renderMixer({ dirty: false });
    const classes = screen.getByRole("button", { name: "Save" }).className;

    expect(classes).not.toMatch(/disabled:opacity-\d/);
    expect(classes).toContain("disabled:bg-lumen-surface-sunken");
    expect(classes).toContain("disabled:text-lumen-text-tertiary");
    expect(classes).toContain("disabled:hover:bg-lumen-surface-sunken");
  });

  it("draws its focus ring with outline, not a colored ring offset (#880)", () => {
    renderMixer({ dirty: true });
    const classes = screen.getByRole("button", { name: "Save" }).className;

    expect(classes).not.toMatch(/ring-offset/);
    expect(classes).toContain("focus-visible:outline-lumen-text");
  });
});
