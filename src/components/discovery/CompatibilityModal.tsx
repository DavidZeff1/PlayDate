import type { DiscoveryResult } from '../../services';
import { BAND_LABELS } from '../../domain/matching/engine';
import { interestLabel } from '../../domain/interests';
import { Avatar, Modal, Stars } from '../ui';
import {
  ChildInterestList,
  DisclosureNotice,
  FamilyMeta,
  TrustSignals,
  STYLE_LABELS,
  VerificationBadge,
} from '../family/FamilyBits';
import { IconCheck, IconInfo, IconSparkle } from '../ui/Icons';

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
  const { projection, match } = result;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`Compatibility with ${projection.displayName}`}
      description="Why this family appeared in your results."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {onRequest && (
            <button
              className="btn btn-primary"
              onClick={() => {
                onRequest(projection.id);
                onClose();
              }}
            >
              Send PlayDate request
            </button>
          )}
        </>
      }
    >
      <div className="stack stack-6">
        {/* -- Band, not a percentage ---------------------------------------- */}
        <div className={`match-banner match-${match.band}`} style={{ borderRadius: 'var(--r-md)' }}>
          <IconSparkle size={15} />
          {BAND_LABELS[match.band]}
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
          <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-3)' }}>Why?</h4>
          <ul className="reason-list">
            {match.reasons.map((r, i) => (
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
              Children who might get on
            </h4>
            <div className="stack stack-3">
              {match.pairings.slice(0, 3).map((p, i) => (
                <div key={i} className="pairing">
                  <div style={{ minWidth: 0 }}>
                    <div className="strong small">{p.viewerChildName}</div>
                    <div className="tiny muted">your child</div>
                  </div>
                  <div className="pairing-link" aria-hidden="true" />
                  <div style={{ minWidth: 0, textAlign: 'right' }}>
                    <div className="strong small">{p.candidateChildName}</div>
                    <div className="tiny muted">
                      {p.ageGap === 0 ? 'same age' : `${p.ageGap} year${p.ageGap === 1 ? '' : 's'} apart`}
                    </div>
                  </div>
                  <div style={{ minWidth: 110, textAlign: 'right' }}>
                    {p.sharedInterestIds.length > 0 ? (
                      <span className="badge badge-ok">
                        {p.sharedInterestIds.length} shared
                      </span>
                    ) : (
                      <span className="badge badge-neutral">No overlap yet</span>
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
            How each factor weighed in
          </h4>
          <p className="tiny muted" style={{ marginBottom: 'var(--sp-3)' }}>
            Based on the importance you set in your matching preferences — the stars show how
            much you asked us to weight each one.
          </p>
          <div>
            {match.breakdown.map((b) => (
              <div key={b.id} className="breakdown-row">
                <div>
                  <div className="small strong">{b.label}</div>
                  <Stars value={b.weight} size="readonly" label={`${b.label} importance`} />
                </div>
                <div className="breakdown-bar">
                  <div
                    className="breakdown-fill"
                    style={{
                      width: `${Math.round(b.value * 100)}%`,
                      background: b.value > 0.7 ? 'var(--ok-500)' : b.value > 0.4 ? 'var(--brand-500)' : 'var(--ink-300)',
                    }}
                  />
                </div>
                <div className="small muted" style={{ textAlign: 'right' }}>
                  {b.value >= 0.75 ? 'Strong' : b.value >= 0.45 ? 'Fair' : 'Low'}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* -- Their children -------------------------------------------------- */}
        <section>
          <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-3)' }}>
            Their children
          </h4>
          <div className="stack stack-4">
            {projection.children.map((child) => (
              <div key={child.id} className="panel">
                <div className="row row-3" style={{ marginBottom: 'var(--sp-3)' }}>
                  <Avatar name={child.displayName} color={child.avatarColor} size="sm" />
                  <div>
                    <div className="strong small">{child.displayName}</div>
                    <div className="tiny muted">{child.ageLabel}</div>
                  </div>
                </div>
                <ChildInterestList child={child} />
                {child.notes && (
                  <p className="small muted" style={{ marginTop: 'var(--sp-3)' }}>
                    {child.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* -- Shared interests ------------------------------------------------ */}
        {match.sharedInterestIds.length > 0 && (
          <section>
            <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-2)' }}>
              Shared interests
            </h4>
            <p className="small muted">
              {match.sharedInterestIds.map(interestLabel).join(' · ')}
            </p>
          </section>
        )}

        {/* -- Playdate style -------------------------------------------------- */}
        {projection.styles.length > 0 && (
          <section>
            <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-2)' }}>
              How they like to meet
            </h4>
            <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
              {projection.styles.map((s) => (
                <span key={s} className="pill">
                  {STYLE_LABELS[s]}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* -- Trust ----------------------------------------------------------- */}
        <section>
          <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-3)' }}>
            What we have verified
          </h4>
          <TrustSignals signals={projection.trustSignals} />
        </section>

        <DisclosureNotice tier={projection.tier} />
      </div>
    </Modal>
  );
}
