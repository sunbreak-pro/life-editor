import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AttachmentCleanupPanel,
  ColorPicker,
  PasswordUpdateForm,
  SettingsAccount,
  SettingsLegal,
  SettingsProfile,
  SettingsReset,
  SettingsSchedule,
  SettingsTabsNav,
  SettingsTutorial,
  TagHubView,
  TrashView,
  buildTagHubModel,
  type SettingsAccountLabels,
  type TrashGroup,
  type TrashViewLabels,
} from "../src/components";
import {
  TAG_HUB_LABELS,
  formatCount,
  formatUnusedTags,
} from "./tagHubLabels";

/*
 * #1562 — the 44px touch floor on the SETTINGS lane (the #1512 remainder).
 *
 * The audit measured `getBoundingClientRect()` at 390px width. jsdom has no
 * layout (CLAUDE.md §7.1), so nothing here can re-measure that: every
 * assertion pins the CLASS CONTRACT that produces the size, which is what the
 * rest of the repo's sizing guards do (sharedTapTargets.test.tsx says so in as
 * many words).
 *
 * Two halves to every case, and the second is the point:
 *   - the narrow floor is there (`max-md:min-h-11`), and
 *   - the DESKTOP size did not move (`h-9` / `h-7` still painted, no
 *     unprefixed `min-h-11`).
 * The `md:` prefix is load-bearing rather than decorative — <Button size="md">
 * feeds 15 Desktop call sites, so an unconditional floor would grow all of
 * them. 768px is also exactly WIDE_BREAKPOINT_PX, so `max-md:` and the
 * components' own `wide` flag flip on the same pixel.
 */

function mockMatchMedia(matches: boolean) {
  // @ts-expect-error — minimal stub, only `matches` is read.
  window.matchMedia = () => ({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

afterEach(() => {
  // @ts-expect-error — removing the stub restores the wide fallback.
  delete window.matchMedia;
});

/** Both halves of the contract in one place. */
function expectNarrowFloor(el: HTMLElement, paintedHeight: string) {
  expect(el).toHaveClass("max-md:min-h-11");
  expect(el).not.toHaveClass("min-h-11");
  expect(el).toHaveClass(paintedHeight);
}

describe("#1562 — the settings category list", () => {
  it("floors the rows on narrow and leaves the Desktop row at 36px", () => {
    render(
      <SettingsTabsNav
        tabs={[
          { id: "general", label: "General", icon: null },
          { id: "tips", label: "Tips", icon: null, opensPanel: true },
        ]}
        value="general"
        onSelect={() => {}}
        label="Settings categories"
      />,
    );

    for (const name of ["General", "Tips"]) {
      // NavItem also draws the Desktop sidebar, where 36px is the density the
      // rail was designed at — hence the conditional floor.
      expectNarrowFloor(screen.getByRole("button", { name }), "h-9");
    }
  });
});

describe("#1562 — the general cards", () => {
  const ACCOUNT_LABELS: SettingsAccountLabels = {
    heading: "Account",
    description: "Your sign-in details.",
    emailLabel: "Signed in as",
    signOutHeading: "Sign out",
    signOutDescription: "End this session.",
    signOutButton: "Sign out",
    deleteHeading: "Delete account",
    deleteDescription: "This cannot be undone.",
    deleteButton: "Delete account",
    newPassword: "New password",
    newPasswordHelper: "At least 8 characters.",
    confirmPassword: "Confirm password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    submit: "Change password",
    busy: "Saving…",
  };

  function renderAccount() {
    return render(
      <SettingsAccount
        email="a@example.com"
        password=""
        onPasswordChange={() => {}}
        confirmPassword=""
        onConfirmPasswordChange={() => {}}
        error={null}
        notice={null}
        busy={false}
        onSubmit={() => {}}
        onSignOut={() => {}}
        onDeleteAccount={() => {}}
        labels={ACCOUNT_LABELS}
      />,
    );
  }

  it("floors sign-out, delete and the password submit", () => {
    renderAccount();

    for (const name of ["Sign out", "Delete account", "Change password"]) {
      expectNarrowFloor(screen.getByRole("button", { name }), "h-9");
    }
  });

  it("leaves the full-width auth submit alone — it is already 44px", () => {
    render(
      <PasswordUpdateForm
        password=""
        onPasswordChange={() => {}}
        confirmPassword=""
        onConfirmPasswordChange={() => {}}
        error={null}
        busy={false}
        onSubmit={() => {}}
        labels={ACCOUNT_LABELS}
        fullWidthSubmit
      />,
    );

    const submit = screen.getByRole("button", { name: "Change password" });
    // size="lg" is h-11 on every width, so the floor would be noise here — and
    // `w-full` is the class this call site actually needs to keep.
    expect(submit).toHaveClass("h-11", "w-full");
    expect(submit).not.toHaveClass("max-md:min-h-11");
  });

  it("floors the tutorial, legal and reset buttons", () => {
    render(
      <>
        <SettingsTutorial
          onOpen={() => {}}
          labels={{
            heading: "Tutorial",
            description: "Take the tour.",
            button: "Open the tutorial",
          }}
        />
        <SettingsLegal
          onOpenPrivacy={() => {}}
          onOpenTerms={() => {}}
          labels={{
            heading: "Legal",
            description: "The documents.",
            privacy: "Privacy policy",
            terms: "Terms of use",
          }}
        />
        <SettingsReset
          onReset={() => {}}
          labels={{
            heading: "Reset",
            description: "Back to defaults.",
            button: "Reset preferences",
          }}
        />
      </>,
    );

    for (const name of [
      "Open the tutorial",
      "Privacy policy",
      "Terms of use",
      "Reset preferences",
    ]) {
      expectNarrowFloor(screen.getByRole("button", { name }), "h-9");
    }
  });
});

describe("#1562 — the trash controls", () => {
  const LABELS: TrashViewLabels = {
    empty: "Trash is empty",
    emptyDescription: "Deleted items will appear here.",
    restore: "Restore",
    restoring: "Restoring…",
    deleting: "Deleting…",
    deletePermanently: "Delete permanently",
    confirmMessage: 'Permanently delete "{name}"?',
    cascadeWarning: "Sub-items go too.",
    cancel: "Cancel",
    close: "Close",
    selectItem: 'Select "{name}"',
    selectGroup: "Select all {name}",
    selectedCount: "{count} selected",
    clearSelection: "Clear the selection",
    restoreSelected: "Restore selected",
    deleteSelected: "Delete selected",
    emptyTrash: "Empty the trash",
    confirmSelectionMessage: "{count} items will be deleted.",
    confirmEmptyMessage: "All {count} items will be deleted.",
    restoringMany: "Restoring…",
    deletingMany: "Deleting…",
  };

  const GROUPS: TrashGroup[] = [
    { category: "todos", title: "Todos", items: [{ id: "t1", label: "Milk" }] },
  ];

  function renderTrash() {
    return render(
      <TrashView
        groups={GROUPS}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
        onRestoreMany={vi.fn()}
        onPermanentDeleteMany={vi.fn()}
        labels={LABELS}
      />,
    );
  }

  it("floors the empty-trash and per-row restore buttons", () => {
    renderTrash();

    expectNarrowFloor(
      screen.getByRole("button", { name: "Empty the trash" }),
      "h-7",
    );
    expectNarrowFloor(screen.getByRole("button", { name: "Restore" }), "h-7");
  });

  it("floors the bulk actions once something is selected", () => {
    renderTrash();
    fireEvent.click(screen.getByRole("checkbox", { name: 'Select "Milk"' }));

    for (const name of ["Restore selected", "Delete selected"]) {
      expectNarrowFloor(screen.getByRole("button", { name }), "h-7");
    }
  });

  it("gives the group checkbox the same box the row checkboxes already had", () => {
    // It was pinned `wide`, so it stayed a 24px box on a phone while the row
    // checkboxes beside it were 44 — the same control, two different sizes.
    mockMatchMedia(false);
    renderTrash();

    const group = screen
      .getByRole("checkbox", { name: "Select all Todos" })
      .closest("label");
    expect(group).toHaveClass("min-h-11", "min-w-11");
    expect(group).not.toHaveClass("h-6");
  });

  it("keeps the group checkbox at its mouse size on Desktop", () => {
    mockMatchMedia(true);
    renderTrash();

    const group = screen
      .getByRole("checkbox", { name: "Select all Todos" })
      .closest("label");
    expect(group).toHaveClass("h-6", "w-6");
    expect(group).not.toHaveClass("min-h-11");
  });
});

describe("#1562 — the tag editor, now inside the Connect hub (#1643)", () => {
  const MODEL = buildTagHubModel({
    tags: [
      {
        id: "tag-1",
        name: "work",
        color: null,
        icon: null,
        createdAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
        isDeleted: false,
        deletedAt: null,
      },
    ],
    assignments: [
      {
        id: "a1",
        itemId: "task-1",
        tagId: "tag-1",
        createdAt: "2026-08-01T00:00:00Z",
        isDisplayColor: false,
        updatedAt: "2026-08-01T00:00:00Z",
        isDeleted: false,
        deletedAt: null,
      },
    ],
    items: [{ id: "task-1", role: "task", title: "Buy milk" }],
    untaggedName: "Untagged",
  });

  function renderHub(over: Partial<React.ComponentProps<typeof TagHubView>> = {}) {
    return render(
      <TagHubView
        model={MODEL}
        selectedTagId="tag-1"
        onSelectTag={vi.fn()}
        query=""
        onQueryChange={vi.fn()}
        onOpenItem={vi.fn()}
        formatCount={formatCount}
        formatUnusedTags={formatUnusedTags}
        wide
        isLoading={false}
        labels={TAG_HUB_LABELS}
        editOpen
        onToggleEdit={vi.fn()}
        onEditTag={vi.fn()}
        onEditChange={vi.fn()}
        onEditSave={vi.fn()}
        onDeleteTag={vi.fn()}
        onCreateTag={vi.fn()}
        {...over}
      />,
    );
  }

  it("floors the rail's add button", () => {
    renderHub();
    expectNarrowFloor(
      screen.getByRole("button", { name: TAG_HUB_LABELS.addButton }),
      "h-7",
    );
  });

  it("floors save, delete and the two colour buttons in the edit block", () => {
    renderHub();

    expectNarrowFloor(
      screen.getByRole("button", { name: TAG_HUB_LABELS.edit.save }),
      "h-7",
    );
    expect(
      screen.getByRole("button", { name: TAG_HUB_LABELS.deleteTag }),
    ).toHaveClass("max-md:min-h-11");
    // The two 28px buttons beside the swatch grid are the shortest controls in
    // the block, so they carry the floor explicitly rather than inheriting one.
    expect(
      screen.getByRole("button", { name: TAG_HUB_LABELS.edit.colorDefault }),
    ).toHaveClass("max-md:min-h-11");
    expect(
      screen.getByLabelText(TAG_HUB_LABELS.edit.colorCustom).closest("label"),
    ).toHaveClass("max-md:min-h-11");
  });

  it("floors the icon strip's glyphs and the Show more button (#2389)", () => {
    renderHub();
    // The strip's glyphs are 32px boxes and the button under them is a text
    // row, so both carry the floor explicitly (the old single trigger did too).
    const strip = screen.getByRole("group", {
      name: TAG_HUB_LABELS.edit.iconLabel,
    });
    for (const cell of strip.children) {
      expect(cell).toHaveClass("max-md:h-11", "max-md:w-11");
    }
    expect(
      screen.getByRole("button", { name: TAG_HUB_LABELS.edit.iconMore }),
    ).toHaveClass("max-md:min-h-11");
  });

  it("floors the row menu on BOTH axes on narrow — it is icon-only", () => {
    renderHub({ wide: false, selectedTagId: null });
    const menu = screen.getByRole("button", {
      name: `work: ${TAG_HUB_LABELS.rowMenu}`,
    });
    // Painted at 44 rather than floored: on narrow there is no hover to reveal
    // it with, so the control is full size from the start (M2).
    expect(menu).toHaveClass("h-11", "w-full");
  });

  it("floors the narrow-only back link", () => {
    mockMatchMedia(false);
    renderHub({ wide: false });

    expect(screen.getByRole("button", { name: TAG_HUB_LABELS.back })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
  });

  it("leaves a ColorPicker that asked for nothing unchanged", () => {
    render(
      <ColorPicker
        label="Color"
        clearLabel="No color"
        customLabel="Custom"
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Color" })).not.toHaveClass(
      "max-md:min-h-11",
    );
  });
});

describe("#2517 — the Schedule, Profile and attachment-cleanup cards", () => {
  const SCHEDULE_LABELS = {
    heading: "Schedule",
    description: "How the calendar opens.",
    initialViewLabel: "Opens on",
    week: "Week",
    month: "Month",
    hint: "Desktop only.",
    reminderLabel: "Reminders",
    reminderDescription: "Notify before an event starts.",
    reminderDefaultLabel: "Default lead time",
    reminderDefaultHint: "Applies to new events.",
    reminderDesktopHint: "Desktop only.",
    holidayHeading: "Holidays",
    holidayDescription: "Public holidays are drawn as all-day items.",
    holidayColorLabel: "Holiday colour",
    holidayColorClear: "Default colour",
    holidayColorCustom: "Custom colour",
    holidayVisibleLabel: "Show holidays on the calendar",
  };

  function renderSchedule() {
    return render(
      <SettingsSchedule
        initialView="week"
        onInitialViewChange={vi.fn()}
        remindersEnabled
        onRemindersEnabledChange={vi.fn()}
        defaultLeadMinutes={10}
        onDefaultLeadMinutesChange={vi.fn()}
        leadOptions={[{ value: 10, label: "10 min" }]}
        holidayColor="#e03e3e"
        onHolidayColorChange={vi.fn()}
        defaultHolidayColor="#e03e3e"
        holidaysShown
        onHolidaysShownChange={vi.fn()}
        labels={SCHEDULE_LABELS}
      />,
    );
  }

  it("widens the two switches' hit area on narrow without redrawing the track", () => {
    renderSchedule();

    for (const name of [
      SCHEDULE_LABELS.reminderLabel,
      SCHEDULE_LABELS.holidayVisibleLabel,
    ]) {
      const track = screen.getByRole("switch", { name });
      // The track itself stays 36x20 on every width — the floor is a
      // transparent ::after, and only on narrow.
      expect(track).toHaveClass("relative", "h-5", "w-9");
      expect(track).toHaveClass(
        "max-md:after:h-[44px]",
        "max-md:after:w-[44px]",
        "max-md:after:content-['']",
      );
      expect(track).not.toHaveClass("min-h-11");
      expect(track).not.toHaveClass("max-md:min-h-11");
      // Unprefixed `after:` would also grow the Desktop hit area.
      for (const cls of Array.from(track.classList)) {
        expect(cls.startsWith("after:")).toBe(false);
      }
    }
  });

  it("floors the holiday colour trigger and the lead-time select", () => {
    renderSchedule();

    const trigger = screen.getByRole("button", {
      name: SCHEDULE_LABELS.holidayColorLabel,
    });
    expect(trigger).toHaveClass("max-md:min-h-11", "py-0.5");
    expect(trigger).not.toHaveClass("min-h-11");

    const select = screen.getByRole("combobox", {
      name: SCHEDULE_LABELS.reminderDefaultLabel,
    });
    expect(select).toHaveClass("max-md:min-h-11", "py-2");
    expect(select).not.toHaveClass("min-h-11");
  });

  it("floors the display-name field and leaves its Desktop height", () => {
    render(
      <SettingsProfile
        displayName=""
        onDisplayNameChange={vi.fn()}
        email="a@example.com"
        error={null}
        notice={null}
        busy={false}
        onSubmit={vi.fn()}
        labels={{
          heading: "Profile",
          description: "How you appear.",
          displayNameLabel: "Display name",
          displayNameHelper: "Shown in the sidebar.",
          emailLabel: "Signed in as",
          submit: "Save",
          busy: "Saving…",
        }}
      />,
    );

    expectNarrowFloor(screen.getByLabelText("Display name"), "h-9");
  });

  it("floors the scan and delete-all buttons of the attachment sweep", () => {
    render(
      <AttachmentCleanupPanel
        labels={{
          heading: "Unused files",
          description: "Find files no note uses.",
          scan: "Find unused files",
          scanning: "Scanning…",
          rescan: "Scan again",
          summary: "1 of 2 files is unused.",
          nothing: "Nothing to delete.",
          deleteAll: "Delete 1 file",
          deleting: "Deleting…",
          listLabel: "Unused files",
          confirmMessage: "Delete 1 file?",
          confirmLabel: "Delete",
          cancelLabel: "Cancel",
        }}
        scan={{
          orphans: [{ path: "uid/a.png", size: 10, uploadedAt: null }],
          scanned: 2,
          referenced: 1,
          recent: 0,
        }}
        status="idle"
        error={null}
        outcome={null}
        onScan={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    for (const name of ["Scan again", "Delete 1 file"]) {
      expectNarrowFloor(screen.getByRole("button", { name }), "h-7");
    }
  });
});
