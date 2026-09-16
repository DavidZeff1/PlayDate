import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services';
import { useApp } from '../../state/AppContext';
import { Avatar, Badge, PrototypeNote } from '../../components/ui';
import {
  IconCheck,
  IconClock,
  IconLock,
  IconMapPin,
  IconShieldCheck,
  IconSparkle,
  IconUsers,
  IconArrowRight,
  IconEyeOff,
  IconGavel,
  IconFilter,
} from '../../components/ui/Icons';

export function Landing() {
  const navigate = useNavigate();
  const { setSession } = useApp();

  const exploreDemo = async () => {
    const { session } = await api.signInAsDemo();
    setSession(session);
    navigate('/app');
  };

  return (
    <>
      {/* ================= Hero ================= */}
      <section className="hero">
        <div className="hero-inner">
          <div>
            <span className="eyebrow">
              <IconShieldCheck size={13} />
              Verified parents only
            </span>

            <h1>
              Help your children find friends —{' '}
              <span style={{ color: 'var(--brand-600)' }}>without handing over your family's details.</span>
            </h1>

            <p className="hero-lede">
              PlayDate connects families, not children. Parents create one family profile,
              choose exactly what other families can see, and only share more once both
              sides have said yes.
            </p>

            <div className="hero-actions">
              <Link to="/signup" className="btn btn-primary btn-lg">
                Create a family account
                <IconArrowRight size={17} />
              </Link>
              <button className="btn btn-secondary btn-lg" onClick={exploreDemo}>
                Explore the prototype
              </button>
            </div>

            <div className="hero-assurances">
              <span>
                <IconCheck size={14} style={{ color: 'var(--ok-500)' }} />
                Children never get accounts
              </span>
              <span>
                <IconCheck size={14} style={{ color: 'var(--ok-500)' }} />
                No addresses, ever
              </span>
              <span>
                <IconCheck size={14} style={{ color: 'var(--ok-500)' }} />
                Contact only by mutual consent
              </span>
            </div>

            <div style={{ marginTop: 'var(--sp-8)', maxWidth: 520 }}>
              <PrototypeNote>
                This is a working prototype with fictional families. Identity verification is{' '}
                <strong>simulated</strong>, not real, and no information here has been
                security-audited or legally reviewed.
              </PrototypeNote>
            </div>
          </div>

          {/* A real discovery card, so the landing page shows the actual product rather
              than an illustration of it. */}
          <div className="hero-preview">
            <div className="hero-preview-back" aria-hidden="true" />
            <div className="hero-preview-card">
              <div className="row row-2 small" style={{ color: 'var(--ok-700)', fontWeight: 600, marginBottom: 'var(--sp-4)' }}>
                <IconSparkle size={14} />
                Strong potential match
              </div>

              <div className="row row-4" style={{ marginBottom: 'var(--sp-4)' }}>
                <Avatar name="Levi Family" color="var(--brand-600)" size="lg" square />
                <div>
                  <div className="strong" style={{ fontSize: 'var(--text-md)' }}>
                    The Levi Family
                  </div>
                  <div style={{ marginTop: 5 }}>
                    <Badge tone="ok">
                      <IconCheck size={11} /> Parent verified
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="row row-wrap small muted" style={{ gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
                <span className="row row-2">
                  <IconMapPin size={13} /> Jerusalem area
                </span>
                <span className="row row-2">
                  <IconUsers size={13} /> One child, age 8
                </span>
                <span className="row row-2">
                  <IconClock size={13} /> Weekend afternoons
                </span>
              </div>

              <ul className="reason-list" style={{ marginBottom: 'var(--sp-4)' }}>
                {[
                  'Children are the same age',
                  '4 shared interests',
                  'LEGO matters to both families',
                  'Availability overlaps on Saturday afternoons',
                ].map((r) => (
                  <li key={r} className="reason reason-positive">
                    <span className="reason-icon">
                      <IconCheck size={13} />
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>

              <div className="row row-wrap" style={{ gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
                {[
                  ['🧱', 'LEGO & building', true],
                  ['🎲', 'Board games', true],
                  ['🎨', 'Drawing', true],
                  ['🏊', 'Swimming', false],
                ].map(([emoji, label, shared]) => (
                  <span
                    key={label as string}
                    className={`interest-tag${shared ? ' interest-tag-shared' : ''}`}
                  >
                    <span aria-hidden="true">{emoji as string}</span>
                    {label as string}
                  </span>
                ))}
              </div>

              <div className="row row-3">
                <span className="btn btn-secondary btn-sm grow" style={{ cursor: 'default' }}>
                  View compatibility
                </span>
                <span className="btn btn-primary btn-sm grow" style={{ cursor: 'default' }}>
                  Send request
                </span>
              </div>

              <div className="panel small muted row row-3" style={{ marginTop: 'var(--sp-4)', alignItems: 'flex-start' }}>
                <IconLock size={13} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  Exact location, contact details and photos stay hidden until both families
                  agree to connect.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= The unit is the family ================= */}
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">The model</span>
          <h2>The account belongs to the parent. Always.</h2>
          <p>
            Most platforms start with a person and add safety on top. PlayDate starts with a
            verified family — children are dependents on that family, not users of a service.
            They have no login, no inbox, and no way to be contacted.
          </p>
        </div>

        <div className="feature-grid">
          <Feature
            icon={<IconShieldCheck size={20} />}
            title="Verified parents"
            body="Email, phone and government-ID verification before you can browse a single family. Verification is a gate, not a badge — unverified accounts cannot see other people's children at all."
          />
          <Feature
            icon={<IconEyeOff size={20} />}
            title="Controlled discovery"
            body="Browsing shows a limited profile: general area, children's ages, interests, rough availability. No address, no phone number, no school, no exact location — for anyone."
          />
          <Feature
            icon={<IconUsers size={20} />}
            title="Mutual consent"
            body="Nobody can message you out of the blue. A request is one short note; a conversation only opens when you accept. Declining is silent and costs you nothing."
          />
          <Feature
            icon={<IconFilter size={20} />}
            title="Matching you can steer"
            body="Tell us how much each thing matters — LEGO critical, football minor, same age critical. A shared interest you called critical counts for far more than a pile of small ones."
          />
          <Feature
            icon={<IconSparkle size={20} />}
            title="Explained, not scored"
            body="Never a bare '92% match'. You see why a family surfaced: the ages, the shared interests, the distance band, the overlapping afternoons — and you decide."
          />
          <Feature
            icon={<IconGavel size={20} />}
            title="Reports go to people"
            body="Reporting opens a case for a human reviewer. It never publicly marks anyone, and the family you report is never told. Blocking is separate, immediate and unilateral."
          />
        </div>
      </section>

      {/* ================= Language matters ================= */}
      <section className="section section-tight">
        <div className="section-head">
          <span className="eyebrow">How we talk about this</span>
          <h2>Families discovering families.</h2>
          <p>
            The language a product uses shapes how people behave in it. We will not build
            anything that makes a parent feel like they are shopping for children.
          </p>
        </div>

        <div className="compare">
          <div className="compare-col bad">
            <h4>Not this</h4>
            <ul>
              <li>
                <span aria-hidden="true">✕</span> "Find kids near you"
              </li>
              <li>
                <span aria-hidden="true">✕</span> "Match your child"
              </li>
              <li>
                <span aria-hidden="true">✕</span> "127 children in your area"
              </li>
              <li>
                <span aria-hidden="true">✕</span> Browsing children's photos
              </li>
              <li>
                <span aria-hidden="true">✕</span> Parents ranked by a trust score
              </li>
            </ul>
          </div>
          <div className="compare-col good">
            <h4>This</h4>
            <ul>
              <li>
                <span aria-hidden="true">✓</span> "Discover families your children may connect with"
              </li>
              <li>
                <span aria-hidden="true">✓</span> "Find compatible families"
              </li>
              <li>
                <span aria-hidden="true">✓</span> "12 families match your preferences"
              </li>
              <li>
                <span aria-hidden="true">✓</span> Interests and ages, photos only by consent
              </li>
              <li>
                <span aria-hidden="true">✓</span> Verified facts, listed plainly, never summed
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ================= Flow ================= */}
      <section className="section section-narrow">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>Five steps, in this order, on purpose.</h2>
        </div>

        <div className="steps">
          {[
            {
              title: 'Verify who you are',
              body: 'Email, phone, then identity. Nothing opens up until this is done — that is the whole point of the gate.',
            },
            {
              title: 'Build your family profile',
              body: 'Your children\'s ages and interests, how far you will travel, when you are free, and exactly what other families can see.',
            },
            {
              title: 'Discover compatible families',
              body: 'A large, filtered pool — not one "perfect match". Every family comes with the reasons it surfaced.',
            },
            {
              title: 'Both sides agree',
              body: 'Send a request. They accept, decline, or leave it. Only acceptance opens a conversation between the two parents.',
            },
            {
              title: 'Plan somewhere public',
              body: 'Choose an activity, a public meeting place and a time. Confirm an adult will be there. Tell another adult your plan if you want to.',
            },
          ].map((s, i) => (
            <div className="step" key={s.title}>
              <div className="step-num">{i + 1}</div>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'var(--sp-8)' }}>
          <Link to="/how-it-works" className="btn btn-secondary">
            Read the full walkthrough
            <IconArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ================= What we never do ================= */}
      <section className="section">
        <div className="card card-pad" style={{ background: 'var(--brand-800)', borderColor: 'transparent' }}>
          <div className="section-head" style={{ marginBottom: 'var(--sp-6)' }}>
            <span className="eyebrow" style={{ color: 'var(--brand-200)' }}>
              Commitments
            </span>
            <h2 style={{ color: '#fff', marginTop: 'var(--sp-2)' }}>What PlayDate will never do</h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 'var(--sp-5)',
            }}
          >
            {[
              'Give a child an account, a profile, or a way to be messaged.',
              'Show another family your street address or exact location.',
              'Show a child\'s full name to anyone outside your family.',
              'Let an unverified adult browse detailed information about children.',
              'Let anyone message you before you have agreed to connect.',
              'Rank parents publicly by a trust score.',
            ].map((t) => (
              <div key={t} className="row row-3" style={{ alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--brand-200)', marginTop: 2, flexShrink: 0 }}>
                  <IconCheck size={15} />
                </span>
                <span style={{ color: 'rgba(255,255,255,0.88)', fontSize: 'var(--text-base)', lineHeight: 1.55 }}>
                  {t}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="section section-tight">
        <div className="cta-band">
          <h2>Would you put your family's information into this?</h2>
          <p>
            That is the question we ask about every feature. If the answer is no, we redesign it.
            Have a look around and judge for yourself.
          </p>
          <div className="row row-3" style={{ justifyContent: 'center', marginTop: 'var(--sp-8)', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-lg" onClick={exploreDemo}>
              Explore the prototype
            </button>
            <Link
              to="/safety"
              className="btn btn-lg"
              style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}
            >
              Read our safety approach
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
