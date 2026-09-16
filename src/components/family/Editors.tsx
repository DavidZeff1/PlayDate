import { Fragment, useMemo, useState } from 'react';
import type {
  AvailabilitySlot,
  ChildInterest,
  DayOfWeek,
  Importance,
  PlaydateStyle,
  PrivacySettings,
  TimeBlock,
} from '../../domain/types';
import {
  enthusiasmLabels,
  importanceLabels,
  interestsByCategory,
  interestEmoji,
  interestLabel,
} from '../../domain/interests';
import { useT } from '../../i18n';
import { Segmented, Stars } from '../ui';
import { IconCheck, IconPlus, IconSearch, IconX } from '../ui/Icons';

/* ========================================================================== */
/* Interest editor                                                             */
/* ========================================================================== */

/**
 * The importance control is the heart of the matching product.
 *
 * Two separate ratings per interest, because they answer different questions:
 *
 *   • **Enthusiasm** — how much does MY child like this? Other families see this, and it
 *     feeds their affinity score for my child.
 *   • **Importance** — how much should PlayDate weight this when finding matches for ME?
 *     Nobody else sees this; it only shapes my own results.
 *
 * Collapsing them into one number would be simpler and wrong: a parent can have a child
 * who adores football while considering football irrelevant to who they befriend.
 */
export function InterestEditor({
  value,
  onChange,
}: {
  value: ChildInterest[];
  onChange: (next: ChildInterest[]) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const impLabels = importanceLabels(t);
  const enthLabels = enthusiasmLabels(t);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.interestId)), [value]);

  const catalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return interestsByCategory()
      .map((group) => ({
        ...group,
        interests: group.interests.filter(
          (i) =>
            !selectedIds.has(i.id) &&
            // Search the translated label so a Hebrew reader can search in Hebrew.
            (!q || interestLabel(i.id, t).toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.interests.length > 0);
  }, [query, selectedIds, t]);

  const add = (interestId: string) => {
    onChange([...value, { interestId, enthusiasm: 4, importance: 3 }]);
    setQuery('');
  };

  const update = (interestId: string, patch: Partial<ChildInterest>) => {
    onChange(value.map((v) => (v.interestId === interestId ? { ...v, ...patch } : v)));
  };

  const remove = (interestId: string) => {
    onChange(value.filter((v) => v.interestId !== interestId));
  };

  return (
    <div className="stack stack-5">
      {value.length > 0 && (
        <div className="stack stack-3">
          {value.map((item) => (
            <div key={item.interestId} className="card card-pad" style={{ padding: 'var(--sp-4)' }}>
              <div className="row row-between row-3" style={{ marginBottom: 'var(--sp-4)' }}>
                <div className="row row-3">
                  <span style={{ fontSize: '1.15rem' }} aria-hidden="true">
                    {interestEmoji(item.interestId)}
                  </span>
                  <span className="strong">{interestLabel(item.interestId, t)}</span>
                </div>
                <button
                  className="btn-icon"
                  onClick={() => remove(item.interestId)}
                  aria-label={`Remove ${interestLabel(item.interestId, t)}`}
                >
                  <IconX size={15} />
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 'var(--sp-4)',
                }}
              >
                <div>
                  <div className="small strong" style={{ marginBottom: 4 }}>
                    {t('ed.enjoyQ')}
                  </div>
                  <div className="row row-3">
                    <Stars
                      value={item.enthusiasm}
                      onChange={(v) => update(item.interestId, { enthusiasm: v })}
                      label={`${interestLabel(item.interestId, t)} — enjoyment`}
                      labels={enthLabels}
                    />
                    <span className="tiny muted">{enthLabels[item.enthusiasm]}</span>
                  </div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {t('ed.enjoyNote')}
                  </div>
                </div>

                <div>
                  <div className="small strong" style={{ marginBottom: 4 }}>
                    {t('ed.importanceQ')}
                  </div>
                  <div className="row row-3">
                    <Stars
                      value={item.importance}
                      onChange={(v) => update(item.interestId, { importance: v })}
                      label={`${interestLabel(item.interestId, t)} — matching importance`}
                      labels={impLabels}
                    />
                    <span className="tiny muted">{impLabels[item.importance]}</span>
                  </div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {t('ed.importanceNote')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!adding ? (
        <button className="btn btn-secondary" onClick={() => setAdding(true)}>
          <IconPlus size={16} />
          {t('ed.addInterest')}
        </button>
      ) : (
        <div className="card card-pad stack stack-4">
          <div className="row row-between">
            <span className="strong small">{t('ed.chooseInterest')}</span>
            <button className="btn-icon" onClick={() => setAdding(false)} aria-label="Close">
              <IconX size={15} />
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ink-400)',
              }}
            >
              <IconSearch size={15} />
            </span>
            <input
              className="input"
              style={{ paddingLeft: '2.1rem' }}
              placeholder={t('ed.searchInterests')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('ed.searchInterests')}
            />
          </div>

          <div className="stack stack-4" style={{ maxHeight: 340, overflowY: 'auto' }}>
            {catalog.map((group) => (
              <div key={group.category}>
                <div className="tiny muted strong" style={{ marginBottom: 'var(--sp-2)' }}>
                  {t(group.labelKey)}
                </div>
                <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
                  {group.interests.map((i) => (
                    <button key={i.id} className="interest-tag" onClick={() => add(i.id)}>
                      <span aria-hidden="true">{i.emoji}</span>
                      {interestLabel(i.id, t)}
                      <IconPlus size={11} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {catalog.length === 0 && (
              <p className="small muted">
                {query ? t('ed.noSearchMatch') : t('ed.allAdded')}
              </p>
            )}
          </div>

          <p className="tiny muted">{t('ed.fixedList')}</p>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Availability grid                                                           */
/* ========================================================================== */

const DAYS: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const BLOCKS: TimeBlock[] = ['morning', 'afternoon', 'evening'];

export function AvailabilityGrid({
  value,
  onChange,
}: {
  value: AvailabilitySlot[];
  onChange: (next: AvailabilitySlot[]) => void;
}) {
  const t = useT();
  const set = useMemo(() => new Set(value.map((s) => `${s.day}:${s.block}`)), [value]);

  const toggle = (day: DayOfWeek, block: TimeBlock) => {
    const key = `${day}:${block}`;
    onChange(
      set.has(key)
        ? value.filter((s) => `${s.day}:${s.block}` !== key)
        : [...value, { day, block }],
    );
  };

  return (
    <div className="stack stack-4">
      <div style={{ overflowX: 'auto' }}>
        <div className="availability-grid">
          <div />
          {BLOCKS.map((b) => (
            <div key={b} className="tiny muted center strong">
              {t(`block.${b}`)}
            </div>
          ))}

          {DAYS.map((d) => (
            <Fragment key={d}>
              <div className="availability-label">{t(`day.${d}`)}</div>
              {BLOCKS.map((b) => {
                const on = set.has(`${d}:${b}`);
                return (
                  <button
                    key={`${d}-${b}`}
                    type="button"
                    className="availability-cell"
                    aria-pressed={on}
                    aria-label={`${t(`day.${d}`)} ${t(`block.${b}`)}`}
                    onClick={() => toggle(d, b)}
                  >
                    {on ? <IconCheck size={14} style={{ margin: '0 auto' }} /> : '—'}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <p className="tiny muted">
        {t('ed.availNote')}
      </p>
    </div>
  );
}

/* ========================================================================== */
/* Playdate style picker                                                       */
/* ========================================================================== */

const STYLE_OPTIONS: PlaydateStyle[] = [
  'parents_stay',
  'public_places_only',
  'home_visits_ok',
  'drop_off_ok',
  'small_groups',
  'structured_activities',
];

export function StylePicker({
  value,
  onChange,
}: {
  value: PlaydateStyle[];
  onChange: (next: PlaydateStyle[]) => void;
}) {
  const t = useT();
  const toggle = (s: PlaydateStyle) =>
    onChange(value.includes(s) ? value.filter((v) => v !== s) : [...value, s]);

  return (
    <div className="stack stack-2">
      {STYLE_OPTIONS.map((id) => (
        <label key={id} className="checkbox" data-checked={value.includes(id)}>
          <input type="checkbox" checked={value.includes(id)} onChange={() => toggle(id)} />
          <div>
            <div className="strong small">{t(`style.${id}`)}</div>
            <div className="tiny muted">{t(`styleDesc.${id}`)}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

/* ========================================================================== */
/* Privacy controls                                                            */
/* ========================================================================== */

/**
 * Every privacy control shows a live preview of what another family would actually see.
 * Abstract settings ("Location: neighbourhood") are hard to reason about; seeing
 * "Rehavia, Jerusalem area" appear under your family name is not.
 */
export function PrivacyControls({
  value,
  onChange,
  preview,
}: {
  value: PrivacySettings;
  onChange: (patch: Partial<PrivacySettings>) => void;
  preview: {
    generalArea: string;
    neighborhood?: string;
    childFirstName: string;
    childNickname?: string;
    childAge: number;
  };
}) {
  const t = useT();

  const locationPreview =
    value.location === 'hidden'
      ? t('ed.locNotShared')
      : value.location === 'general_area'
        ? preview.generalArea
        : value.location === 'neighborhood'
          ? t('ed.locOnceConnected', {
              area: preview.generalArea,
              hood: preview.neighborhood ?? preview.generalArea,
            })
          : t('ed.locAbout');

  const namePreview =
    value.childName === 'hidden'
      ? t('common.childN', { n: 1 })
      : value.childName === 'nickname'
        ? preview.childNickname || t('ed.noNickname')
        : preview.childFirstName;

  const agePreview =
    value.childAges === 'exact'
      ? t('common.yearsOld', { n: preview.childAge })
      : t('common.ageRange', {
          from: Math.max(1, preview.childAge - 1),
          to: preview.childAge + 1,
        });

  const photoPreview =
    value.childPhotos === 'hidden'
      ? t('ed.photoNone')
      : value.childPhotos === 'connected_families'
        ? t('ed.photoConnected')
        : t('ed.photoApproved');

  return (
    <div>
      <PrivacyRow
        label={t('ed.privLocation')}
        description={t('ed.privLocationDesc')}
        preview={locationPreview}
        control={
          <Segmented
            label={t('ed.privLocDisclosure')}
            value={value.location}
            onChange={(v) => onChange({ location: v })}
            options={[
              { value: 'hidden', label: t('ed.optHidden') },
              { value: 'general_area', label: t('ed.optGeneralArea') },
              { value: 'neighborhood', label: t('ed.optNeighbourhood') },
              { value: 'approximate_distance', label: t('ed.optDistance') },
            ]}
          />
        }
      />

      <PrivacyRow
        label={t('ed.privNames')}
        description={t('ed.privNamesDesc')}
        preview={namePreview}
        control={
          <Segmented
            label={t('ed.privNameDisclosure')}
            value={value.childName}
            onChange={(v) => onChange({ childName: v })}
            options={[
              { value: 'hidden', label: t('ed.optHidden') },
              { value: 'first_name', label: t('ed.optFirstName') },
              { value: 'nickname', label: t('ed.optNickname') },
            ]}
          />
        }
      />

      <PrivacyRow
        label={t('ed.privAges')}
        description={t('ed.privAgesDesc')}
        preview={agePreview}
        control={
          <Segmented
            label={t('ed.privAgeDisclosure')}
            value={value.childAges}
            onChange={(v) => onChange({ childAges: v })}
            options={[
              { value: 'exact', label: t('ed.optExactAge') },
              { value: 'range', label: t('ed.optAgeRange') },
            ]}
          />
        }
      />

      <PrivacyRow
        label={t('ed.privPhotos')}
        description={t('ed.privPhotosDesc')}
        preview={photoPreview}
        control={
          <Segmented
            label={t('ed.privPhotoDisclosure')}
            value={value.childPhotos}
            onChange={(v) => onChange({ childPhotos: v })}
            options={[
              { value: 'hidden', label: t('ed.optHidden') },
              { value: 'connected_families', label: t('ed.optConnected') },
              { value: 'on_request', label: t('ed.optPerFamily') },
            ]}
          />
        }
      />

      <PrivacyRow
        label={t('ed.privAvail')}
        description={t('ed.privAvailDesc')}
        preview={
          value.availabilityDetail === 'summary'
            ? t('ed.availSummaryPreview')
            : t('ed.availDetailPreview')
        }
        control={
          <Segmented
            label={t('ed.privAvail')}
            value={value.availabilityDetail}
            onChange={(v) => onChange({ availabilityDetail: v })}
            options={[
              { value: 'summary', label: t('ed.optSummary') },
              { value: 'detailed', label: t('ed.optDetailed') },
            ]}
          />
        }
      />

      <PrivacyRow
        label={t('ed.privBio')}
        description={t('ed.privBioDesc')}
        preview={
          value.parentBio === 'discovery'
            ? t('ed.bioBrowsing')
            : t('ed.bioConnected')
        }
        control={
          <Segmented
            label={t('ed.bioDisclosure')}
            value={value.parentBio}
            onChange={(v) => onChange({ parentBio: v })}
            options={[
              { value: 'connected_only', label: t('ed.optAfterConnecting') },
              { value: 'discovery', label: t('ed.optWhenBrowsing') },
            ]}
          />
        }
      />
    </div>
  );
}

function PrivacyRow({
  label,
  description,
  preview,
  control,
}: {
  label: string;
  description: string;
  preview: string;
  control: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="privacy-row">
      <div>
        <div className="strong">{label}</div>
        <p className="small muted" style={{ marginTop: 2, marginBottom: 'var(--sp-3)' }}>
          {description}
        </p>
        <div className="preview-box">
          <div className="tiny muted" style={{ marginBottom: 2 }}>
            {t('ed.othersSee')}
          </div>
          <div className="small strong">{preview}</div>
        </div>
      </div>
      <div style={{ paddingTop: 2 }}>{control}</div>
    </div>
  );
}

/* ========================================================================== */
/* Matching weight sliders                                                     */
/* ========================================================================== */

const WEIGHT_KEYS = ['interests', 'age', 'distance', 'availability', 'style'] as const;

const WEIGHT_LABEL = {
  interests: 'ed.wInterests',
  age: 'ed.wAge',
  distance: 'ed.wDistance',
  availability: 'ed.wAvailability',
  style: 'ed.wStyle',
} as const;

const WEIGHT_DESC = {
  interests: 'ed.wInterestsDesc',
  age: 'ed.wAgeDesc',
  distance: 'ed.wDistanceDesc',
  availability: 'ed.wAvailabilityDesc',
  style: 'ed.wStyleDesc',
} as const;

export function WeightEditor({
  value,
  onChange,
}: {
  value: Record<string, Importance>;
  onChange: (key: string, v: Importance) => void;
}) {
  const t = useT();
  const impLabels = importanceLabels(t);

  return (
    <div className="stack stack-4">
      {WEIGHT_KEYS.map((key) => (
        <div key={key} className="row row-between row-4" style={{ flexWrap: 'wrap' }}>
          <div style={{ minWidth: 200, flex: 1 }}>
            <div className="strong small">{t(WEIGHT_LABEL[key])}</div>
            <div className="tiny muted">{t(WEIGHT_DESC[key])}</div>
          </div>
          <div className="row row-3">
            <Stars
              value={value[key]}
              onChange={(v) => onChange(key, v)}
              label={t('compat.importanceOf', { label: t(WEIGHT_LABEL[key]) })}
              labels={impLabels}
            />
            <span className="tiny muted" style={{ minWidth: 110 }}>
              {impLabels[value[key]]}
            </span>
          </div>
        </div>
      ))}
      <p className="tiny muted">{t('ed.weightsNote')}</p>
    </div>
  );
}
