import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ColorPicker,
  PasswordUpdateForm,
  SettingsAccount,
  SettingsLegal,
  SettingsReset,
  SettingsTabsNav,
  SettingsTutorial,
  TagEditModal,
  TrashView,
  type SettingsAccountLabels,
  type TagEditRow,
  type TrashGroup,
  type TrashViewLabels,
} from "../src/components";
import { TAG_LABELS, selectTagRow } from "./tagEditLabels";

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

describe("#1562 — the tag edit panel", () => {
  const ROWS: TagEditRow[] = [
    {
      id: "tag-1",
      name: "work",
      color: null,
      icon: null,
      count: 1,
      items: [
        {
          assignmentId: "a1",
          itemId: "task-1",
          role: "task",
          title: "Buy milk",
        },
      ],
    },
  ];

  function renderPanel() {
    return render(
      <TagEditModal
        open
        onClose={vi.fn()}
        tags={ROWS}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onSetColor={vi.fn()}
        onSetIcon={vi.fn()}
        onUnassign={vi.fn()}
        formatCount={(count) => `${count} items`}
        labels={TAG_LABELS}
      />,
    );
  }

  it("floors the add button", () => {
    renderPanel();
    expectNarrowFloor(
      screen.getByRole("button", { name: TAG_LABELS.addButton }),
      "h-7",
    );
  });

  it("floors save, delete and the color trigger in the editor pane", () => {
    renderPanel();
    selectTagRow("work");

    expectNarrowFloor(
      screen.getByRole("button", { name: TAG_LABELS.saveLabel }),
      "h-7",
    );
    expect(
      screen.getByRole("button", { name: TAG_LABELS.deleteLabel }),
    ).toHaveClass("max-md:min-h-11");
    // The color pill is 24px tall — the shortest control on the panel. It is
    // reached through an opt-in prop rather than a change to ColorPicker
    // itself, because the wikitag row draws the same picker and did not ask.
    expect(
      screen.getByRole("button", { name: TAG_LABELS.colorLabel }),
    ).toHaveClass("max-md:min-h-11");
  });

  it("floors the per-item unassign on BOTH axes — it is icon-only", () => {
    renderPanel();
    selectTagRow("work");

    const unassign = screen.getByRole("button", {
      name: `${TAG_LABELS.unassignLabel}: Buy milk`,
    });
    expect(unassign).toHaveClass("max-md:min-h-11", "max-md:min-w-11");
    // A label alone cannot buy the width back the way a text button does.
    expect(unassign).toHaveClass("max-md:inline-flex");
  });

  it("floors the narrow-only back link", () => {
    mockMatchMedia(false);
    renderPanel();
    selectTagRow("work");

    expect(
      screen.getByRole("button", { name: TAG_LABELS.backLabel }),
    ).toHaveClass("max-md:min-h-11");
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
