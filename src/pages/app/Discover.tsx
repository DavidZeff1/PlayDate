import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type DiscoveryFilters, type DiscoveryResult } from '../../services';
import { useApp } from '../../state/AppContext';
import { INTEREST_CATALOG } from '../../domain/interests';
import {
  Alert,
  EmptyState,
  LoadingBlock,
  Modal,
  Segmented,
  useToast,
} from '../../components/ui';
import { FamilyCard } from '../../components/discovery/FamilyCard';
import {
  IconCompass,
  IconFilter,
  IconInfo,
  IconShieldCheck,
  IconX,
} from '../../components/ui/Icons';

/**
 * Discovery.
 *
 * Note the framing throughout: "families", never "children"; "discover", never "browse
 * kids". The product must never feel like shopping for a child — see the language rules
 * in docs/ARCHITECTURE.md and the brief's §20.
 */
export function Discover() {
  const { canDiscover, family } = useApp();
  const toast = useToast();

  const [results, setResults] = useState<DiscoveryResult[] | null>(null);
  const [excluded, setExcluded] = useState<Array<{ displayName: string; reason: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoveryFilters>({ sort: 'match' });
  const [showFilters, setShowFilters] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [requestTarget, setRequestTarget] = useState<DiscoveryResult | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [r, x] = await Promise.all([api.discoverFamilies(filters), api.excludedFamilies()]);
      setResults(r);
      setExcluded(x);
    } catch (e) {
      setResults([]);
      setError(e instanceof Error ? e.message : 'Could not load families.');
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.minAge !== undefined) n += 1;
    if (filters.maxAge !== undefined) n += 1;
    if (filters.interestIds?.length) n += 1;
    if (filters.maxDistanceKm !== undefined) n += 1;
    if (filters.verifiedOnly) n += 1;
    return n;
  }, [filters]);

  /* ---- Gate: unverified parents never see other families' children ------ */
  if (!canDiscover) {
    return (
      <div className="stack stack-6">
        <div className="page-head">
          <h1>Discover families</h1>
          <p>Find families whose children yours might connect with.</p>
        </div>

        <div className="card card-pad stack stack-5" style={{ maxWidth: 620 }}>
          <div className="feature-icon" style={{ background: 'var(--warn-50)', color: 'var(--warn-600)' }}>
            <IconShieldCheck size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)' }}>Verification is needed first</h2>
            <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
              Browsing other families means seeing information about their children. We only
              open that to parents who have completed identity verification — and the same
              rule protects your family from anyone who has not.
            </p>
          </div>
          <Link to="/app/verification" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            Go to verification
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack stack-6">
      <div className="row row-between row-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1>Discover families</h1>
          <p>
            Families whose children yours might connect with — filtered by your preferences,
            and each one explained.
          </p>
        </div>

        <div className="row row-3">
          <Segmented
            label="Sort"
            value={filters.sort ?? 'match'}
            onChange={(v) => setFilters((f) => ({ ...f, sort: v }))}
            options={[
              { value: 'match', label: 'Best match' },
              { value: 'newest', label: 'Newest' },
            ]}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFilters(true)}>
            <IconFilter size={15} />
            Filters
            {activeFilterCount > 0 && <span className="badge badge-brand">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {results === null ? (
        <LoadingBlock label="Finding families…" />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<IconCompass size={22} />}
          title="No families match right now"
          description={
            excluded.length > 0
              ? `${excluded.length} families were filtered out by your hard limits — travel distance, age range or availability. Widening any of those will usually help.`
              : 'Try widening your travel distance or acceptable age gap in Settings.'
          }
          action={
            <Link to="/app/settings" className="btn btn-secondary">
              Adjust preferences
            </Link>
          }
        />
      ) : (
        <>
          <div className="row row-between row-4" style={{ flexWrap: 'wrap' }}>
            <p className="small muted">
              <strong className="strong">{results.length} families</strong> match your current
              preferences.
            </p>
            {excluded.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowExcluded(true)}>
                <IconInfo size={14} />
                {excluded.length} filtered out — why?
              </button>
            )}
          </div>

          <div className="family-grid">
            {results.map((r) => (
              <FamilyCard
                key={r.projection.id}
                result={r}
                onRequest={() => setRequestTarget(r)}
              />
            ))}
          </div>

          <div className="panel small muted row row-3" style={{ alignItems: 'flex-start' }}>
            <IconInfo size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>
              These are limited profiles. Exact locations, contact details, schools and photos
              are not shown here — and your family appears to others under exactly the same
              rules.
            </span>
          </div>
        </>
      )}

      {/* ---- Filters ------------------------------------------------------ */}
      <FiltersModal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApply={(f) => {
          setFilters(f);
          setShowFilters(false);
        }}
      />

      {/* ---- Why families were excluded ----------------------------------- */}
      <Modal
        open={showExcluded}
        onClose={() => setShowExcluded(false)}
        title="Families filtered out"
        description="These were removed by a hard limit rather than ranked lower."
        footer={
          <button className="btn btn-secondary" onClick={() => setShowExcluded(false)}>
            Close
          </button>
        }
      >
        <div className="stack stack-4">
          <Alert tone="info">
            PlayDate removes families you could not realistically meet — outside your travel
            radius, outside your age range, or with no overlapping free time — rather than
            showing them at the bottom of a list. You can widen any of these in Settings.
          </Alert>
          <ul className="stack stack-2">
            {excluded.map((e, i) => (
              <li key={i} className="row row-between row-3 panel">
                <span className="small strong">{e.displayName}</span>
                <span className="tiny muted" style={{ textAlign: 'right' }}>
                  {e.reason}
                </span>
              </li>
            ))}
          </ul>
          <p className="tiny muted">
            Only the family name and the reason are shown here — no profile is loaded for a
            family you are not entitled to see.
          </p>
        </div>
      </Modal>

      {/* ---- Send request -------------------------------------------------- */}
      {requestTarget && (
        <RequestModal
          result={requestTarget}
          onClose={() => setRequestTarget(null)}
          onSent={() => {
            setRequestTarget(null);
            toast.push('Request sent. They can accept, decline, or decide later.', 'ok');
            void load();
          }}
        />
      )}

      {family && !family.privacy.discoverable && (
        <Alert tone="warn" title="Your family is hidden from discovery">
          You can browse, but other families will not see you in their results.{' '}
          <Link to="/app/settings">Change this in Settings</Link>.
        </Alert>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Filters                                                                     */
/* ========================================================================== */

function FiltersModal({
  open,
  onClose,
  filters,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  filters: DiscoveryFilters;
  onApply: (f: DiscoveryFilters) => void;
}) {
  const [draft, setDraft] = useState<DiscoveryFilters>(filters);

  useEffect(() => setDraft(filters), [filters, open]);

  const toggleInterest = (id: string) => {
    const current = draft.interestIds ?? [];
    setDraft({
      ...draft,
      interestIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filter families"
      description="Narrow your results. Your saved preferences still apply underneath."
      footer={
        <>
          <button
            className="btn btn-ghost"
            onClick={() => onApply({ sort: draft.sort ?? 'match' })}
          >
            Clear all
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onApply(draft)}>
            Apply filters
          </button>
        </>
      }
    >
      <div className="stack stack-6">
        <div className="field">
          <span className="label">Children's ages</span>
          <div className="row row-3">
            <input
              className="input"
              type="number"
              min={1}
              max={17}
              placeholder="From"
              value={draft.minAge ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, minAge: e.target.value ? Number(e.target.value) : undefined })
              }
              aria-label="Minimum age"
            />
            <span className="muted">to</span>
            <input
              className="input"
              type="number"
              min={1}
              max={17}
              placeholder="To"
              value={draft.maxAge ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, maxAge: e.target.value ? Number(e.target.value) : undefined })
              }
              aria-label="Maximum age"
            />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="filter-distance">
            Maximum distance
            {draft.maxDistanceKm !== undefined && ` — ${draft.maxDistanceKm} km`}
          </label>
          <input
            id="filter-distance"
            type="range"
            min={1}
            max={30}
            value={draft.maxDistanceKm ?? 30}
            onChange={(e) => setDraft({ ...draft, maxDistanceKm: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--brand-600)' }}
          />
          <div className="hint">Your saved travel limit still applies on top of this.</div>
        </div>

        <div className="field">
          <span className="label">Must share at least one of these interests</span>
          <div
            className="row row-wrap"
            style={{ gap: 'var(--sp-2)', maxHeight: 200, overflowY: 'auto' }}
          >
            {INTEREST_CATALOG.map((i) => {
              const on = draft.interestIds?.includes(i.id) ?? false;
              return (
                <button
                  key={i.id}
                  className={`interest-tag${on ? ' interest-tag-shared' : ''}`}
                  onClick={() => toggleInterest(i.id)}
                  aria-pressed={on}
                >
                  <span aria-hidden="true">{i.emoji}</span>
                  {i.label}
                  {on && <IconX size={11} />}
                </button>
              );
            })}
          </div>
        </div>

        <label className="checkbox" data-checked={draft.verifiedOnly ?? false}>
          <input
            type="checkbox"
            checked={draft.verifiedOnly ?? false}
            onChange={(e) => setDraft({ ...draft, verifiedOnly: e.target.checked })}
          />
          <div>
            <div className="strong small">Only ID-verified families</div>
            <div className="tiny muted">
              Hides families whose identity verification is still pending.
            </div>
          </div>
        </label>
      </div>
    </Modal>
  );
}

/* ========================================================================== */
/* Connection request                                                          */
/* ========================================================================== */

/**
 * Sending a request.
 *
 * The note is deliberately one-shot and capped. It is not the first message of a
 * conversation — someone who is declined must not be able to keep writing.
 */
export function RequestModal({
  result,
  onClose,
  onSent,
}: {
  result: DiscoveryResult;
  onClose: () => void;
  onSent: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.sendConnectionRequest(result.projection.id, note || undefined);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  const reasons = result.match.reasons.filter((r) => r.tone === 'positive').slice(0, 3);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Send a request to ${result.projection.displayName}`}
      description="They decide whether to connect. Nothing more is shared until they accept."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={send} disabled={busy}>
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </>
      }
    >
      <div className="stack stack-5">
        <div className="panel">
          <div className="tiny muted" style={{ marginBottom: 'var(--sp-2)' }}>
            They will see why PlayDate suggested you
          </div>
          <div className="small">{reasons.map((r) => r.text).join(' · ')}</div>
        </div>

        <div className="field">
          <label className="label" htmlFor="request-note">
            Add a short note
            <span className="muted" style={{ fontWeight: 400 }}> — optional</span>
          </label>
          <div className="hint">
            One note, not a conversation. If they decline, you will not be able to write again —
            that is how PlayDate prevents unwanted contact.
          </div>
          <textarea
            id="request-note"
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={400}
            placeholder="Our children seem to share a lot of interests — would you like to connect?"
          />
          <div className="tiny muted">{note.length}/400</div>
        </div>

        <Alert tone="info">
          Declining costs them nothing and tells you nothing. If you do not hear back, that is
          a complete answer in itself.
        </Alert>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
