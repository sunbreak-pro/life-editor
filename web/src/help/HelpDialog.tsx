import {
  Button,
  HelpPanel,
  Modal,
  useTranslation,
  type HelpContactItem,
  type HelpFaqItem,
} from "@life-editor/shared";
import { operatorContactLinks } from "../legal/operator";

/*
 * Help, FAQ and contact (#1989) — one dialog, two doors: the Help card in
 * Settings and the "Need help?" line under the sign-in card.
 *
 * The contacts come from `operatorContactLinks()`, i.e. from operator.ts, the
 * same record the policy and the terms quote. The FAQ is copy only; its
 * answers name the screens by the labels those screens use.
 *
 * `onOpenTutorial` is passed only from Settings. The sign-in screen has no
 * app behind it for a tour to walk, so that section is left out there.
 */

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenTutorial?: () => void;
}

export function HelpDialog({ open, onClose, onOpenTutorial }: HelpDialogProps) {
  const { t } = useTranslation();

  const faq: HelpFaqItem[] = [
    {
      question: t("help.faq.confirmEmail.question"),
      answer: t("help.faq.confirmEmail.answer"),
    },
    {
      question: t("help.faq.password.question"),
      answer: t("help.faq.password.answer"),
    },
    {
      question: t("help.faq.export.question"),
      answer: t("help.faq.export.answer"),
    },
    {
      question: t("help.faq.deleteAccount.question"),
      answer: t("help.faq.deleteAccount.answer"),
    },
  ];

  const contacts: HelpContactItem[] = operatorContactLinks().map((link) => {
    switch (link.kind) {
      case "email":
        return {
          id: link.id,
          href: link.href,
          label: t("help.contact.email"),
        };
      case "form":
        return {
          id: link.id,
          href: link.href,
          label: t("help.contact.form"),
        };
      case "github":
        return {
          id: link.id,
          href: link.href,
          label: t("help.contact.github"),
          note: t("help.contact.githubNote"),
        };
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("help.title")}
      size="lg"
      fitViewport
    >
      <HelpPanel
        faq={faq}
        contacts={contacts}
        onOpenTutorial={onOpenTutorial}
        labels={{
          tutorialHeading: t("help.tutorial.heading"),
          tutorialDescription: t("help.tutorial.description"),
          tutorialButton: t("help.tutorial.button"),
          faqHeading: t("help.faq.heading"),
          contactHeading: t("help.contact.heading"),
          contactDescription: t("help.contact.description"),
          opensExternally: t("help.opensExternally"),
        }}
      />
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </Modal>
  );
}
