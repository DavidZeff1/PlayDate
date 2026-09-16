import { describe, it, expect } from 'vitest';
import { scanMessage, peakSeverity } from './contentScan';
import { passwordStrength, sanitiseText, validateEmail, validatePhone } from '../validation';
import { en } from '../../i18n/dict.en';

describe('message safety scanning', () => {
  it('stays quiet for ordinary messages', () => {
    // The most important property: a product that nags on normal conversation gets
    // ignored, and then the real warnings get ignored too.
    for (const body of [
      'Hi! Lovely to connect. Shall we meet at the playground on Saturday?',
      'Noa is really into LEGO at the moment — Yael sounds like a great match.',
      'We usually get there around 3pm. See you by the climbing frame.',
      'Sorry, we can\'t make Saturday. Would Friday afternoon work instead?',
      'Dani is 6 and Noa is 8, so we have a bit of an age range to juggle.',
    ]) {
      expect(scanMessage(body)).toEqual([]);
    }
  });

  it('flags a phone number', () => {
    const flags = scanMessage('My number is 054-123-4567 if it is easier.');
    expect(flags.some((f) => f.kind === 'contact_details_shared')).toBe(true);
  });

  it('emits message keys that exist in the dictionary', () => {
    // The nudge is shown to the sender, so it has to exist in their language.
    const samples = [
      'My number is 054-123-4567',
      'Write to me at a@b.com',
      'Shall we move to WhatsApp?',
      'We are at 14 Herzl Street',
      "Let's keep this between us",
      'Just drop them off and go',
      "Can I message your daughter directly?",
    ];
    for (const body of samples) {
      for (const flag of scanMessage(body)) {
        expect(en).toHaveProperty(flag.messageKey);
      }
    }
  });

  it('flags an email address', () => {
    const flags = scanMessage('Write to me at tamar@example.com');
    expect(flags.some((f) => f.kind === 'contact_details_shared')).toBe(true);
  });

  it('flags a push to move off-platform', () => {
    const flags = scanMessage('Shall we carry on over WhatsApp?');
    expect(flags.some((f) => f.kind === 'off_platform_move')).toBe(true);
  });

  it('flags a street address at high severity', () => {
    const flags = scanMessage('We are at 14 Herzl Street, come any time.');
    expect(flags.some((f) => f.kind === 'address_shared' && f.severity === 'high')).toBe(true);
  });

  it('flags requests for secrecy at high severity', () => {
    const flags = scanMessage("Let's keep this between us, don't tell anyone.");
    expect(flags.some((f) => f.kind === 'pressure_language' && f.severity === 'high')).toBe(true);
  });

  it('flags an attempt to reach a child directly', () => {
    const flags = scanMessage("Can I message your daughter directly? What's her number?");
    expect(flags.some((f) => f.kind === 'child_direct_contact')).toBe(true);
  });

  it('flags a push towards unsupervised contact', () => {
    const flags = scanMessage("Just drop them off and go, no need for you to stay.");
    expect(flags.some((f) => f.kind === 'unsupervised_suggestion')).toBe(true);
  });

  it('reports the highest severity present', () => {
    expect(peakSeverity(scanMessage('My number is 054-123-4567'))).toBe('caution');
    expect(peakSeverity(scanMessage("Keep this a secret"))).toBe('high');
    expect(peakSeverity(scanMessage('See you Saturday!'))).toBeNull();
  });

  it('does not duplicate a flag kind within one message', () => {
    const flags = scanMessage('Call 054-123-4567 or 052-765-4321');
    const contactFlags = flags.filter((f) => f.kind === 'contact_details_shared');
    expect(contactFlags.length).toBe(1);
  });
});

describe('sanitiseText', () => {
  it('strips control characters', () => {
    const dirty = `hello${String.fromCharCode(0)}${String.fromCharCode(7)}world`;
    expect(sanitiseText(dirty)).toBe('helloworld');
  });

  it('keeps tabs and newlines, which are legitimate in a note', () => {
    expect(sanitiseText('line one\nline two\tindented')).toBe('line one\nline two\tindented');
  });

  it('caps length', () => {
    expect(sanitiseText('x'.repeat(5000), 100)).toHaveLength(100);
  });

  it('trims trailing whitespace', () => {
    expect(sanitiseText('note   \n\n  ')).toBe('note');
  });

  it('leaves ordinary text, including accents and emoji, untouched', () => {
    const text = 'Noa adores LEGO 🧱 — and café visits';
    expect(sanitiseText(text)).toBe(text);
  });
});

describe('password strength', () => {
  it('rates a long passphrase highly', () => {
    expect(passwordStrength('correct horse battery staple').score).toBeGreaterThanOrEqual(3);
    expect(en).toHaveProperty(passwordStrength('correct horse battery staple').labelKey);
  });

  it('rejects anything containing a very common password', () => {
    expect(passwordStrength('MyPassword123!').score).toBe(0);
    expect(passwordStrength('playdate2024').score).toBe(0);
  });

  it('does not reward a short password just for having symbols', () => {
    // A meter that scores `P@ss1!` above a long passphrase would be actively harmful.
    expect(passwordStrength('P@ss1!').score).toBeLessThan(
      passwordStrength('correct horse battery staple').score,
    );
  });
});

describe('contact validation', () => {
  it('accepts normal email addresses and rejects malformed ones', () => {
    expect(validateEmail('maya@example.com')).toBeNull();
    expect(validateEmail('maya.cohen+playdate@example.co.uk')).toBeNull();
    expect(validateEmail('maya@')).not.toBeNull();
    expect(validateEmail('not an email')).not.toBeNull();
    expect(validateEmail('')).not.toBeNull();
  });

  it('returns translation keys rather than English sentences', () => {
    const err = validateEmail('not an email');
    expect(err?.key).toBe('val.email.invalid');
    expect(en).toHaveProperty(err!.key);
  });

  it('accepts phone numbers with common formatting', () => {
    expect(validatePhone('+972 50 123 4567')).toBeNull();
    expect(validatePhone('054-123-4567')).toBeNull();
    expect(validatePhone('123')).not.toBeNull();
  });
});
