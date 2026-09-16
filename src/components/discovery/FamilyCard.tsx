import { useState } from 'react';
import type { DiscoveryResult } from '../../services';
import { BAND_LABELS } from '../../domain/matching/engine';
import { Avatar, Badge } from '../ui';
import {
  ChildSummary,
  FamilyMeta,
  InterestTags,
  TrustSignals,
  VerificationBadge,
} from '../family/FamilyBits';
import { IconCheck, IconInfo, IconSparkle } from '../ui/Icons';
import { CompatibilityModal } from './CompatibilityModal';

/**
 * The discovery card.
 *
 * Shows exactly what a `FamilyProjection` at DISCOVERY tier contains — general area,
 * child count and ages, interests, a coarse availability summary — and nothing else,
 * because nothing else is in the object.
 *
 * The match is presented as a BAND plus reasons. There is no percentage anywhere on
 * this card: "92%" invites a parent to trust an arithmetic artefact over their own
 * reading of the family, and it is not a number we could honestly defend.
 */
export function FamilyCard({
  result,
  onRequest,
  onOpen,
}: {
  result: DiscoveryResult;
  onRequest?: (familyId: string) => void;
  onOpen?: (familyId: string) => void;
}) {
  const [showCompat, setShowCompat] = useState(false);
  const { projection, match, relationship } = result;

  const topReasons = match.reasons.filter((r) => r.tone === 'positive').slice(0, 3);

  return (
    <>
      <article className="family-card">
        <div className={`match-banner match-${match.band}`}>
          <IconSparkle size={14} />
          {BAND_LABELS[match.band]}
        </div>

        <div className="family-card-head">
          <Avatar name={projection.displayName} color="var(--brand-600)" size="lg" square />
          <div className="grow">
            <h3 style={{ fontSize: 'var(--text-md)' }}>{projection.displayName}</h3>
            <div style={{ marginTop: 6 }}>
              <VerificationBadge status={projection.verificationStatus} />
            </div>
          </div>
        </div>

        <div className="family-card-body">
          <FamilyMeta family={projection} />

          {/* Why this family surfaced — never a bare score. */}
          {topReasons.length > 0 && (
            <ul className="reason-list">
              {topReasons.map((r, i) => (
                <li key={i} className="reason reason-positive">
                  <span className="reason-icon">
                    <IconCheck size={13} />
                  </span>
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="stack stack-3">
            {projection.children.map((child) => (
              <ChildSummary
                key={child.id}
                child={child}
                sharedInterestIds={match.sharedInterestIds}
                showInterests={false}
              />
            ))}
          </div>

          <InterestTags
            interestIds={[
              ...new Set(projection.children.flatMap((c) => c.interests.map((i) => i.interestId))),
            ]}
            sharedIds={match.sharedInterestIds}
            limit={5}
          />

          <TrustSignals signals={projection.trustSignals} compact />
        </div>

        <div className="family-card-foot">
          <button
            className="btn btn-secondary btn-sm grow"
            onClick={() => {
              setShowCompat(true);
              onOpen?.(projection.id);
            }}
          >
            <IconInfo size={14} />
            View compatibility
          </button>

          {relationship === 'none' && onRequest && (
            <button className="btn btn-primary btn-sm grow" onClick={() => onRequest(projection.id)}>
              Send request
            </button>
          )}
          {relationship === 'request_sent' && (
            <span className="btn btn-ghost btn-sm grow" style={{ cursor: 'default' }}>
              <Badge tone="pending">Request sent</Badge>
            </span>
          )}
          {relationship === 'request_received' && (
            <span className="btn btn-ghost btn-sm grow" style={{ cursor: 'default' }}>
              <Badge tone="brand">They asked you</Badge>
            </span>
          )}
          {relationship === 'connected' && (
            <span className="btn btn-ghost btn-sm grow" style={{ cursor: 'default' }}>
              <Badge tone="ok">Connected</Badge>
            </span>
          )}
          {relationship === 'declined' && (
            <span className="btn btn-ghost btn-sm grow" style={{ cursor: 'default' }}>
              <Badge tone="neutral">Not connected</Badge>
            </span>
          )}
        </div>
      </article>

      <CompatibilityModal
        open={showCompat}
        onClose={() => setShowCompat(false)}
        result={result}
        onRequest={relationship === 'none' ? onRequest : undefined}
      />
    </>
  );
}
