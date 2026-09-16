import { Link } from 'react-router-dom';
import { Alert, PrototypeNote } from '../../components/ui';
import { SAFETY_TIPS } from '../../domain/safety/contentScan';
import { useT } from '../../i18n';
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
  const t = useT();
  return (
    <div className="section section-narrow">
      <span className="eyebrow">{t('nav.howItWorks')}</span>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 'var(--sp-3)' }}>
        {t('how.h1')}
      </h1>
      <p className="hero-lede" style={{ marginBottom: 'var(--sp-10)' }}>
        {t('how.lede')}
      </p>

      <div className="stack stack-10">
        <Phase
          number="1"
          title={t('how.p1.title')}
          items={[
            [t('how.p1.i1'), t('how.p1.i1b')],
            [t('how.p1.i2'), t('how.p1.i2b')],
            [t('how.p1.i3'), t('how.p1.i3b')],
          ]}
        />

        <Phase
          number="2"
          title={t('how.p2.title')}
          items={[
            [
              t('how.p2.i1'),
              t('how.p2.i1b'),
            ],
            [
              t('how.p2.i2'),
              t('how.p2.i2b'),
            ],
            [
              t('how.p2.i3'),
              t('how.p2.i3b'),
            ],
          ]}
        />

        <Phase
          number="3"
          title={t('landing.s2.title')}
          items={[
            [t('how.p3.i1'), t('how.p3.i1b')],
            [t('how.p3.i2'), t('how.p3.i2b')],
            [
              t('how.p3.i3'),
              t('how.p3.i3b'),
            ],
            [t('how.p3.i4'), t('how.p3.i4b')],
          ]}
        />

        <Phase
          number="4"
          title={t('how.p4.title')}
          items={[
            [t('how.p4.i1'), t('how.p4.i1b')],
            [t('how.p4.i2'), t('how.p4.i2b')],
            [t('how.p4.i3'), t('how.p4.i3b')],
            [t('how.p4.i4'), t('how.p4.i4b')],
          ]}
        />

        <Phase
          number="5"
          title={t('landing.s3.title')}
          items={[
            [
              t('how.p5.i1'),
              t('how.p5.i1b'),
            ],
            [
              t('how.p5.i2'),
              t('how.p5.i2b'),
            ],
            [
              t('how.p5.i3'),
              t('how.p5.i3b'),
            ],
          ]}
        />

        <Phase
          number="6"
          title={t('how.p6.title')}
          items={[
            [t('how.p6.i1'), t('how.p6.i1b')],
            [t('how.p6.i2'), t('how.p6.i2b')],
            [
              t('how.p6.i3'),
              t('how.p6.i3b'),
            ],
          ]}
        />

        <Phase
          number="7"
          title={t('how.p7.title')}
          items={[
            [t('how.p7.i1'), t('how.p7.i1b')],
            [t('how.p7.i2'), t('how.p7.i2b')],
            [
              t('how.p7.i3'),
              t('how.p7.i3b'),
            ],
          ]}
        />

        <Phase
          number="8"
          title={t('how.p8.title')}
          items={[
            [t('how.p8.i1'), t('how.p8.i1b')],
            [t('how.p8.i2'), t('how.p8.i2b')],
            [t('how.p8.i3'), t('how.p8.i3b')],
            [t('how.p8.i4'), t('how.p8.i4b')],
          ]}
        />
      </div>

      <div style={{ marginTop: 'var(--sp-12)' }}>
        <Link to="/signup" className="btn btn-primary btn-lg">
          {t('landing.ctaCreate')}
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
  const t = useT();
  return (
    <div className="section section-narrow">
      <span className="eyebrow">
        <IconShieldCheck size={13} />
        {t('nav.safety')}
      </span>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 'var(--sp-3)' }}>
        {t('safetyPage.h1')}
      </h1>
      <p className="hero-lede">
        {t('safetyPage.lede')}
      </p>

      <div className="stack stack-10" style={{ marginTop: 'var(--sp-10)' }}>
        <section>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>
            {t('safetyPage.hierarchyH2')}
          </h2>
          <div className="card card-pad">
            <div
              className="row row-wrap small strong"
              style={{ gap: 'var(--sp-3)', color: 'var(--brand-700)' }}
            >
              <span className="pill pill-strong">{t('safetyPage.chain1')}</span>
              <IconArrowRight size={14} />
              <span className="pill pill-strong">{t('safetyPage.chain2')}</span>
              <IconArrowRight size={14} />
              <span className="pill pill-strong">{t('landing.f2.title')}</span>
              <IconArrowRight size={14} />
              <span className="pill pill-strong">{t('landing.f3.title')}</span>
              <IconArrowRight size={14} />
              <span className="pill pill-strong">{t('safetyPage.chain5')}</span>
            </div>
            <p className="muted" style={{ marginTop: 'var(--sp-5)' }}>
              {t('safetyPage.hierarchyP')}
            </p>
          </div>
        </section>

        <section id="meeting">
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>
            {t('footer.meetingSafely')}
          </h2>
          <div className="stack stack-3">
            {SAFETY_TIPS.map((tip) => (
              <div key={tip.titleKey} className="card card-pad">
                <div className="row row-3" style={{ alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--ok-500)', marginTop: 2, flexShrink: 0 }}>
                    <IconCheck size={16} />
                  </span>
                  <div>
                    <div className="strong">{t(tip.titleKey)}</div>
                    <p className="muted small" style={{ marginTop: 2 }}>
                      {t(tip.bodyKey)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="reporting">
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>
            {t('safetyPage.reportingH2')}
          </h2>
          <div className="stack stack-4">
            <Alert tone="info" title={t('safetyPage.reportAlert')}>
              {t('safetyPage.reportAlertBody')}
            </Alert>

            <div className="card card-pad">
              <div className="strong" style={{ marginBottom: 'var(--sp-3)' }}>
                {t('safetyPage.whatNext')}
              </div>
              <div className="row row-wrap small" style={{ gap: 'var(--sp-3)' }}>
                <span className="pill">{t('safetyPage.flow1')}</span>
                <IconArrowRight size={13} />
                <span className="pill">{t('safetyPage.flow2')}</span>
                <IconArrowRight size={13} />
                <span className="pill">{t('safetyPage.flow3')}</span>
                <IconArrowRight size={13} />
                <span className="pill">{t('safetyPage.flow4')}</span>
              </div>
              <p className="muted small" style={{ marginTop: 'var(--sp-4)' }}>
                {t('safetyPage.outcomes')}
              </p>
            </div>

            <div className="card card-pad">
              <div className="strong" style={{ marginBottom: 'var(--sp-2)' }}>
                {t('safetyPage.blockH3')}
              </div>
              <p className="muted small">
                {t('safetyPage.blockP')}
              </p>
            </div>

            <Alert tone="warn" title={t('safetyPage.notEmergency')}>
              {t('safetyPage.notEmergencyBody')}
            </Alert>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>
            {t('safetyPage.abuseH2')}
          </h2>
          <div className="stack stack-3">
            <Row
              icon={<IconLock size={17} />}
              title={t('safetyPage.abuse1.title')}
              body={t('safetyPage.abuse1.body')}
            />
            <Row
              icon={<IconEyeOff size={17} />}
              title={t('safetyPage.abuse2.title')}
              body={t('safetyPage.abuse2.body')}
            />
            <Row
              icon={<IconUsers size={17} />}
              title={t('safetyPage.abuse3.title')}
              body={t('safetyPage.abuse3.body')}
            />
            <Row
              icon={<IconGavel size={17} />}
              title={t('safetyPage.abuse4.title')}
              body={t('safetyPage.abuse4.body')}
            />
          </div>
        </section>

        <PrototypeNote>
          {t('proto.safetyPage')}
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
  const t = useT();
  return (
    <div className="section section-narrow">
      <span className="eyebrow">
        <IconLock size={13} />
        {t('nav.privacy')}
      </span>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 'var(--sp-3)' }}>
        {t('privacyPage.h1')}
      </h1>
      <p className="hero-lede">
        {t('privacyPage.lede')}
      </p>

      <div className="stack stack-10" style={{ marginTop: 'var(--sp-10)' }}>
        <section id="data">
          <div className="compare">
            <div className="compare-col" style={{ background: 'var(--surface)' }}>
              <h4 style={{ color: 'var(--danger-700)' }}>{t('privacyPage.privateH4')}</h4>
              <ul>
                {[
                  t('privacyPage.priv1'),
                  t('privacyPage.priv2'),
                  t('privacyPage.priv3'),
                  t('privacyPage.priv4'),
                  t('privacyPage.priv5'),
                  t('privacyPage.priv6'),
                  t('privacyPage.priv7'),
                ].map((t) => (
                  <li key={t}>
                    <IconLock size={14} style={{ color: 'var(--danger-500)', flexShrink: 0, marginTop: 3 }} />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="small muted" style={{ marginTop: 'var(--sp-4)' }}>
                {t('privacyPage.privateNote')}
              </p>
            </div>

            <div className="compare-col" style={{ background: 'var(--surface)' }}>
              <h4 style={{ color: 'var(--ok-700)' }}>{t('privacyPage.discoveryH4')}</h4>
              <ul>
                {[
                  t('privacyPage.disc1'),
                  t('privacyPage.disc2'),
                  t('privacyPage.disc3'),
                  t('privacyPage.disc4'),
                  t('privacyPage.disc5'),
                  t('privacyPage.disc6'),
                  t('privacyPage.disc7'),
                ].map((item) => (
                  <li key={item}>
                    <IconCheck size={14} style={{ color: 'var(--ok-500)', flexShrink: 0, marginTop: 3 }} />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="small muted" style={{ marginTop: 'var(--sp-4)' }}>
                {t('privacyPage.discoveryNote')}
              </p>
            </div>
          </div>
        </section>

        <section id="children">
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>
            {t('footer.whatWeShow')}
          </h2>
          <div className="card card-pad stack stack-5">
            <Control
              label={t('privacyPage.namesLabel')}
              options={[t('privacyPage.namesOpt1'), t('privacyPage.namesOpt2'), t('privacyPage.namesOpt3')]}
              note={t('privacyPage.namesNote')}
            />
            <hr className="divider" />
            <Control
              label={t('how.p4.i3')}
              options={[t('privacyPage.agesOpt1'), t('privacyPage.agesOpt2')]}
              note={t('privacyPage.agesNote')}
            />
            <hr className="divider" />
            <Control
              label={t('how.p4.i4')}
              options={[t('privacyPage.photosOpt1'), t('privacyPage.photosOpt2'), t('privacyPage.photosOpt3')]}
              note={t('privacyPage.photosNote')}
            />
            <hr className="divider" />
            <Control
              label={t('privacyPage.notesLabel')}
              options={[t('privacyPage.notesOpt1')]}
              note={t('privacyPage.notesNote')}
            />
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>{t('how.p4.i1')}</h2>
          <div className="card card-pad">
            <p className="muted">
              {t('privacyPage.locationP1')}
            </p>
            <p className="muted" style={{ marginTop: 'var(--sp-4)' }}>
              {t('privacyPage.locationP2')}
            </p>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-4)' }}>
            {t('privacyPage.matchingH2')}
          </h2>
          <div className="card card-pad">
            <p className="muted">
              {t('privacyPage.matchingP1')}
            </p>
            <p className="muted" style={{ marginTop: 'var(--sp-4)' }}>
              {t('privacyPage.matchingP2')}
            </p>
          </div>
        </section>

        <Alert tone="warn" title={t('privacyPage.complianceTitle')}>
          {t('privacyPage.complianceBody')}
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
