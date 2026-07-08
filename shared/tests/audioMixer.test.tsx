import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Cloud, Flame } from "lucide-react";
import { AudioMixer, type AudioMixerProps } from "../src/components/AudioMixer";

/*
 * Ambient mixer row restyle. Pure primitive — props-injected copy (§6.4).
 * Covers the toggle wiring, the disabled-slider-while-off rule and the volume
 * readout.
 */

const SOUNDS: AudioMixerProps["sounds"] = [
  { id: "rain", label: "Rain", icon: Cloud },
  { id: "fire", label: "Fire", icon: Flame },
];

const LABELS: AudioMixerProps["labels"] = {
  heading: "Ambient sounds",
  toggle: "Toggle",
  volume: "Volume",
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
});
