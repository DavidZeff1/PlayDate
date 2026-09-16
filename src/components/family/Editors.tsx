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
  ENTHUSIASM_LABELS,
  IMPORTANCE_LABELS,
  interestsByCategory,
  interestEmoji,
  interestLabel,
} from '../../domain/interests';
import { Segmented, Stars } from '../ui';
import { IconCheck, IconPlus, IconSearch, IconX } from '../ui/Icons';
import { STYLE_LABELS } from './FamilyBits';

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
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.interestId)), [value]);

  const catalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return interestsByCategory()
      .map((group) => ({
        ...group,
        interests: group.interests.filter(
          (i) => !selectedIds.has(i.id) && (!q || i.label.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.interests.length > 0);
  }, [query, selectedIds]);

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
                  <span className="strong">{interestLabel(item.interestId)}</span>
                </div>
                <button
                  className="btn-icon"
                  onClick={() => remove(item.interestId)}
                  aria-label={`Remove ${interestLabel(item.interestId)}`}
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
                    How much do they enjoy it?
                  </div>
                  <div className="row row-3">
                    <Stars
                      value={item.enthusiasm}
                      onChange={(v) => update(item.interestId, { enthusiasm: v })}
                      label={`${interestLabel(item.interestId)} — enjoyment`}
                      labels={ENTHUSIASM_LABELS}
                    />
                    <span className="tiny muted">{ENTHUSIASM_LABELS[item.enthusiasm]}</span>
                  </div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    Other families see this.
                  </div>
                </div>

                <div>
                  <div className="small strong" style={{ marginBottom: 4 }}>
                    How important is it for matching?
                  </div>
                  <div className="row row-3">
                    <Stars
                      value={item.importance}
                      onChange={(v) => update(item.interestId, { importance: v })}
                      label={`${interestLabel(item.interestId)} — matching importance`}
                      labels={IMPORTANCE_LABELS}
                    />
                    <span className="tiny muted">{IMPORTANCE_LABELS[item.importance]}</span>
                  </div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    Private to you. Shapes your results only.
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
          Add an interest
        </button>
      ) : (
        <div className="card card-pad stack stack-4">
          <div className="row row-between">
            <span className="strong small">Choose an interest</span>
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
              placeholder="Search interests…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search interests"
            />
          </div>

          <div className="stack stack-4" style={{ maxHeight: 340, overflowY: 'auto' }}>
            {catalog.map((group) => (
              <div key={group.category}>
                <div className="tiny muted strong" style={{ marginBottom: 'var(--sp-2)' }}>
                  {group.label}
                </div>
                <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
                  {group.interests.map((i) => (
                    <button key={i.id} className="interest-tag" onClick={() => add(i.id)}>
                      <span aria-hidden="true">{i.emoji}</span>
                      {i.label}
                      <IconPlus size={11} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {catalog.length === 0 && (
              <p className="small muted">
                {query ? 'Nothing matches that search.' : 'Every interest has been added.'}
              </p>
            )}
          </div>

          <p className="tiny muted">
            Interests come from a fixed list rather than free text. That keeps matching to
            playdate-relevant preferences, and stops the interest field becoming a way to sort
            families by anything sensitive.
          </p>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Availability grid                                                           */
/* ========================================================================== */

const DAYS: Array<{ id: DayOfWeek; label: string }> = [
  { id: 'sun', label: 'Sunday' },
  { id: 'mon', label: 'Monday' },
  { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' },
  { id: 'fri', label: 'Friday' },
  { id: 'sat', label: 'Saturday' },
];

const BLOCKS: Array<{ id: TimeBlock; label: string }> = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
];

export function AvailabilityGrid({
  value,
  onChange,
}: {
  value: AvailabilitySlot[];
  onChange: (next: AvailabilitySlot[]) => void;
}) {
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
            <div key={b.id} className="tiny muted center strong">
              {b.label}
            </div>
          ))}

          {DAYS.map((d) => (
            <Fragment key={d.id}>
              <div className="availability-label">
                {d.label}
              </div>
              {BLOCKS.map((b) => {
                const on = set.has(`${d.id}:${b.id}`);
                return (
                  <button
                    key={`${d.id}-${b.id}`}
                    type="button"
                    className="availability-cell"
                    aria-pressed={on}
                    aria-label={`${d.label} ${b.label}`}
                    onClick={() => toggle(d.id, b.id)}
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
        Other families see only a summary like “Weekend afternoons” unless you connect and
        choose to share detail. Families with no overlap with yours are filtered out of each
        other's results entirely.
      </p>
    </div>
  );
}

/* ========================================================================== */
/* Playdate style picker                                                       */
/* ========================================================================== */

const STYLE_OPTIONS: Array<{ id: PlaydateStyle; description: string }> = [
  { id: 'parents_stay', description: 'A parent stays for the whole visit.' },
  { id: 'public_places_only', description: 'Parks, playgrounds and other public places.' },
  { id: 'home_visits_ok', description: 'Happy to visit homes once we know each other.' },
  { id: 'drop_off_ok', description: 'Open to drop-off playdates with familiar families.' },
  { id: 'small_groups', description: 'One or two children rather than a crowd.' },
  { id: 'structured_activities', description: 'A planned activity rather than free play.' },
];

export function StylePicker({
  value,
  onChange,
}: {
  value: PlaydateStyle[];
  onChange: (next: PlaydateStyle[]) => void;
}) {
  const toggle = (s: PlaydateStyle) =>
    onChange(value.includes(s) ? value.filter((v) => v !== s) : [...value, s]);

  return (
    <div className="stack stack-2">
      {STYLE_OPTIONS.map((o) => (
        <label key={o.id} className="checkbox" data-checked={value.includes(o.id)}>
          <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
          <div>
            <div className="strong small">{STYLE_LABELS[o.id]}</div>
            <div className="tiny muted">{o.description}</div>
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
  const locationPreview =
    value.location === 'hidden'
      ? 'Location not shared'
      : value.location === 'general_area'
        ? preview.generalArea
        : value.location === 'neighborhood'
          ? `${preview.generalArea} → ${preview.neighborhood ?? preview.generalArea} once connected`
          : 'About 2–4 km away';

  const namePreview =
    value.childName === 'hidden'
      ? 'Child 1'
      : value.childName === 'nickname'
        ? preview.childNickname || 'Child 1 (no nickname set)'
        : preview.childFirstName;

  const agePreview =
    value.childAges === 'exact'
      ? `${preview.childAge} years old`
      : `${Math.max(1, preview.childAge - 1)}–${preview.childAge + 1} years old`;

  const photoPreview =
    value.childPhotos === 'hidden'
      ? 'No photo shown to anyone'
      : value.childPhotos === 'connected_families'
        ? 'Visible after you connect'
        : 'Visible only to families you individually approve';

  return (
    <div>
      <PrivacyRow
        label="Location"
        description="What other families see about where you are. Your address is never shown at any setting."
        preview={locationPreview}
        control={
          <Segmented
            label="Location disclosure"
            value={value.location}
            onChange={(v) => onChange({ location: v })}
            options={[
              { value: 'hidden', label: 'Hidden' },
              { value: 'general_area', label: 'General area' },
              { value: 'neighborhood', label: 'Neighbourhood' },
              { value: 'approximate_distance', label: 'Distance' },
            ]}
          />
        }
      />

      <PrivacyRow
        label="Children's names"
        description="A surname is never shown for a child, whichever option you choose."
        preview={namePreview}
        control={
          <Segmented
            label="Child name disclosure"
            value={value.childName}
            onChange={(v) => onChange({ childName: v })}
            options={[
              { value: 'hidden', label: 'Hidden' },
              { value: 'first_name', label: 'First name' },
              { value: 'nickname', label: 'Nickname' },
            ]}
          />
        }
      />

      <PrivacyRow
        label="Children's ages"
        description="A band is enough for matching and gives away slightly less."
        preview={agePreview}
        control={
          <Segmented
            label="Age disclosure"
            value={value.childAges}
            onChange={(v) => onChange({ childAges: v })}
            options={[
              { value: 'exact', label: 'Exact age' },
              { value: 'range', label: 'Age range' },
            ]}
          />
        }
      />

      <PrivacyRow
        label="Photos of children"
        description="Off by default. Photos are never visible to someone simply browsing."
        preview={photoPreview}
        control={
          <Segmented
            label="Photo disclosure"
            value={value.childPhotos}
            onChange={(v) => onChange({ childPhotos: v })}
            options={[
              { value: 'hidden', label: 'Hidden' },
              { value: 'connected_families', label: 'Connected' },
              { value: 'on_request', label: 'Per family' },
            ]}
          />
        }
      />

      <PrivacyRow
        label="Availability detail"
        description="A summary keeps your weekly routine private from people you have not met."
        preview={
          value.availabilityDetail === 'summary'
            ? '“Weekend afternoons”'
            : 'Exact days and times, once connected'
        }
        control={
          <Segmented
            label="Availability detail"
            value={value.availabilityDetail}
            onChange={(v) => onChange({ availabilityDetail: v })}
            options={[
              { value: 'summary', label: 'Summary' },
              { value: 'detailed', label: 'Detailed' },
            ]}
          />
        }
      />

      <PrivacyRow
        label="Your introduction"
        description="The short note you write about your family."
        preview={
          value.parentBio === 'discovery'
            ? 'Shown to anyone browsing'
            : 'Shown only after you connect'
        }
        control={
          <Segmented
            label="Bio disclosure"
            value={value.parentBio}
            onChange={(v) => onChange({ parentBio: v })}
            options={[
              { value: 'connected_only', label: 'After connecting' },
              { value: 'discovery', label: 'When browsing' },
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
  return (
    <div className="privacy-row">
      <div>
        <div className="strong">{label}</div>
        <p className="small muted" style={{ marginTop: 2, marginBottom: 'var(--sp-3)' }}>
          {description}
        </p>
        <div className="preview-box">
          <div className="tiny muted" style={{ marginBottom: 2 }}>
            Other families see
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

const WEIGHT_COPY: Array<{
  key: 'interests' | 'age' | 'distance' | 'availability' | 'style';
  label: string;
  description: string;
}> = [
  {
    key: 'interests',
    label: 'Shared interests',
    description: 'How much weight to give what your children actually like doing.',
  },
  {
    key: 'age',
    label: 'Similar ages',
    description: 'How close in age the children should be.',
  },
  {
    key: 'distance',
    label: 'Distance',
    description: 'How much to favour families nearer to you.',
  },
  {
    key: 'availability',
    label: 'Matching availability',
    description: 'How much overlapping free time should count.',
  },
  {
    key: 'style',
    label: 'Playdate style',
    description: 'How much it matters that you like to meet the same way.',
  },
];

export function WeightEditor({
  value,
  onChange,
}: {
  value: Record<string, Importance>;
  onChange: (key: string, v: Importance) => void;
}) {
  return (
    <div className="stack stack-4">
      {WEIGHT_COPY.map((w) => (
        <div key={w.key} className="row row-between row-4" style={{ flexWrap: 'wrap' }}>
          <div style={{ minWidth: 200, flex: 1 }}>
            <div className="strong small">{w.label}</div>
            <div className="tiny muted">{w.description}</div>
          </div>
          <div className="row row-3">
            <Stars
              value={value[w.key]}
              onChange={(v) => onChange(w.key, v)}
              label={`${w.label} importance`}
              labels={IMPORTANCE_LABELS}
            />
            <span className="tiny muted" style={{ minWidth: 110 }}>
              {IMPORTANCE_LABELS[value[w.key]]}
            </span>
          </div>
        </div>
      ))}
      <p className="tiny muted">
        These weights are private and only shape your own results. Something you mark
        “extremely important” counts for far more than something you mark “not important” —
        it is not a simple tally.
      </p>
    </div>
  );
}
