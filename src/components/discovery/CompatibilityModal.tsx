import type { DiscoveryResult } from '../../services';
import { BAND_KEYS } from '../../domain/matching/engine';
import { interestLabel, importanceLabels } from '../../domain/interests';
import { useI18n, useT } from '../../i18n';
import { useFormat } from '../../i18n/format';
import { renderReasons, joinList } from '../../i18n/render';
import type { TKey } from '../../i18n/types';
import { Avatar, Modal, Stars } from '../ui';
import {
  ChildInterestList,
  DisclosureNotice,
  FamilyMeta,
  TrustSignals,
  VerificationBadge,
} from '../family/FamilyBits';
import { IconCheck, IconInfo, IconSparkle } from '../ui/Icons';

/** Scorer id → the label key for that dimension in the breakdown table. */
const FACTOR_KEYS: Record<string, TKey> = {
  age: 'compat.factorAges',
  interests: 'compat.factorInterests',
  distance: 'compat.factorDistance',
  availability: 'compat.factorAvailability',
  style: 'compat.factorStyle',
};

/**
 * The full explanation behind a match.
 *
 * Structure, top to bottom: the band, the reasons in plain sentences, which children
 * might pair up, what each dimension contributed, and what is still hidden. A parent
 * should leave this dialog able to say *why* this family is on their screen — and, just
 * as importantly, what PlayDate has not told them.
 */
export function CompatibilityModal({
  open,
  onClose,
  result,
  onRequest,
}: {
  open: boolean;
  onClose: () => void;
  result: DiscoveryResult;
  onRequest?: (familyId: string) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const f = useFormat();
  const { projection, match } = result;
  const reasons = renderReasons(match.reasons, t, locale);
  const impLabels = importanceLabels(t);

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={t('compat.title', { name: projection.displayName })}
      description={t('compat.sub')}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {t('common.close')}
          </button>
          {onRequest && (
            <button
              className="btn btn-primary"
              onClick={() => {
                onRequest(projection.id);
                onClose();
              }}
            >
              {t('compat.sendPlaydateRequest')}
            </button>
          )}
        </>
      }
    >
      <div className="stack stack-6">
        {/* -- Band, not a percentage ---------------------------------------- */}
        <div className={`match-banner match-${match.band}`} style={{ borderRadius: 'var(--r-md)' }}>
          <IconSparkle size={15} />
          {t(BAND_KEYS[match.band])}
        </div>

        <div className="row row-4">
          <Avatar name={projection.displayName} color="var(--brand-600)" size="lg" square />
          <div className="grow">
            <h3 style={{ fontSize: 'var(--text-md)' }}>{projection.displayName}</h3>
            <div className="row row-2" style={{ marginTop: 5 }}>
              <VerificationBadge status={projection.verificationStatus} />
            </div>
          </div>
        </div>

        <FamilyMeta family={projection} />

        {/* -- Reasons -------------------------------------------------------- */}
        <section>
          <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-3)' }}>
            {t('compat.why')}
          </h4>
          <ul className="reason-list">
            {reasons.map((r, i) => (
              <li key={i} className={`reason reason-${r.tone}`}>
                <span className="reason-icon">
                  {r.tone === 'positive' ? <IconCheck size={14} /> : <IconInfo size={14} />}
                </span>
                <div>
                  <div>{r.text}</div>
                  {r.detail && <div className="tiny muted">{r.detail}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* -- Which children might get on ------------------------------------ */}
        {match.pairings.length > 0 && (
          <section>
            <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-3)' }}>
              {t('compat.pairings')}
            </h4>
            <div className="stack stack-3">
              {match.pairings.slice(0, 3).map((p, i) => (
                <div key={i} className="pairing">
                  <div style={{ minWidth: 0 }}>
                    <div className="strong small">{p.viewerChildName}</div>
                    <div className="tiny muted">{t('compat.yourChild')}</div>
                  </div>
                  <div className="pairing-link" aria-hidden="true" />
                  <div style={{ minWidth: 0, textAlign: 'end' }}>
                    <div className="strong small">{p.candidateChildName}</div>
                    <div className="tiny muted">
                      {p.ageGap === 0
                        ? t('compat.sameAge')
                        : p.ageGap === 1
                          ? t('compat.yearApart')
                          : t('compat.yearsApart', { n: p.ageGap })}
                    </div>
                  </div>
                  <div style={{ minWidth: 110, textAlign: 'end' }}>
                    {p.sharedInterestIds.length > 0 ? (
                      <span className="badge badge-ok">
                        {t('compat.nShared', { n: p.sharedInterestIds.length })}
                      </span>
                    ) : (
                      <span className="badge badge-neutral">{t('compat.noOverlapYet')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* -- Weighted breakdown ---------------------------------------------- */}
        <section>
          <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-1)' }}>
            {t('compat.factors')}
          </h4>
          <p className="tiny muted" style={{ marginBottom: 'var(--sp-3)' }}>
            {t('compat.factorsHint')}
          </p>
          <div>
            {match.breakdown.map((b) => {
              const label = t(FACTOR_KEYS[b.id] ?? 'compat.factorInterests');
              return (
                <div key={b.id} className="breakdown-row">
                  <div>
                    <div className="small strong">{label}</div>
                    <Stars
                      value={b.weight}
                      size="readonly"
                      label={t('compat.importanceOf', { label })}
                      labels={impLabels}
                    />
                  </div>
                  <div className="breakdown-bar">
                    <div
                      className="breakdown-fill"
                      style={{
                        width: `${Math.round(b.value * 100)}%`,
                        background:
                          b.value > 0.7
                            ? 'var(--ok-500)'
                            : b.value > 0.4
                              ? 'var(--brand-500)'
                              : 'var(--ink-300)',
                      }}
                    />
                  </div>
                  <div className="small muted" style={{ textAlign: 'end' }}>
                    {b.value >= 0.75
                      ? t('compat.strong')
                      : b.value >= 0.45
                        ? t('compat.fair')
                        : t('compat.low')}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* -- Their children -------------------------------------------------- */}
        <section>
          <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-3)' }}>
            {t('compat.theirChildren')}
          </h4>
          <div className="stack stack-4">
            {projection.children.map((child) => {
              const name = f.childName(child.displayName);
              return (
                <div key={child.id} className="panel">
                  <div className="row row-3" style={{ marginBottom: 'var(--sp-3)' }}>
                    <Avatar name={name} color={child.avatarColor} size="sm" />
                    <div>
                      <div className="strong small">{name}</div>
                      <div className="tiny muted">{f.ageLabel(child.ageView)}</div>
                    </div>
                  </div>
                  <ChildInterestList child={child} />
                  {child.notes && (
                    <p className="small muted" style={{ marginTop: 'var(--sp-3)' }}>
                      {child.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* -- Shared interests ------------------------------------------------ */}
        {match.sharedInterestIds.length > 0 && (
          <section>
            <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-2)' }}>
              {t('compat.sharedInterests')}
            </h4>
            <p className="small muted">
              {joinList(
                match.sharedInterestIds.map((id) => interestLabel(id, t)),
                locale,
                'unit',
              )}
            </p>
          </section>
        )}

        {/* -- Playdate style -------------------------------------------------- */}
        {projection.styles.length > 0 && (
          <section>
            <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-2)' }}>
              {t('compat.howTheyMeet')}
            </h4>
            <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
              {projection.styles.map((s) => (
                <span key={s} className="pill">
                  {t(`style.${s}` as TKey)}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* -- Trust ----------------------------------------------------------- */}
        <section>
          <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-3)' }}>
            {t('compat.whatVerified')}
          </h4>
          <TrustSignals signals={projection.trustSignals} />
        </section>

        <DisclosureNotice tier={projection.tier} />
      </div>
    </Modal>
  );
}
