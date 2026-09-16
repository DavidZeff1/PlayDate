import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type DiscoveryFilters, type DiscoveryResult } from '../../services';
import { useApp } from '../../state/AppContext';
import { INTEREST_CATALOG, interestLabel } from '../../domain/interests';
import { useI18n, useT } from '../../i18n';
import { renderReasons, renderExclusion } from '../../i18n/render';
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
  const t = useT();
  const { locale } = useI18n();

  const [results, setResults] = useState<DiscoveryResult[] | null>(null);
  const [excluded, setExcluded] = useState<
    Array<{ displayName: string; reasonKey: string; reasonVars?: Record<string, string | number> }>
  >([]);
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
      setError(e instanceof Error ? e.message : t('disc.loadError'));
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
          <h1>{t('nav.discover')}</h1>
          <p>{t('disc.subShort')}</p>
        </div>

        <div className="card card-pad stack stack-5" style={{ maxWidth: 620 }}>
          <div className="feature-icon" style={{ background: 'var(--warn-50)', color: 'var(--warn-600)' }}>
            <IconShieldCheck size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)' }}>{t('disc.gateH2')}</h2>
            <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
              {t('disc.gateP')}
            </p>
          </div>
          <Link to="/app/verification" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            {t('disc.gateCta')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack stack-6">
      <div className="row row-between row-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1>{t('nav.discover')}</h1>
          <p>
            {t('disc.sub')}
          </p>
        </div>

        <div className="row row-3">
          <Segmented
            label={t('disc.sort')}
            value={filters.sort ?? 'match'}
            onChange={(v) => setFilters((f) => ({ ...f, sort: v }))}
            options={[
              { value: 'match', label: t('disc.sortBest') },
              { value: 'newest', label: t('disc.sortNewest') },
            ]}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFilters(true)}>
            <IconFilter size={15} />
            {t('disc.filters')}
            {activeFilterCount > 0 && <span className="badge badge-brand">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {results === null ? (
        <LoadingBlock label={t('disc.finding')} />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<IconCompass size={22} />}
          title={t('disc.emptyTitle')}
          description={
            excluded.length > 0
              ? t('disc.emptyWithExcluded', { n: excluded.length })
              : t('disc.emptyPlain')
          }
          action={
            <Link to="/app/settings" className="btn btn-secondary">
              {t('disc.adjustPrefs')}
            </Link>
          }
        />
      ) : (
        <>
          <div className="row row-between row-4" style={{ flexWrap: 'wrap' }}>
            <p className="small muted">
              <strong className="strong">{t('disc.count', { n: results.length })}</strong>{' '}
              {t('disc.countRest')}
            </p>
            {excluded.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowExcluded(true)}>
                <IconInfo size={14} />
                {t('disc.filteredOut', { n: excluded.length })}
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
              {t('disc.limitedProfiles')}
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
        title={t('disc.excludedTitle')}
        description={t('disc.excludedSub')}
        footer={
          <button className="btn btn-secondary" onClick={() => setShowExcluded(false)}>
            {t('common.close')}
          </button>
        }
      >
        <div className="stack stack-4">
          <Alert tone="info">
            {t('disc.excludedBody')}
          </Alert>
          <ul className="stack stack-2">
            {excluded.map((e, i) => (
              <li key={i} className="row row-between row-3 panel">
                <span className="small strong">{e.displayName}</span>
                <span className="tiny muted" style={{ textAlign: 'end' }}>
                  {renderExclusion(e.reasonKey as never, e.reasonVars, t, locale)}
                </span>
              </li>
            ))}
          </ul>
          <p className="tiny muted">
            {t('disc.excludedNote')}
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
            toast.push(t('disc.requestSent'), 'ok');
            void load();
          }}
        />
      )}

      {family && !family.privacy.discoverable && (
        <Alert tone="warn" title={t('disc.hiddenTitle')}>
          You can browse, but other families will not see you in their results.{' '}
          <Link to="/app/settings">{t('disc.changeInSettings')}</Link>.
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
  const t = useT();
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
      title={t('disc.filtersTitle')}
      description={t('disc.filtersSub')}
      footer={
        <>
          <button
            className="btn btn-ghost"
            onClick={() => onApply({ sort: draft.sort ?? 'match' })}
          >
            {t('disc.clearAll')}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={() => onApply(draft)}>
            {t('disc.applyFilters')}
          </button>
        </>
      }
    >
      <div className="stack stack-6">
        <div className="field">
          <span className="label">{t('disc.childAges')}</span>
          <div className="row row-3">
            <input
              className="input"
              type="number"
              min={1}
              max={17}
              placeholder={t('disc.from')}
              value={draft.minAge ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, minAge: e.target.value ? Number(e.target.value) : undefined })
              }
              aria-label={t('disc.minAge')}
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
              aria-label={t('disc.maxAge')}
            />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="filter-distance">
            {draft.maxDistanceKm !== undefined
              ? t('disc.maxDistanceVal', { km: draft.maxDistanceKm })
              : t('disc.maxDistance')}
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
          <div className="hint">{t('disc.maxDistanceHint')}</div>
        </div>

        <div className="field">
          <span className="label">{t('disc.mustShare')}</span>
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
                  {interestLabel(i.id, t)}
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
            <div className="strong small">{t('disc.verifiedOnly')}</div>
            <div className="tiny muted">
              {t('disc.verifiedOnlyDesc')}
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
  const t = useT();
  const { locale } = useI18n();
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
      setError(e instanceof Error ? e.message : t('disc.requestError'));
    } finally {
      setBusy(false);
    }
  };

  const reasons = renderReasons(
    result.match.reasons.filter((r) => r.tone === 'positive').slice(0, 3),
    t,
    locale,
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Send a request to ${result.projection.displayName}`}
      description={t('disc.requestSub')}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={send} disabled={busy}>
            {busy ? t('common.sending') : t('landing.previewSend')}
          </button>
        </>
      }
    >
      <div className="stack stack-5">
        <div className="panel">
          <div className="tiny muted" style={{ marginBottom: 'var(--sp-2)' }}>
            {t('disc.requestWhy')}
          </div>
          <div className="small">{reasons.map((r) => r.text).join(' · ')}</div>
        </div>

        <div className="field">
          <label className="label" htmlFor="request-note">
            {t('disc.requestNote')}
            <span className="muted" style={{ fontWeight: 400 }}>
              {' \u2014 '}
              {t('common.optional')}
            </span>
          </label>
          <div className="hint">
            {t('disc.requestNoteHint')}
          </div>
          <textarea
            id="request-note"
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={400}
            placeholder={t('disc.requestPlaceholder')}
          />
          <div className="tiny muted">{note.length}/400</div>
        </div>

        <Alert tone="info">
          {t('disc.requestDecline')}
        </Alert>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
