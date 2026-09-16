import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services';
import { useApp } from '../../state/AppContext';
import { useT } from '../../i18n';
import { interestLabel } from '../../domain/interests';
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
  const t = useT();

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
              {t('landing.eyebrow')}
            </span>

            <h1>
              {t('landing.h1a')}{' '}
              <span style={{ color: 'var(--brand-600)' }}>{t('landing.h1b')}</span>
            </h1>

            <p className="hero-lede">{t('landing.lede')}</p>

            <div className="hero-actions">
              <Link to="/signup" className="btn btn-primary btn-lg">
                {t('landing.ctaCreate')}
                <IconArrowRight size={17} />
              </Link>
              <button className="btn btn-secondary btn-lg" onClick={exploreDemo}>
                {t('landing.ctaExplore')}
              </button>
            </div>

            <div className="hero-assurances">
              <span>
                <IconCheck size={14} style={{ color: 'var(--ok-500)' }} />
                {t('landing.assure1')}
              </span>
              <span>
                <IconCheck size={14} style={{ color: 'var(--ok-500)' }} />
                {t('landing.assure2')}
              </span>
              <span>
                <IconCheck size={14} style={{ color: 'var(--ok-500)' }} />
                {t('landing.assure3')}
              </span>
            </div>

            <div style={{ marginTop: 'var(--sp-8)', maxWidth: 520 }}>
              {/* The dictionary marks "simulated" with <b> for emphasis; React escapes
                  markup, so the tags are stripped rather than rendered. This page never
                  injects HTML — see docs/SECURITY.md on XSS. */}
              <PrototypeNote>{t('proto.landing').replace(/<[^>]+>/g, '')}</PrototypeNote>
            </div>
          </div>

          {/* A real discovery card, so the landing page shows the actual product rather
              than an illustration of it. */}
          <div className="hero-preview">
            <div className="hero-preview-back" aria-hidden="true" />
            <div className="hero-preview-card">
              <div className="row row-2 small" style={{ color: 'var(--ok-700)', fontWeight: 600, marginBottom: 'var(--sp-4)' }}>
                <IconSparkle size={14} />
                {t('band.strong')}
              </div>

              <div className="row row-4" style={{ marginBottom: 'var(--sp-4)' }}>
                <Avatar name={t('landing.previewFamily')} color="var(--brand-600)" size="lg" square />
                <div>
                  <div className="strong" style={{ fontSize: 'var(--text-md)' }}>
                    {t('landing.previewFamily')}
                  </div>
                  <div style={{ marginTop: 5 }}>
                    <Badge tone="ok">
                      <IconCheck size={11} /> {t('verif.verified.label')}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="row row-wrap small muted" style={{ gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
                <span className="row row-2">
                  <IconMapPin size={13} /> {t('landing.previewArea')}
                </span>
                <span className="row row-2">
                  <IconUsers size={13} /> {t('landing.previewChild')}
                </span>
                <span className="row row-2">
                  <IconClock size={13} /> {t('landing.previewAvail')}
                </span>
              </div>

              <ul className="reason-list" style={{ marginBottom: 'var(--sp-4)' }}>
                {[
                  t('landing.previewR1'),
                  t('landing.previewR2'),
                  t('landing.previewR3'),
                  t('landing.previewR4'),
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
                {(
                  [
                    ['🧱', 'lego', true],
                    ['🎲', 'board_games', true],
                    ['🎨', 'drawing', true],
                    ['🏊', 'swimming', false],
                  ] as const
                ).map(([emoji, id, shared]) => (
                  <span key={id} className={`interest-tag${shared ? ' interest-tag-shared' : ''}`}>
                    <span aria-hidden="true">{emoji}</span>
                    {interestLabel(id, t)}
                  </span>
                ))}
              </div>

              <div className="row row-3">
                <span className="btn btn-secondary btn-sm grow" style={{ cursor: 'default' }}>
                  {t('landing.previewCompat')}
                </span>
                <span className="btn btn-primary btn-sm grow" style={{ cursor: 'default' }}>
                  {t('landing.previewSend')}
                </span>
              </div>

              <div className="panel small muted row row-3" style={{ marginTop: 'var(--sp-4)', alignItems: 'flex-start' }}>
                <IconLock size={13} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  {t('landing.previewLock')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= The unit is the family ================= */}
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">{t('landing.modelEyebrow')}</span>
          <h2>{t('landing.modelH2')}</h2>
          <p>{t('landing.modelP')}</p>
        </div>

        <div className="feature-grid">
          <Feature
            icon={<IconShieldCheck size={20} />}
            title={t('landing.f1.title')}
            body={t('landing.f1.body')}
          />
          <Feature
            icon={<IconEyeOff size={20} />}
            title={t('landing.f2.title')}
            body={t('landing.f2.body')}
          />
          <Feature
            icon={<IconUsers size={20} />}
            title={t('landing.f3.title')}
            body={t('landing.f3.body')}
          />
          <Feature
            icon={<IconFilter size={20} />}
            title={t('landing.f4.title')}
            body={t('landing.f4.body')}
          />
          <Feature
            icon={<IconSparkle size={20} />}
            title={t('landing.f5.title')}
            body={t('landing.f5.body')}
          />
          <Feature
            icon={<IconGavel size={20} />}
            title={t('landing.f6.title')}
            body={t('landing.f6.body')}
          />
        </div>
      </section>

      {/* ================= Language matters ================= */}
      <section className="section section-tight">
        <div className="section-head">
          <span className="eyebrow">{t('landing.langEyebrow')}</span>
          <h2>{t('landing.langH2')}</h2>
          <p>
            {t('landing.langP')}
          </p>
        </div>

        <div className="compare">
          <div className="compare-col bad">
            <h4>{t('landing.notThis')}</h4>
            <ul>
              <li>
                <span aria-hidden="true">✕</span> {t('landing.bad1')}
              </li>
              <li>
                <span aria-hidden="true">✕</span> {t('landing.bad2')}
              </li>
              <li>
                <span aria-hidden="true">✕</span> {t('landing.bad3')}
              </li>
              <li>
                <span aria-hidden="true">✕</span> {t('landing.bad4')}
              </li>
              <li>
                <span aria-hidden="true">✕</span> {t('landing.bad5')}
              </li>
            </ul>
          </div>
          <div className="compare-col good">
            <h4>{t('landing.this')}</h4>
            <ul>
              <li>
                <span aria-hidden="true">✓</span> {t('landing.good1')}
              </li>
              <li>
                <span aria-hidden="true">✓</span> {t('landing.good2')}
              </li>
              <li>
                <span aria-hidden="true">✓</span> {t('landing.good3')}
              </li>
              <li>
                <span aria-hidden="true">✓</span> {t('landing.good4')}
              </li>
              <li>
                <span aria-hidden="true">✓</span> {t('landing.good5')}
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ================= Flow ================= */}
      <section className="section section-narrow">
        <div className="section-head">
          <span className="eyebrow">{t('landing.flowEyebrow')}</span>
          <h2>{t('landing.flowH2')}</h2>
        </div>

        <div className="steps">
          {(
            [
              ['landing.s1.title', 'landing.s1.body'],
              ['landing.s2.title', 'landing.s2.body'],
              ['landing.s3.title', 'landing.s3.body'],
              ['landing.s4.title', 'landing.s4.body'],
              ['landing.s5.title', 'landing.s5.body'],
            ] as const
          ).map(([titleKey, bodyKey], i) => (
            <div className="step" key={titleKey}>
              <div className="step-num">{i + 1}</div>
              <div>
                <h3>{t(titleKey)}</h3>
                <p>{t(bodyKey)}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'var(--sp-8)' }}>
          <Link to="/how-it-works" className="btn btn-secondary">
            {t('landing.readWalkthrough')}
            <IconArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ================= What we never do ================= */}
      <section className="section">
        <div className="card card-pad" style={{ background: 'var(--brand-800)', borderColor: 'transparent' }}>
          <div className="section-head" style={{ marginBottom: 'var(--sp-6)' }}>
            <span className="eyebrow" style={{ color: 'var(--brand-200)' }}>
              {t('landing.neverEyebrow')}
            </span>
            <h2 style={{ color: '#fff', marginTop: 'var(--sp-2)' }}>{t('landing.neverH2')}</h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 'var(--sp-5)',
            }}
          >
            {[
              t('landing.never1'),
              t('landing.never2'),
              t('landing.never3'),
              t('landing.never4'),
              t('landing.never5'),
              t('landing.never6'),
            ].map((line) => (
              <div key={line} className="row row-3" style={{ alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--brand-200)', marginTop: 2, flexShrink: 0 }}>
                  <IconCheck size={15} />
                </span>
                <span style={{ color: 'rgba(255,255,255,0.88)', fontSize: 'var(--text-base)', lineHeight: 1.55 }}>
                  {line}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="section section-tight">
        <div className="cta-band">
          <h2>{t('landing.ctaH2')}</h2>
          <p>{t('landing.ctaP')}</p>
          <div className="row row-3" style={{ justifyContent: 'center', marginTop: 'var(--sp-8)', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-lg" onClick={exploreDemo}>
              {t('landing.ctaExplore')}
            </button>
            <Link
              to="/safety"
              className="btn btn-lg"
              style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}
            >
              {t('landing.ctaSafety')}
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
