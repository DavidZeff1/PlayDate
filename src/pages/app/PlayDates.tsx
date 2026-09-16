import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type PlayDateView } from '../../services';
import { useApp } from '../../state/AppContext';
import type { FamilyProjection, MeetingPlace, PlayDate } from '../../domain/types';
import { PLAYDATE_ACTIVITIES } from '../../domain/interests';
import { useI18n, useT } from '../../i18n';
import { SUGGESTED_PLACES } from '../../data/seed';
import {
  Alert,
  Avatar,
  Badge,
  EmptyState,
  Field,
  LoadingBlock,
  Modal,
  SafetyNote,
  Tabs,
  useToast,
} from '../../components/ui';
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconClock,
  IconMapPin,
  IconShieldCheck,
  IconUsers,
} from '../../components/ui/Icons';

/* ========================================================================== */
/* PlayDates list                                                              */
/* ========================================================================== */

export function PlayDates() {
  const t = useT();
  const { family } = useApp();
  const toast = useToast();
  const [views, setViews] = useState<PlayDateView[] | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [sharing, setSharing] = useState<PlayDate | null>(null);
  const [feedback, setFeedback] = useState<PlayDate | null>(null);

  const load = useCallback(async () => {
    setViews(await api.getPlayDates());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (views === null || !family) return <LoadingBlock />;

  const now = Date.now();
  const upcoming = views.filter(
    (v) =>
      new Date(v.playdate.startsAt).getTime() > now - 3_600_000 &&
      v.playdate.status !== 'cancelled' &&
      v.playdate.status !== 'declined' &&
      v.playdate.status !== 'completed',
  );
  const past = views.filter((v) => !upcoming.includes(v));
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="stack stack-6">
      <div className="page-head">
        <h1>{t('nav.playdates')}</h1>
        <p>
          {t('pd.sub')}
        </p>
      </div>

      <Tabs
        label={t('nav.playdates')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'upcoming', label: t('dash.upcoming'), count: upcoming.length },
          { value: 'past', label: t('pd.past'), count: past.length },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<IconCalendar size={22} />}
          title={tab === 'upcoming' ? t('pd.emptyUpcoming') : t('pd.emptyPast')}
          description={
            tab === 'upcoming'
              ? t('pd.emptyUpcomingDesc')
              : t('pd.emptyPastDesc')
          }
          action={
            tab === 'upcoming' ? (
              <Link to="/app/messages" className="btn btn-secondary">
                {t('pd.goToMessages')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="stack stack-4">
          {list.map((view) => (
            <PlayDateCard
              key={view.playdate.id}
              view={view}
              myFamilyId={family.id}
              onRespond={async (response) => {
                await api.respondToPlayDate(view.playdate.id, response, { adultPresent: true });
                toast.push(
                  response === 'confirmed' ? t('pd.confirmedToast') : t('pd.responseSent'),
                  'ok',
                );
                await load();
              }}
              onCancel={async () => {
                await api.cancelPlayDate(view.playdate.id);
                toast.push(t('pd.cancelledToast'), 'ok');
                await load();
              }}
              onShare={() => setSharing(view.playdate)}
              onFeedback={() => setFeedback(view.playdate)}
            />
          ))}
        </div>
      )}

      {tab === 'upcoming' && upcoming.length > 0 && (
        <SafetyNote>
          <strong>{t('pd.firstMeetingTitle')}</strong>
          {t('pd.firstMeetingBody')}
        </SafetyNote>
      )}

      {sharing && (
        <ShareWithAdultModal
          playdate={sharing}
          onClose={() => setSharing(null)}
          onDone={async () => {
            setSharing(null);
            toast.push(t('pd.shared'), 'ok');
            await load();
          }}
        />
      )}

      {feedback && (
        <PostMeetingModal
          playdate={feedback}
          onClose={() => setFeedback(null)}
          onDone={async () => {
            setFeedback(null);
            toast.push(t('pd.feedbackThanks'), 'ok');
            await load();
          }}
        />
      )}
    </div>
  );
}

function PlayDateCard({
  view,
  myFamilyId,
  onRespond,
  onCancel,
  onShare,
  onFeedback,
}: {
  view: PlayDateView;
  myFamilyId: string;
  onRespond: (r: 'confirmed' | 'declined') => Promise<void>;
  onCancel: () => Promise<void>;
  onShare: () => void;
  onFeedback: () => void;
}) {
  const t = useT();
  const { d: fmtDate } = useI18n();
  const { playdate: p, otherFamily } = view;
  const startsAt = new Date(p.startsAt);
  const isMine = p.proposedByFamilyId === myFamilyId;
  const needsMyResponse = p.status === 'proposed' && !isMine;
  const isPast = startsAt.getTime() < Date.now();

  const tone =
    p.status === 'confirmed' ? 'ok' : p.status === 'proposed' ? 'pending' : p.status === 'completed' ? 'brand' : 'neutral';

  const label =
    p.status === 'confirmed'
      ? t('dash.confirmed')
      : p.status === 'proposed'
        ? isMine
          ? t('pd.awaitingTheirReply')
          : t('pd.needsYourReply')
        : p.status === 'completed'
          ? t('pd.completed')
          : p.status === 'cancelled'
            ? t('pd.cancelled')
            : t('pd.declined');

  return (
    <section className="card">
      <div className="playdate-card">
        <div className="date-block">
          <div className="dow">{fmtDate(startsAt, { weekday: 'short' })}</div>
          <div className="dom">{startsAt.getDate()}</div>
          <div className="time">
            {fmtDate(startsAt, { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div className="grow stack stack-3">
          <div>
            <div className="row row-3 row-wrap">
              <h3 style={{ fontSize: 'var(--text-md)' }}>{p.place.label}</h3>
              <Badge tone={tone}>{label}</Badge>
              {p.place.isPublic ? (
                <Badge tone="ok">{t('dash.publicPlace')}</Badge>
              ) : (
                <Badge tone="pending">{t('pd.privateHome')}</Badge>
              )}
            </div>
            <div className="row row-wrap small muted" style={{ gap: 'var(--sp-4)', marginTop: 6 }}>
              <span className="row row-2">
                <IconUsers size={12} />
                {t('pd.with', { name: otherFamily.displayName })}
              </span>
              <span className="row row-2">
                <IconMapPin size={12} />
                {p.place.area}
              </span>
              <span className="row row-2">
                <IconClock size={12} />
                {t('pd.minutes', { n: p.durationMinutes })}
              </span>
            </div>
          </div>

          {p.notes && <p className="small muted">{p.notes}</p>}

          <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
            {Object.entries(p.adultPresent).map(([fid, present]) =>
              present ? (
                <span key={fid} className="badge badge-ok">
                  <IconCheck size={10} />
                  {fid === myFamilyId ? t('pd.youWillBeThere') : t('pd.theyWillBeThere')}
                </span>
              ) : null,
            )}
            {p.sharedWith?.map((s, i) => (
              <span key={i} className="badge badge-neutral">
                <IconShieldCheck size={10} />
                {t('pd.sharedWith', { name: s.name })}
              </span>
            ))}
          </div>
        </div>

        <div className="stack stack-2" style={{ minWidth: 150 }}>
          {needsMyResponse && (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => onRespond('confirmed')}>
                {t('common.confirm')}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onRespond('declined')}>
                {t('pd.cantMakeIt')}
              </button>
            </>
          )}

          {p.status === 'confirmed' && !isPast && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={onShare}>
                {t('pd.tellTrustedAdult')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onCancel}>
                {t('common.cancel')}
              </button>
            </>
          )}

          {p.status === 'confirmed' && isPast && (
            <button className="btn btn-secondary btn-sm" onClick={onFeedback}>
              {t('pd.howDidItGo')}
            </button>
          )}

          {p.status === 'proposed' && isMine && (
            <button className="btn btn-ghost btn-sm" onClick={onCancel}>
              {t('common.withdraw')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Composer                                                                    */
/* ========================================================================== */

/**
 * Planning a playdate.
 *
 * Safety is built into the form rather than bolted on as a warning: public venues are
 * suggested first, the "an adult will be there" confirmation is a normal field, and
 * choosing a private home surfaces a calm note rather than an alarm. The goal is that
 * safe defaults feel like ordinary product behaviour.
 */
export function PlayDateComposer({
  connectionId,
  otherFamily,
  onClose,
  onDone,
}: {
  connectionId: string;
  otherFamily: FamilyProjection;
  onClose: () => void;
  onDone: () => void;
}) {
  const { family } = useApp();
  const t = useT();
  const [activity, setActivity] = useState<string>('playground');
  const [place, setPlace] = useState<MeetingPlace>(SUGGESTED_PLACES[0]);
  const [customPlace, setCustomPlace] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [date, setDate] = useState(defaultDate());
  const [time, setTime] = useState('15:00');
  const [duration, setDuration] = useState(90);
  const [notes, setNotes] = useState('');
  const [adultPresent, setAdultPresent] = useState(true);
  const [childIds, setChildIds] = useState<string[]>(family?.children.map((c) => c.id) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalPlace: MeetingPlace = useCustom
    ? { label: customPlace, kind: 'other', area: '', isPublic: true }
    : place;

  const submit = async () => {
    if (useCustom && !customPlace.trim()) {
      setError(t('pd.namePlace'));
      return;
    }
    if (childIds.length === 0) {
      setError(t('pd.chooseChild'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.proposePlayDate({
        connectionId,
        activity,
        place: finalPlace,
        startsAt: new Date(`${date}T${time}`).toISOString(),
        durationMinutes: duration,
        notes: notes || undefined,
        attendingChildIds: childIds,
        adultPresent,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('msg.couldNotSend'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={t('pd.planWith', { name: otherFamily.displayName })}
      description={t('pd.composeSub')}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? t('common.sending') : t('compat.sendPlaydateRequest')}
          </button>
        </>
      }
    >
      <div className="stack stack-6">
        {/* -- Activity -------------------------------------------------- */}
        <div className="field">
          <span className="label">{t('pd.whatWouldYouDo')}</span>
          <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
            {PLAYDATE_ACTIVITIES.map((a) => (
              <button
                key={a.id}
                className={`interest-tag${activity === a.id ? ' interest-tag-shared' : ''}`}
                onClick={() => setActivity(a.id)}
                aria-pressed={activity === a.id}
              >
                <span aria-hidden="true">{a.emoji}</span>
                {t(a.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* -- Place ----------------------------------------------------- */}
        <div className="field">
          <span className="label">{t('pd.whereMeet')}</span>
          <div className="hint">
            {t('pd.whereHint')}
          </div>

          <div className="stack stack-2" style={{ marginTop: 'var(--sp-2)' }}>
            {SUGGESTED_PLACES.slice(0, 5).map((sp) => (
              <label
                key={sp.label}
                className="radio"
                data-checked={!useCustom && place.label === sp.label}
              >
                <input
                  type="radio"
                  name="place"
                  checked={!useCustom && place.label === sp.label}
                  onChange={() => {
                    setUseCustom(false);
                    setPlace(sp);
                  }}
                />
                <div className="grow">
                  <div className="strong small row row-2">
                    {sp.label}
                    <span className="badge badge-ok">{t('pd.public')}</span>
                  </div>
                  <div className="tiny muted">{sp.area}</div>
                </div>
              </label>
            ))}

            <label className="radio" data-checked={useCustom}>
              <input type="radio" name="place" checked={useCustom} onChange={() => setUseCustom(true)} />
              <div className="grow">
                <div className="strong small">{t('pd.somewhereElse')}</div>
                {useCustom && (
                  <input
                    className="input"
                    style={{ marginTop: 'var(--sp-2)' }}
                    value={customPlace}
                    onChange={(e) => setCustomPlace(e.target.value)}
                    placeholder={t('pd.placePlaceholder')}
                    aria-label={t('pd.placeLabel')}
                  />
                )}
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  {t('pd.noHomeAddress')}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* -- When ------------------------------------------------------ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 'var(--sp-4)',
          }}
        >
          <Field label={t('pd.date')} htmlFor="pd-date">
            <input
              id="pd-date"
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label={t('pd.startTime')} htmlFor="pd-time">
            <input
              id="pd-time"
              className="input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
          <Field label={t('pd.howLong')} htmlFor="pd-dur">
            <select
              id="pd-dur"
              className="select"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1½ hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
            </select>
          </Field>
        </div>

        {/* -- Who ------------------------------------------------------- */}
        <div className="field">
          <span className="label">{t('pd.whichChildren')}</span>
          <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
            {family?.children.map((c) => {
              const on = childIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  className={`child-chip${on ? '' : ''}`}
                  style={
                    on
                      ? { borderColor: 'var(--brand-500)', background: 'var(--brand-50)' }
                      : undefined
                  }
                  aria-pressed={on}
                  onClick={() =>
                    setChildIds((ids) =>
                      ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id],
                    )
                  }
                >
                  <Avatar name={c.firstName} color={c.avatarColor} size="xs" />
                  {c.firstName}
                  {on && <IconCheck size={12} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* -- Safety ---------------------------------------------------- */}
        <div className="card card-pad stack stack-4" style={{ background: 'var(--ok-50)', borderColor: 'var(--ok-100)' }}>
          <div className="row row-3 strong small" style={{ color: 'var(--ok-700)' }}>
            <IconShieldCheck size={16} />
            {t('pd.beforeSend')}
          </div>

          <label className="checkbox" data-checked={adultPresent} style={{ background: 'var(--surface)' }}>
            <input
              type="checkbox"
              checked={adultPresent}
              onChange={(e) => setAdultPresent(e.target.checked)}
            />
            <div>
              <div className="strong small">{t('pd.adultPresent')}</div>
              <div className="tiny muted">
                {t('pd.adultPresentDesc')}
              </div>
            </div>
          </label>

          {!adultPresent && (
            <Alert tone="warn">
              <div className="row row-2">
                <IconAlert size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  {t('pd.dropOffWarn')}
                </span>
              </div>
            </Alert>
          )}

          {!finalPlace.isPublic && (
            <Alert tone="warn">
              {t('pd.homeWarn')}
            </Alert>
          )}
        </div>

        <Field label={t('pd.anythingElse')} htmlFor="pd-notes" optional>
          <textarea
            id="pd-notes"
            className="textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={400}
            placeholder={t('pd.notesPlaceholder')}
          />
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

function defaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

/* ========================================================================== */
/* Share with a trusted adult                                                  */
/* ========================================================================== */

function ShareWithAdultModal({
  playdate,
  onClose,
  onDone,
}: {
  playdate: PlayDate;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const { d } = useI18n();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={t('pd.tellTrustedAdult')}
      description={t('pd.shareSub')}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              await api.sharePlanWithTrustedAdult(playdate.id, name);
              setBusy(false);
              onDone();
            }}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="stack stack-4">
        <p className="muted">
          {t('pd.shareP')}
        </p>

        <div className="panel small">
          <div className="strong">{playdate.place.label}</div>
          <div className="muted">
            {d(playdate.startsAt, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · {playdate.place.area}
          </div>
        </div>

        <Field
          label={t('pd.shareWho')}
          htmlFor="share-name"
          hint={t('pd.shareHint')}
        >
          <input
            id="share-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('pd.sharePlaceholder')}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ========================================================================== */
/* Post-meeting check-in                                                       */
/* ========================================================================== */

function PostMeetingModal({
  playdate,
  onClose,
  onDone,
}: {
  playdate: PlayDate;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [wentWell, setWentWell] = useState<boolean | null>(null);
  const [meetAgain, setMeetAgain] = useState<boolean | null>(null);
  const [concerns, setConcerns] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={t('pd.howDidItGo')}
      description={t('pd.feedbackSub')}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {t('common.skip')}
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || wentWell === null}
            onClick={async () => {
              setBusy(true);
              await api.submitPostMeetingFeedback(playdate.id, {
                wentWell: wentWell ?? true,
                wouldMeetAgain: meetAgain ?? false,
                concerns: concerns || undefined,
              });
              setBusy(false);
              onDone();
            }}
          >
            {t('common.submit')}
          </button>
        </>
      }
    >
      <div className="stack stack-5">
        <div className="field">
          <span className="label">{t('pd.wentWell')}</span>
          <div className="row row-3">
            <button
              className={`btn ${wentWell === true ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setWentWell(true)}
            >
              {t('pd.wentWellYes')}
            </button>
            <button
              className={`btn ${wentWell === false ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setWentWell(false)}
            >
              {t('pd.wentWellNo')}
            </button>
          </div>
        </div>

        <div className="field">
          <span className="label">{t('pd.meetAgain')}</span>
          <div className="row row-3">
            <button
              className={`btn ${meetAgain === true ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMeetAgain(true)}
            >
              Yes
            </button>
            <button
              className={`btn ${meetAgain === false ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMeetAgain(false)}
            >
              No
            </button>
          </div>
        </div>

        <Field
          label={t('pd.concerns')}
          htmlFor="pm-concerns"
          optional
          hint={t('pd.concernsHint')}
        >
          <textarea
            id="pm-concerns"
            className="textarea"
            value={concerns}
            onChange={(e) => setConcerns(e.target.value)}
            maxLength={600}
          />
        </Field>

        {wentWell === false && (
          <Alert tone="info" title={t('pd.sorryTitle')}>
            {t('pd.sorryBody')}
          </Alert>
        )}
      </div>
    </Modal>
  );
}
