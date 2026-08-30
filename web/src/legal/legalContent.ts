/*
 * The privacy policy and terms, as data (#1198).
 *
 * Long-form legal prose does not belong in the i18n catalog: the catalog is a
 * flat map of UI strings, while a document is a shape — headings, ordered
 * paragraphs, bullet lists — that a JSON of loose sentences cannot keep
 * straight. So the documents live here, one entry per language, and only the
 * chrome around them (links, back button, consent line) goes through `t`.
 *
 * Every fact about who runs the service and where the data sits comes from
 * `./operator.ts`, so the two languages cannot drift apart on the part that
 * matters most.
 *
 * The wording is a DRAFT for the owner to approve (#1198 Gate 🛑).
 */
import { OPERATOR } from "./operator";

export type LegalDocumentId = "privacy" | "terms";

export interface LegalSection {
  heading: string;
  /** Body paragraphs, rendered in order. */
  paragraphs?: string[];
  /** Bullet list under the paragraphs. */
  bullets?: string[];
}

export interface LegalDocument {
  title: string;
  /** ISO date of the last revision, shown under the title. */
  updated: string;
  /** Lead paragraph above the first heading. */
  intro: string;
  sections: LegalSection[];
}

/** Last revision of BOTH documents. Bump it whenever the text changes. */
const UPDATED = "2026-08-30";

const ja: Record<LegalDocumentId, LegalDocument> = {
  privacy: {
    title: "プライバシーポリシー",
    updated: UPDATED,
    intro:
      "Life Editor（以下「本サービス」）は、個人が開発・提供している無料のツールです。本ポリシーは、本サービスが取得する情報とその取り扱いを説明します。",
    sections: [
      {
        heading: "1. 運営者と連絡先",
        bullets: [
          `運営者: ${OPERATOR.name}（個人）`,
          `連絡先: ${OPERATOR.contactUrl}`,
        ],
      },
      {
        heading: "2. 取得する情報",
        paragraphs: ["本サービスは次の情報を取得します。"],
        bullets: [
          "メールアドレス（アカウント作成・サインイン・パスワード再設定のため）",
          "利用者が本サービスに入力した内容（Todo・ノート・予定・デイリー記録・タグなど）",
          "サービスの提供に必要な最小限の技術情報（接続元 IP アドレス・アクセス日時などのアクセスログ。下記の委託先が自動的に記録するもの）",
        ],
      },
      {
        heading: "3. 利用目的",
        bullets: [
          "本サービスの提供・維持・不具合対応のためだけに利用します",
          "広告配信・行動ターゲティング・機械学習モデルの学習には利用しません",
          "法令に基づく開示要請を受けた場合を除き、第三者へ提供・販売しません",
        ],
      },
      {
        heading: "4. 保管先と委託先",
        paragraphs: [
          "本サービスは、データの保管と配信を次の事業者に委託しています。データベースと認証情報の保管先は、Supabase が利用する AWS 東京リージョン（ap-northeast-1・日本国内）です。アプリの配信は Cloudflare の世界各地の拠点を経由するため、配信の過程で利用者の情報が国外で処理されることがあります。",
        ],
        bullets: [
          "Supabase Inc.（データベース・認証 — AWS ap-northeast-1 / 東京）",
          "Cloudflare, Inc.（Cloudflare Workers によるアプリ配信 — 世界各地のエッジ拠点）",
          "各社の取り扱いについては、それぞれのプライバシーポリシーもあわせてご確認ください",
        ],
      },
      {
        heading: "5. Cookie・ブラウザ保存領域",
        paragraphs: [
          "サインイン状態の保持と表示設定（テーマ・言語など）のために、ブラウザの localStorage / sessionStorage を使用します。広告や解析を目的とした Cookie は使用していません。",
        ],
      },
      {
        heading: "6. データの削除",
        paragraphs: [
          "アカウントと保存した内容は、アプリの「設定 → アカウント」から利用者ご自身で完全に削除できます。削除はその場で実行され、取り消しはできません。何らかの理由でこの操作ができない場合は、上記の連絡先までご連絡ください。合理的な期間内に削除します。",
        ],
      },
      {
        heading: "7. 免責",
        bullets: [
          "本サービスは無料で提供され、可用性・完全性・特定目的への適合性を保証しません",
          "予告なく仕様変更・停止・終了する場合があります",
          "データの消失に備え、大切な内容は利用者ご自身でも控えを取ってください",
        ],
      },
      {
        heading: "8. 準拠法",
        paragraphs: ["本ポリシーの解釈および適用は、日本法に準拠します。"],
      },
      {
        heading: "9. 本ポリシーの改定",
        paragraphs: [
          "本ポリシーを変更する場合は、このページを更新し、冒頭の最終更新日を改めます。",
        ],
      },
    ],
  },
  terms: {
    title: "利用規約",
    updated: UPDATED,
    intro:
      "本規約は、Life Editor（以下「本サービス」）の利用条件を定めるものです。本サービスを利用した時点で、本規約に同意したものとみなします。",
    sections: [
      {
        heading: "1. 提供者",
        paragraphs: [
          `本サービスは ${OPERATOR.name}（個人）が無償で提供しています。お問い合わせは ${OPERATOR.contactUrl} で受け付けます。`,
        ],
      },
      {
        heading: "2. アカウント",
        bullets: [
          "アカウントの作成にはメールアドレスとパスワードが必要です",
          "パスワードは推測されにくいものを設定し、第三者に共有しないでください",
          "アカウントを通じて行われた操作の結果は、利用者ご自身の責任となります",
        ],
      },
      {
        heading: "3. 禁止事項",
        paragraphs: ["本サービスの利用にあたり、次の行為を禁止します。"],
        bullets: [
          "法令または公序良俗に反する行為",
          "他の利用者・第三者・運営者の権利を侵害する行為",
          "本サービスの運営を妨害する行為（過度な自動アクセス、脆弱性の悪用など）",
          "他人のアカウントを不正に利用する行為",
        ],
      },
      {
        heading: "4. サービスの変更・停止",
        paragraphs: [
          "本サービスは無償で提供されており、運営者は、利用者への事前の通知なく、内容の変更・提供の一時停止・終了を行うことができます。終了する場合は、可能な範囲で事前にお知らせし、データを取り出す期間を設けるよう努めます。",
        ],
      },
      {
        heading: "5. データの取り扱い",
        paragraphs: [
          "利用者が入力した内容の取り扱いは、プライバシーポリシーに従います。利用者が作成したコンテンツの権利は利用者に帰属し、運営者はサービスの提供に必要な範囲でのみこれを取り扱います。",
        ],
      },
      {
        heading: "6. 免責",
        bullets: [
          "本サービスは現状有姿で提供され、動作・可用性・データの保全について保証しません",
          "本サービスの利用または利用不能から生じた損害について、運営者は責任を負いません",
          "バックアップは利用者ご自身の責任で行ってください",
        ],
      },
      {
        heading: "7. 本規約の変更",
        paragraphs: [
          "運営者は本規約を変更することがあります。変更後の規約は、このページに掲載した時点から効力を生じます。",
        ],
      },
      {
        heading: "8. 準拠法・管轄",
        paragraphs: [
          "本規約は日本法に準拠します。本サービスに関して紛争が生じた場合は、東京地方裁判所を第一審の専属的合意管轄裁判所とします。",
        ],
      },
    ],
  },
};

const en: Record<LegalDocumentId, LegalDocument> = {
  privacy: {
    title: "Privacy Policy",
    updated: UPDATED,
    intro:
      "Life Editor (the “Service”) is a free tool built and run by one person. This policy explains what the Service collects and what happens to it.",
    sections: [
      {
        heading: "1. Who runs the Service",
        bullets: [
          `Operator: ${OPERATOR.name} (an individual)`,
          `Contact: ${OPERATOR.contactUrl}`,
        ],
      },
      {
        heading: "2. What is collected",
        paragraphs: ["The Service collects the following."],
        bullets: [
          "Your email address (to create the account, sign you in and reset your password)",
          "The content you enter (todos, notes, schedule entries, daily records, tags and so on)",
          "The minimum technical data needed to run the Service (access logs such as IP address and timestamp, recorded automatically by the processors listed below)",
        ],
      },
      {
        heading: "3. How it is used",
        bullets: [
          "Only to provide, maintain and debug the Service",
          "Never for advertising, behavioural targeting or training machine-learning models",
          "Never sold or shared with third parties, except where the law requires disclosure",
        ],
      },
      {
        heading: "4. Where it is stored",
        paragraphs: [
          "Storage and delivery are handled by the processors below. The database and authentication data are hosted in Supabase's AWS Tokyo region (ap-northeast-1, inside Japan). Application delivery runs through Cloudflare's worldwide network, so data may be processed outside Japan in transit.",
        ],
        bullets: [
          "Supabase Inc. (database and authentication — AWS ap-northeast-1, Tokyo)",
          "Cloudflare, Inc. (application delivery via Cloudflare Workers — edge locations worldwide)",
          "Please also read their own privacy policies for how they handle data",
        ],
      },
      {
        heading: "5. Cookies and browser storage",
        paragraphs: [
          "The Service uses your browser’s localStorage and sessionStorage to keep you signed in and to remember display preferences such as theme and language. No advertising or analytics cookies are used.",
        ],
      },
      {
        heading: "6. Deleting your data",
        paragraphs: [
          "You can delete your account and everything stored with it yourself, from Settings → Account in the app. It takes effect immediately and cannot be undone. If that is not available to you for any reason, contact the address above and it will be removed within a reasonable period.",
        ],
      },
      {
        heading: "7. No warranty",
        bullets: [
          "The Service is free and comes with no guarantee of availability, integrity or fitness for any purpose",
          "It may change, pause or shut down without notice",
          "Keep your own copy of anything you cannot afford to lose",
        ],
      },
      {
        heading: "8. Governing law",
        paragraphs: [
          "This policy is governed by and construed under the laws of Japan.",
        ],
      },
      {
        heading: "9. Changes to this policy",
        paragraphs: [
          "When this policy changes, this page is updated and the revision date at the top is changed with it.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: UPDATED,
    intro:
      "These terms govern the use of Life Editor (the “Service”). By using the Service you agree to them.",
    sections: [
      {
        heading: "1. Who provides the Service",
        paragraphs: [
          `The Service is provided free of charge by ${OPERATOR.name}, an individual. Enquiries are received at ${OPERATOR.contactUrl}.`,
        ],
      },
      {
        heading: "2. Your account",
        bullets: [
          "An email address and a password are required to create an account",
          "Choose a password that is hard to guess and do not share it",
          "You are responsible for what is done through your account",
        ],
      },
      {
        heading: "3. What you may not do",
        paragraphs: ["While using the Service, you may not:"],
        bullets: [
          "break the law or act against public order and morals",
          "infringe the rights of other users, third parties or the operator",
          "interfere with the running of the Service (excessive automated access, exploiting vulnerabilities and the like)",
          "use someone else’s account without permission",
        ],
      },
      {
        heading: "4. Changes and interruption",
        paragraphs: [
          "The Service is free, and the operator may change it, pause it or shut it down without prior notice. Should it shut down, reasonable effort will be made to announce it in advance and to leave a window for exporting your data.",
        ],
      },
      {
        heading: "5. Your content",
        paragraphs: [
          "What you enter is handled as described in the Privacy Policy. You keep the rights to the content you create; the operator handles it only as far as running the Service requires.",
        ],
      },
      {
        heading: "6. No warranty, no liability",
        bullets: [
          "The Service is provided as is, with no warranty of operation, availability or data preservation",
          "The operator is not liable for damages arising from use of, or inability to use, the Service",
          "Backups are your responsibility",
        ],
      },
      {
        heading: "7. Changes to these terms",
        paragraphs: [
          "These terms may be revised. A revision takes effect when it is published on this page.",
        ],
      },
      {
        heading: "8. Governing law and jurisdiction",
        paragraphs: [
          "These terms are governed by the laws of Japan. The Tokyo District Court has exclusive jurisdiction of the first instance over any dispute concerning the Service.",
        ],
      },
    ],
  },
};

export const LEGAL_DOCUMENTS: Record<
  "en" | "ja",
  Record<LegalDocumentId, LegalDocument>
> = { en, ja };

/**
 * Pick the document for the active i18next language. Anything that is not ja
 * falls back to en, matching the catalog's own `fallbackLng`.
 */
export function legalDocument(
  id: LegalDocumentId,
  language: string,
): LegalDocument {
  const locale = language.startsWith("ja") ? "ja" : "en";
  return LEGAL_DOCUMENTS[locale][id];
}
