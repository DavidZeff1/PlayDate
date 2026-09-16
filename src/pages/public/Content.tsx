import { Link } from 'react-router-dom';
import { Alert, PrototypeNote } from '../../components/ui';
import { SAFETY_TIPS } from '../../domain/safety/contentScan';
import {
  IconArrowRight,
  IconCheck,
  IconEyeOff,
  IconGavel,
  IconLock,
  IconShieldCheck,
  IconUsers,
} from '../../components/ui/Icons';

/* ========================================================================== */
/* How it works                                                                */
/* ========================================================================== */

export function HowItWorks() {
  return (
    <div className="section section-narrow">
      <span className="eyebrow">How it works</span>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 'var(--sp-3)' }}>
        From signing up to a first playdate
      </h1>
      <p className="hero-lede" style={{ marginBottom: 'var(--sp-10)' }}>
        Every step below exists because of the one before it. Verification comes before
        discovery, discovery comes before contact, and contact comes before any detail is
        shared. That order is the product.
      </p>

      <div className="stack stack-10">
        <Phase
          number="1"
          title="Create your parent account"
          items={[
            ['Email and phone', 'Both are verified with a code before anything else happens.'],
            ['A strong password', 'We check length and strength, and reject common passwords.'],
            ['Two-factor authentication', 'Optional at signup, strongly encouraged, and shown as a trust signal to other families.'],
          ]}
        />

        <Phase
          number="2"
          title="Verify your identity"
          items={[
            [
              'A third-party identity check',
              'Your ID document goes to the verification provider, never to PlayDate. We store only a decision and an opaque reference.',
            ],
            [
              'Four honest states',
              'Verified, pending, failed, or required. We never show "verified" for a check that has not completed.',
            ],
            [
              'This is a gate, not a badge',
              'Until it says verified, you cannot browse families or send a single request.',
            ],
          ]}
        />

        <Phase
          number="3"
          title="Build your family profile"
          items={[
            ['One profile per family', 'Not one per child. The family is the unit — "The Cohen Family", not "Noa, 8".'],
            ['Add your children', 'First name or a nickname, age, and what they like doing. No surnames, no schools, no dates of birth.'],
            [
              'Rate what matters',
              'For each interest you set two things: how much your child enjoys it, and how important it is to you when matching. LEGO can be critical while football is a slight preference.',
            ],
            ['Set your limits', 'How far you will travel, acceptable age gap, when you are free, how you like to meet.'],
          ]}
        />

        <Phase
          number="4"
          title="Choose what others can see"
          items={[
            ['Location', 'Hidden, general area, neighbourhood, or an approximate distance band. Never an address.'],
            ['Children\'s names', 'Hidden, first name, or a nickname. Never a surname.'],
            ['Ages', 'Exact, or a band like "7–9".'],
            ['Photos', 'Off by default. If you turn them on, you can require a separate consent step before another family sees them.'],
          ]}
        />

        <Phase
          number="5"
          title="Discover compatible families"
          items={[
            [
              'A pool, not a winner',
              'The goal is many carefully filtered families, so you can use your own judgement — not one algorithmic "perfect match".',
            ],
            [
              'Hard limits are filters, not penalties',
              'Families outside your travel radius, age range, or with no overlapping free time are removed, not ranked last. You will not be shown families you cannot actually meet.',
            ],
            [
              'Every match is explained',
              'Which children might pair up, how many interests overlap, which of those you marked critical, the distance band, and when your afternoons coincide.',
            ],
          ]}
        />

        <Phase
          number="6"
          title="Agree to connect"
          items={[
            ['One short request', 'A single note — not a message thread. Someone you decline cannot keep writing to you.'],
            ['Four responses', 'Accept, decline, maybe later, or report.'],
            [
              'Declining is silent',
              'The other family sees only that the request is no longer pending. Not that you said no, and never why.',
            ],
          ]}
        />

        <Phase
          number="7"
          title="Talk, parent to parent"
          items={[
            ['Two parents, one thread', 'There is no child-to-child messaging on PlayDate, and there never will be.'],
            ['Report, block or leave', 'Available in every conversation, at any time, without explanation.'],
            [
              'A quiet nudge when it helps',
              'If a message contains a phone number or pushes to move to another app, we show the sender a gentle prompt. We do not block the message and we do not tell the other family.',
            ],
          ]}
        />

        <Phase
          number="8"
          title="Plan the first meeting"
          items={[
            ['Somewhere public', 'Playgrounds, parks, community centres. You never have to disclose your home address.'],
            ['An adult stays', 'Both parents confirm someone will be there. It is a normal part of the form, not a warning.'],
            ['Tell someone else', 'Optionally record that you shared the plan with another trusted adult.'],
            ['Afterwards', 'A short private check-in. Only you see what you write.'],
          ]}
        />
      </div>

      <div style={{ marginTop: 'var(--sp-12)' }}>
        <Link to="/signup" className="btn btn-primary btn-lg">
          Create a family account
          <IconArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}

function Phase({
  number,
  title,
  items,
}: {
  number: string;
  title: string;
  items: Array<[string, string]>;
}) {
  return (
    <section>
      <div className="row row-4" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="step-num">{number}</div>
        <h2 style={{ fontSize: 'var(--text-xl)' }}>{title}</h2>
      </div>
      <div className="stack stack-4" style={{ paddingLeft: 'calc(36px + var(--sp-4))' }}>
        {items.map(([label, body]) => (
          <div key={label}>
            <div className="strong">{label}</div>
            <p className="muted" style={{ marginTop: 2 }}>
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Safety                                                                      */
/* ========================================================================== */

export function SafetyPage() {
  return (
    <div className="section section-narrow">
      <span className="eyebrow">
        <IconShieldCheck size={13} />
        Safety
      </span>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 'var(--sp-3)' }}>
        Safety is the architecture, not a policy page
      </h1>
      <p className="hero-lede">
        This platform involves children, so the protections are built into how the system
        works rather than added as rules people are asked to follow. Here is what that means
        in practice.
      </p>

      <div className="stack stack-10" style={{ marginTop: 'var(--sp-10)' }}>
        <section>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>
            The hierarchy we will not break
          </h2>
          <div className="card card-pad">
            <div
              className="row row-wrap small strong"
              style={{ gap: 'var(--sp-3)', color: 'var(--brand-700)' }}
            >
              <span className="pill pill-strong">Verified parent</span>
              <IconArrowRight size={14} />
              <span className="pill pill-strong">Family profile</span>
              <IconArrowRight size={14} />
              <span className="pill pill-strong">Controlled discovery</span>
              <IconArrowRight size={14} />
              <span className="pill pill-strong">Mutual consent</span>
              <IconArrowRight size={14} />
              <span className="pill pill-strong">Parent-to-parent contact</span>
            </div>
            <p className="muted" style={{ marginTop: 'var(--sp-5)' }}>
              Every arrow is a gate that has to be passed. There is no path through this
              diagram that lets an unverified adult reach information about someone else's
              child, and no path at all that reaches a child directly — children are
              dependents on a family record, not users of the service.
            </p>
          </div>
        </section>

        <section id="meeting">
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>
            Meeting safely
          </h2>
          <div className="stack stack-3">
            {SAFETY_TIPS.map((t) => (
              <div key={t.title} className="card card-pad">
                <div className="row row-3" style={{ alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--ok-500)', marginTop: 2, flexShrink: 0 }}>
                    <IconCheck size={16} />
                  </span>
                  <div>
                    <div className="strong">{t.title}</div>
                    <p className="muted small" style={{ marginTop: 2 }}>
                      {t.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="reporting">
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>
            Reporting and blocking
          </h2>
          <div className="stack stack-4">
            <Alert tone="info" title="A report opens a case for a person to read.">
              It does not automatically restrict anyone, it does not appear on anybody's
              profile, and the family you report is not told that a report exists. Telling them
              would invite retaliation and give them time to delete evidence.
            </Alert>

            <div className="card card-pad">
              <div className="strong" style={{ marginBottom: 'var(--sp-3)' }}>
                What happens next
              </div>
              <div className="row row-wrap small" style={{ gap: 'var(--sp-3)' }}>
                <span className="pill">Report received</span>
                <IconArrowRight size={13} />
                <span className="pill">Case opened</span>
                <IconArrowRight size={13} />
                <span className="pill">Human review</span>
                <IconArrowRight size={13} />
                <span className="pill">Decision recorded</span>
              </div>
              <p className="muted small" style={{ marginTop: 'var(--sp-4)' }}>
                Possible outcomes are: no action, a warning, required re-verification,
                a temporary restriction, suspension, or a permanent ban. Every decision is
                written down with a reason, by a named reviewer, in an audit log.
              </p>
            </div>

            <div className="card card-pad">
              <div className="strong" style={{ marginBottom: 'var(--sp-2)' }}>
                Blocking is separate and immediate
              </div>
              <p className="muted small">
                You do not need a reason and nothing is reviewed. A block closes any
                conversation, withdraws any pending request, and removes each family from the
                other's results — in both directions. The other family is not told.
              </p>
            </div>

            <Alert tone="warn" title="PlayDate is not an emergency service.">
              If a child is in immediate danger, contact your local emergency services first.
              Report to us afterwards.
            </Alert>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>
            What we do about abuse
          </h2>
          <div className="stack stack-3">
            <Row
              icon={<IconLock size={17} />}
              title="Rate limits on contact"
              body="Connection requests are deliberately scarce. A genuine parent sends a handful a week; someone sending hundreds hits a wall quickly."
            />
            <Row
              icon={<IconEyeOff size={17} />}
              title="Limits on browsing"
              body="Discovery is rate-limited too, which caps how much of the community any one account can enumerate."
            />
            <Row
              icon={<IconUsers size={17} />}
              title="Grouped reports"
              body="Several reports about the same family become one case, so a pattern across different reporters is visible as a pattern."
            />
            <Row
              icon={<IconGavel size={17} />}
              title="Audited staff access"
              body="A moderator reading a reported conversation needs an open case, and that read is logged against the case. Our own staff are least-privilege too — a verification agent sees identity decisions and nothing else."
            />
          </div>
        </section>

        <PrototypeNote>
          The protections described here are implemented in this prototype's code, but the
          prototype has not been penetration-tested, audited, or legally reviewed, and
          identity verification is simulated. Treat this page as a description of the design,
          not a certification.
        </PrototypeNote>
      </div>
    </div>
  );
}

function Row({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card card-pad">
      <div className="row row-4" style={{ alignItems: 'flex-start' }}>
        <div className="feature-icon" style={{ width: 34, height: 34 }}>
          {icon}
        </div>
        <div>
          <div className="strong">{title}</div>
          <p className="muted small" style={{ marginTop: 2 }}>
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Privacy                                                                     */
/* ========================================================================== */

export function PrivacyPage() {
  return (
    <div className="section section-narrow">
      <span className="eyebrow">
        <IconLock size={13} />
        Privacy
      </span>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 'var(--sp-3)' }}>
        Collect the minimum. Protect it strongly. Show as little as possible.
      </h1>
      <p className="hero-lede">
        Two kinds of information exist in PlayDate, and they are kept apart on purpose.
      </p>

      <div className="stack stack-10" style={{ marginTop: 'var(--sp-10)' }}>
        <section id="data">
          <div className="compare">
            <div className="compare-col" style={{ background: 'var(--surface)' }}>
              <h4 style={{ color: 'var(--danger-700)' }}>Private — never shown to other families</h4>
              <ul>
                {[
                  'Your legal name',
                  'Your date of birth',
                  'Your ID verification record',
                  'Your phone number',
                  'Your email address',
                  'Your home address, if ever collected',
                  'Your precise location',
                ].map((t) => (
                  <li key={t}>
                    <IconLock size={14} style={{ color: 'var(--danger-500)', flexShrink: 0, marginTop: 3 }} />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="small muted" style={{ marginTop: 'var(--sp-4)' }}>
                This data is reachable only by you, and by a reviewer acting on an open
                safety case — which is logged. It is stored in a separate record from your
                family profile, and there is no code path that copies it into anything another
                family can see.
              </p>
            </div>

            <div className="compare-col" style={{ background: 'var(--surface)' }}>
              <h4 style={{ color: 'var(--ok-700)' }}>Discovery — what other families may see</h4>
              <ul>
                {[
                  'Your family name, e.g. "The Cohen Family"',
                  'A general area, e.g. "Jerusalem area"',
                  'How many children you have',
                  'Their ages, exact or as a band',
                  'Their interests',
                  'Roughly when you are free',
                  'How you like to meet',
                ].map((t) => (
                  <li key={t}>
                    <IconCheck size={14} style={{ color: 'var(--ok-500)', flexShrink: 0, marginTop: 3 }} />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="small muted" style={{ marginTop: 'var(--sp-4)' }}>
                Every line here is something you control, and most of it can be narrowed
                further or switched off entirely in your privacy settings.
              </p>
            </div>
          </div>
        </section>

        <section id="children">
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>
            What we show about children
          </h2>
          <div className="card card-pad stack stack-5">
            <Control
              label="Names"
              options={['Hidden — shown as "Child 1"', 'First name only', 'A nickname you choose']}
              note="A child's surname is never shown to anyone, at any setting. Your family display name is the only surname on the platform."
            />
            <hr className="divider" />
            <Control
              label="Ages"
              options={['Exact age, e.g. "8 years old"', 'A band, e.g. "7–9 years old"']}
              note="We store an age in years, not a date of birth. There is no birthday to leak."
            />
            <hr className="divider" />
            <Control
              label="Photos"
              options={['Hidden — the default', 'Visible to connected families', 'Only after you approve each family']}
              note="Photos are off unless you turn them on, and are never visible to someone browsing."
            />
            <hr className="divider" />
            <Control
              label="Your notes about your child"
              options={['Only visible to families you have connected with']}
              note="Notes often contain identifying detail without meaning to — 'the school at the end of our road'. They are withheld from discovery entirely."
            />
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>Location</h2>
          <div className="card card-pad">
            <p className="muted">
              PlayDate never shows another family your address. It does not show them
              coordinates, and it does not show them an exact distance either — an exact
              distance from a known point is a circle, and three of those is a position.
            </p>
            <p className="muted" style={{ marginTop: 'var(--sp-4)' }}>
              What other families see is one of: nothing, your general area, your neighbourhood
              once you have connected, or a coarse band like "about 2–4 km away". You choose
              which.
            </p>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>
            What matching is allowed to use
          </h2>
          <div className="card card-pad">
            <p className="muted">
              Matching uses your children's ages and interests, your stated importance
              weights, distance, availability and playdate style. That is the complete list.
            </p>
            <p className="muted" style={{ marginTop: 'var(--sp-4)' }}>
              It does not use — and is designed so it cannot be made to use — religion,
              ethnicity, nationality, income, politics or disability. Interests come from a
              fixed catalogue rather than free text, so the matching surface cannot become a
              back door for sorting families by sensitive characteristics.
            </p>
          </div>
        </section>

        <Alert tone="warn" title="This prototype is not a compliant production system.">
          Children's privacy law varies by jurisdiction — GDPR and its national child-data
          provisions, COPPA, the UK Age Appropriate Design Code and others impose requirements
          on data minimisation, retention, parental consent, cross-border transfer and DPIAs.
          The architecture here is designed so those can be addressed per region, but legal
          review, a DPIA and a security audit are production requirements that have not been
          done.
        </Alert>
      </div>
    </div>
  );
}

function Control({ label, options, note }: { label: string; options: string[]; note: string }) {
  return (
    <div>
      <div className="strong" style={{ marginBottom: 'var(--sp-2)' }}>
        {label}
      </div>
      <div className="row row-wrap" style={{ gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        {options.map((o) => (
          <span key={o} className="pill">
            {o}
          </span>
        ))}
      </div>
      <p className="small muted">{note}</p>
    </div>
  );
}
