import type { SafetyFlag } from '../types';
import type { TKey } from '../../i18n/types';

/**
 * Lightweight, advisory safety scanning for parent-to-parent messages.
 *
 * Three design constraints, all deliberate:
 *
 *  1. **Advisory, never auto-punitive.** A flag shows the sender a gentle prompt and
 *     attaches context to a report if one is later filed. It never blocks a message,
 *     never notifies the other family, and never changes an account state. Automated
 *     judgement about parents talking to parents is wrong often enough that acting on
 *     it unilaterally would do more harm than the behaviour it catches.
 *
 *  2. **Patterns, not people.** This matches text shapes — a phone number, a push to
 *     move off-platform — and has no model of who the sender is. There is no profiling,
 *     no cross-conversation behavioural scoring, no shadow risk file on a family.
 *
 *  3. **Heuristics are a floor, not a ceiling.** In production this belongs behind a
 *     proper classifier with human review. The value here is that the *seams* exist:
 *     the scan runs in the domain layer, its output is a typed `SafetyFlag[]`, and
 *     swapping the implementation changes nothing else.
 */

interface Rule {
  kind: SafetyFlag['kind'];
  severity: SafetyFlag['severity'];
  test: RegExp;
  messageKey: TKey;
}

const RULES: Rule[] = [
  {
    kind: 'contact_details_shared',
    severity: 'caution',
    // Loose phone-number shape: 9+ digits with common separators.
    test: /(?:\+?\d[\d\s\-().]{8,}\d)/,
    messageKey: 'scan.phone',
  },
  {
    kind: 'contact_details_shared',
    severity: 'caution',
    test: /[\w.+-]+@[\w-]+\.[\w.]{2,}/,
    messageKey: 'scan.email',
  },
  {
    kind: 'off_platform_move',
    severity: 'caution',
    test: /\b(whats\s?app|telegram|signal|snapchat|instagram|insta|tiktok|facebook|messenger|discord)\b/i,
    messageKey: 'scan.offPlatform',
  },
  {
    kind: 'address_shared',
    severity: 'high',
    test: /\b\d{1,4}\s+[A-Za-z][A-Za-z'.-]*\s+(street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|way|derech|rehov)\b/i,
    messageKey: 'scan.address',
  },
  {
    kind: 'unsupervised_suggestion',
    severity: 'high',
    test: /\b(drop\s?(them|him|her|the kids?)?\s?off\s+and\s+(go|leave)|leave\s+(them|him|her|the kids?)\s+with\s+me|no\s+need\s+for\s+you\s+to\s+(come|stay)|you\s+don'?t\s+need\s+to\s+stay)\b/i,
    messageKey: 'scan.unsupervised',
  },
  {
    kind: 'pressure_language',
    severity: 'high',
    test: /\b(don'?t\s+tell|keep\s+(this|it)\s+(a\s+)?secret|between\s+us|our\s+little\s+secret|delete\s+(this|these)\s+messages?)\b/i,
    messageKey: 'scan.secrecy',
  },
  {
    kind: 'child_direct_contact',
    severity: 'high',
    test: /\b(give\s+me\s+(your\s+)?(child|kid|son|daughter)'?s?\s+(number|phone|email|username|account)|can\s+I\s+(message|text|call|add)\s+(your\s+)?(child|kid|son|daughter)|(child|kid|son|daughter)'?s?\s+own\s+(phone|account|number))\b/i,
    messageKey: 'scan.childContact',
  },
];

/**
 * Scan a message body. Returns an empty array for the overwhelming majority of normal
 * messages — the goal is a quiet product, not a nagging one.
 */
export function scanMessage(body: string): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    if (rule.test.test(body)) {
      const key = `${rule.kind}:${rule.severity}`;
      if (seen.has(key)) continue;
      seen.add(key);
      flags.push({ kind: rule.kind, severity: rule.severity, messageKey: rule.messageKey });
    }
  }

  return flags;
}

/** Highest severity present, for choosing how prominently to surface the prompt. */
export function peakSeverity(flags: SafetyFlag[]): SafetyFlag['severity'] | null {
  if (flags.some((f) => f.severity === 'high')) return 'high';
  if (flags.some((f) => f.severity === 'caution')) return 'caution';
  if (flags.length > 0) return 'info';
  return null;
}

/** Safety guidance, as key pairs. The UI renders `t(titleKey)` / `t(bodyKey)`. */
export const SAFETY_TIPS: Array<{ titleKey: TKey; bodyKey: TKey }> = [
  { titleKey: 'tip.public.title', bodyKey: 'tip.public.body' },
  { titleKey: 'tip.stay.title', bodyKey: 'tip.stay.body' },
  { titleKey: 'tip.tell.title', bodyKey: 'tip.tell.body' },
  { titleKey: 'tip.onPlatform.title', bodyKey: 'tip.onPlatform.body' },
  { titleKey: 'tip.noExplanation.title', bodyKey: 'tip.noExplanation.body' },
  { titleKey: 'tip.instinct.title', bodyKey: 'tip.instinct.body' },
];

/** Report reasons, ordered by how we want them presented. Urgent first. */
export const REPORT_REASONS: Array<{ id: string; urgent?: boolean }> = [
  { id: 'child_safety_urgent', urgent: true },
  { id: 'suspicious_behavior' },
  { id: 'fake_identity' },
  { id: 'harassment' },
  { id: 'inappropriate_messages' },
  { id: 'misrepresentation' },
  { id: 'unwanted_contact' },
  { id: 'inappropriate_content' },
  { id: 'safety_concern' },
];

export function reportLabelKey(reason: string): TKey {
  return `report.${reason}.label` as TKey;
}

export function reportDescKey(reason: string): TKey {
  return `report.${reason}.desc` as TKey;
}
