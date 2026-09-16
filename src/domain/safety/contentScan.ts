import type { SafetyFlag } from '../types';

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
  message: string;
}

const RULES: Rule[] = [
  {
    kind: 'contact_details_shared',
    severity: 'caution',
    // Loose phone-number shape: 9+ digits with common separators.
    test: /(?:\+?\d[\d\s\-().]{8,}\d)/,
    message:
      'This looks like a phone number. Keeping conversations on PlayDate means reports and blocking still work if something goes wrong.',
  },
  {
    kind: 'contact_details_shared',
    severity: 'caution',
    test: /[\w.+-]+@[\w-]+\.[\w.]{2,}/,
    message:
      'This looks like an email address. You can share contact details later — there is no rush before you have met.',
  },
  {
    kind: 'off_platform_move',
    severity: 'caution',
    test: /\b(whats\s?app|telegram|signal|snapchat|instagram|insta|tiktok|facebook|messenger|discord)\b/i,
    message:
      'Moving to another app early is common, but it means PlayDate can no longer help if there is a problem. Consider staying here until after you have met.',
  },
  {
    kind: 'address_shared',
    severity: 'high',
    test: /\b\d{1,4}\s+[A-Za-z][A-Za-z'.-]*\s+(street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|way|derech|rehov)\b/i,
    message:
      'This looks like a street address. We suggest not sharing your home address before a first meeting in a public place.',
  },
  {
    kind: 'unsupervised_suggestion',
    severity: 'high',
    test: /\b(drop\s?(them|him|her|the kids?)?\s?off\s+and\s+(go|leave)|leave\s+(them|him|her|the kids?)\s+with\s+me|no\s+need\s+for\s+you\s+to\s+(come|stay)|you\s+don'?t\s+need\s+to\s+stay)\b/i,
    message:
      'For a first meeting, we recommend both parents stay for the whole visit.',
  },
  {
    kind: 'pressure_language',
    severity: 'high',
    test: /\b(don'?t\s+tell|keep\s+(this|it)\s+(a\s+)?secret|between\s+us|our\s+little\s+secret|delete\s+(this|these)\s+messages?)\b/i,
    message:
      'Requests for secrecy are a recognised warning sign. If this message made you uncomfortable, you can report it — reports are reviewed by our safety team.',
  },
  {
    kind: 'child_direct_contact',
    severity: 'high',
    test: /\b(give\s+me\s+(your\s+)?(child|kid|son|daughter)'?s?\s+(number|phone|email|username|account)|can\s+I\s+(message|text|call|add)\s+(your\s+)?(child|kid|son|daughter)|(child|kid|son|daughter)'?s?\s+own\s+(phone|account|number))\b/i,
    message:
      'PlayDate does not support contacting another family\'s child directly, and asking for a child\'s contact details is against our safety rules. Please report this if it concerns you.',
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
      flags.push({ kind: rule.kind, severity: rule.severity, message: rule.message });
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

export const SAFETY_TIPS = [
  {
    title: 'Meet in a public place first',
    body: 'Playgrounds, parks and community centres let children play freely while both parents are present and comfortable.',
  },
  {
    title: 'Both parents stay for the first visit',
    body: 'A first playdate is as much about the parents meeting as the children. Drop-offs can come later, once you know each other.',
  },
  {
    title: 'Tell someone else your plan',
    body: 'Share the time and place with another adult you trust. PlayDate can do this for you when you confirm a playdate.',
  },
  {
    title: 'Keep conversations on PlayDate',
    body: 'If a conversation moves to another app, reporting and blocking no longer protect you. There is no hurry to swap numbers.',
  },
  {
    title: 'You never owe anyone an explanation',
    body: 'Decline, leave a conversation, or block at any time. The other family is not told why, and declining is never held against you.',
  },
  {
    title: 'Trust your instinct, then tell us',
    body: 'If something feels wrong — pressure, secrecy, too much interest in your child specifically — report it. Reports are reviewed by people, not bots.',
  },
];

export const REPORT_REASON_COPY: Record<
  string,
  { label: string; description: string; urgent?: boolean }
> = {
  child_safety_urgent: {
    label: 'Immediate concern for a child',
    description: 'Something that needs urgent review. Prioritised ahead of everything else.',
    urgent: true,
  },
  suspicious_behavior: {
    label: 'Suspicious behaviour',
    description: 'Pressure, secrecy, unusual interest in a child, or attempts to arrange unsupervised contact.',
  },
  fake_identity: {
    label: 'Fake or misleading identity',
    description: 'You believe this person is not who they say they are.',
  },
  harassment: {
    label: 'Harassment',
    description: 'Repeated unwanted contact, hostility, or intimidation.',
  },
  inappropriate_messages: {
    label: 'Inappropriate messages',
    description: 'Sexual, violent, or otherwise inappropriate content in a conversation.',
  },
  misrepresentation: {
    label: 'Profile misrepresentation',
    description: 'Their family profile does not reflect reality — wrong ages, invented children, misleading details.',
  },
  unwanted_contact: {
    label: 'Unwanted contact',
    description: 'They keep contacting you after you declined or left the conversation.',
  },
  safety_concern: {
    label: 'Other safety concern',
    description: 'Something that worried you during or after a playdate.',
  },
  inappropriate_content: {
    label: 'Inappropriate content',
    description: 'Photos, profile text, or other content that should not be on PlayDate.',
  },
};
