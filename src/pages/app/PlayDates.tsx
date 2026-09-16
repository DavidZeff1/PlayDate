import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type PlayDateView } from '../../services';
import { useApp } from '../../state/AppContext';
import type { FamilyProjection, MeetingPlace, PlayDate } from '../../domain/types';
import { PLAYDATE_ACTIVITIES } from '../../domain/interests';
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
        <h1>PlayDates</h1>
        <p>
          Arrange a meeting somewhere public. You never have to share your home address to
          plan a playdate on PlayDate.
        </p>
      </div>

      <Tabs
        label="PlayDates"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { value: 'past', label: 'Past', count: past.length },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<IconCalendar size={22} />}
          title={tab === 'upcoming' ? 'Nothing planned yet' : 'No past playdates'}
          description={
            tab === 'upcoming'
              ? 'Once you have connected with a family, you can propose a playdate from your conversation.'
              : 'Playdates that have happened, been declined or been cancelled appear here.'
          }
          action={
            tab === 'upcoming' ? (
              <Link to="/app/messages" className="btn btn-secondary">
                Go to messages
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
                  response === 'confirmed' ? 'PlayDate confirmed.' : 'Response sent.',
                  'ok',
                );
                await load();
              }}
              onCancel={async () => {
                await api.cancelPlayDate(view.playdate.id);
                toast.push('PlayDate cancelled.', 'ok');
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
          <strong>For a first meeting</strong>, a public place with both parents present is the
          norm on PlayDate. It gives the children space to play and the parents a chance to
          meet properly.
        </SafetyNote>
      )}

      {sharing && (
        <ShareWithAdultModal
          playdate={sharing}
          onClose={() => setSharing(null)}
          onDone={async () => {
            setSharing(null);
            toast.push('Plan shared.', 'ok');
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
            toast.push('Thank you — this stays private to you.', 'ok');
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
  const { playdate: p, otherFamily } = view;
  const d = new Date(p.startsAt);
  const isMine = p.proposedByFamilyId === myFamilyId;
  const needsMyResponse = p.status === 'proposed' && !isMine;
  const isPast = d.getTime() < Date.now();

  const tone =
    p.status === 'confirmed' ? 'ok' : p.status === 'proposed' ? 'pending' : p.status === 'completed' ? 'brand' : 'neutral';

  const label =
    p.status === 'confirmed'
      ? 'Confirmed'
      : p.status === 'proposed'
        ? isMine
          ? 'Awaiting their reply'
          : 'Needs your reply'
        : p.status === 'completed'
          ? 'Completed'
          : p.status === 'cancelled'
            ? 'Cancelled'
            : 'Declined';

  return (
    <section className="card">
      <div className="playdate-card">
        <div className="date-block">
          <div className="dow">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
          <div className="dom">{d.getDate()}</div>
          <div className="time">
            {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div className="grow stack stack-3">
          <div>
            <div className="row row-3 row-wrap">
              <h3 style={{ fontSize: 'var(--text-md)' }}>{p.place.label}</h3>
              <Badge tone={tone}>{label}</Badge>
              {p.place.isPublic ? (
                <Badge tone="ok">Public place</Badge>
              ) : (
                <Badge tone="pending">Private home</Badge>
              )}
            </div>
            <div className="row row-wrap small muted" style={{ gap: 'var(--sp-4)', marginTop: 6 }}>
              <span className="row row-2">
                <IconUsers size={12} />
                with {otherFamily.displayName}
              </span>
              <span className="row row-2">
                <IconMapPin size={12} />
                {p.place.area}
              </span>
              <span className="row row-2">
                <IconClock size={12} />
                {p.durationMinutes} minutes
              </span>
            </div>
          </div>

          {p.notes && <p className="small muted">{p.notes}</p>}

          <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
            {Object.entries(p.adultPresent).map(([fid, present]) =>
              present ? (
                <span key={fid} className="badge badge-ok">
                  <IconCheck size={10} />
                  {fid === myFamilyId ? 'You will be there' : 'They will be there'}
                </span>
              ) : null,
            )}
            {p.sharedWith?.map((s, i) => (
              <span key={i} className="badge badge-neutral">
                <IconShieldCheck size={10} />
                Shared with {s.name}
              </span>
            ))}
          </div>
        </div>

        <div className="stack stack-2" style={{ minWidth: 150 }}>
          {needsMyResponse && (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => onRespond('confirmed')}>
                Confirm
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onRespond('declined')}>
                Can't make it
              </button>
            </>
          )}

          {p.status === 'confirmed' && !isPast && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={onShare}>
                Tell a trusted adult
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onCancel}>
                Cancel
              </button>
            </>
          )}

          {p.status === 'confirmed' && isPast && (
            <button className="btn btn-secondary btn-sm" onClick={onFeedback}>
              How did it go?
            </button>
          )}

          {p.status === 'proposed' && isMine && (
            <button className="btn btn-ghost btn-sm" onClick={onCancel}>
              Withdraw
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
    ? { label: customPlace, kind: 'other', area: otherFamily.locationLabel, isPublic: true }
    : place;

  const submit = async () => {
    if (useCustom && !customPlace.trim()) {
      setError('Give the meeting place a name.');
      return;
    }
    if (childIds.length === 0) {
      setError('Choose at least one child to come along.');
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
      setError(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Plan a playdate with ${otherFamily.displayName}`}
      description="They will need to confirm before it is booked."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Sending…' : 'Send PlayDate request'}
          </button>
        </>
      }
    >
      <div className="stack stack-6">
        {/* -- Activity -------------------------------------------------- */}
        <div className="field">
          <span className="label">What would you do?</span>
          <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
            {PLAYDATE_ACTIVITIES.map((a) => (
              <button
                key={a.id}
                className={`interest-tag${activity === a.id ? ' interest-tag-shared' : ''}`}
                onClick={() => setActivity(a.id)}
                aria-pressed={activity === a.id}
              >
                <span aria-hidden="true">{a.emoji}</span>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* -- Place ----------------------------------------------------- */}
        <div className="field">
          <span className="label">Where would you meet?</span>
          <div className="hint">
            Public places work best for a first meeting — the children can play freely and
            neither family has to share where they live.
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
                    <span className="badge badge-ok">Public</span>
                  </div>
                  <div className="tiny muted">{sp.area}</div>
                </div>
              </label>
            ))}

            <label className="radio" data-checked={useCustom}>
              <input type="radio" name="place" checked={useCustom} onChange={() => setUseCustom(true)} />
              <div className="grow">
                <div className="strong small">Somewhere else</div>
                {useCustom && (
                  <input
                    className="input"
                    style={{ marginTop: 'var(--sp-2)' }}
                    value={customPlace}
                    onChange={(e) => setCustomPlace(e.target.value)}
                    placeholder="A park, café or community centre"
                    aria-label="Meeting place"
                  />
                )}
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  Please do not enter a home address here — you can agree that privately once
                  you know each other.
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
          <Field label="Date" htmlFor="pd-date">
            <input
              id="pd-date"
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Start time" htmlFor="pd-time">
            <input
              id="pd-time"
              className="input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
          <Field label="How long?" htmlFor="pd-dur">
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
          <span className="label">Which of your children are coming?</span>
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
            Before you send
          </div>

          <label className="checkbox" data-checked={adultPresent} style={{ background: 'var(--surface)' }}>
            <input
              type="checkbox"
              checked={adultPresent}
              onChange={(e) => setAdultPresent(e.target.checked)}
            />
            <div>
              <div className="strong small">A parent or guardian from our family will be there</div>
              <div className="tiny muted">
                Both families confirm this. For a first meeting we strongly recommend it.
              </div>
            </div>
          </label>

          {!adultPresent && (
            <Alert tone="warn">
              <div className="row row-2">
                <IconAlert size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  Drop-off playdates are something most parents arrange only once they know a
                  family well. There is no hurry.
                </span>
              </div>
            </Alert>
          )}

          {!finalPlace.isPublic && (
            <Alert tone="warn">
              You have chosen a private home. That is a normal thing to do between families who
              know each other — for a first meeting, a public place is usually easier for
              everyone.
            </Alert>
          )}
        </div>

        <Field label="Anything else to add?" htmlFor="pd-notes" optional>
          <textarea
            id="pd-notes"
            className="textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={400}
            placeholder="By the big climbing frame. We usually bring a ball."
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
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title="Tell a trusted adult"
      description="Record that someone else knows where you will be."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
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
            Save
          </button>
        </>
      }
    >
      <div className="stack stack-4">
        <p className="muted">
          Many parents tell a friend or relative where they are going. This records that you
          did, so it is in one place if it ever matters.
        </p>

        <div className="panel small">
          <div className="strong">{playdate.place.label}</div>
          <div className="muted">
            {new Date(playdate.startsAt).toLocaleString('en-GB', {
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
          label="Who have you told?"
          htmlFor="share-name"
          hint="A first name is enough. We do not contact them — this is a note for you."
        >
          <input
            id="share-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My sister Dana"
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
  const [wentWell, setWentWell] = useState<boolean | null>(null);
  const [meetAgain, setMeetAgain] = useState<boolean | null>(null);
  const [concerns, setConcerns] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title="How did it go?"
      description="Private to you. The other family never sees this, and it does not appear on anyone's profile."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Skip
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
            Submit
          </button>
        </>
      }
    >
      <div className="stack stack-5">
        <div className="field">
          <span className="label">Did the playdate go well?</span>
          <div className="row row-3">
            <button
              className={`btn ${wentWell === true ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setWentWell(true)}
            >
              Yes, it went well
            </button>
            <button
              className={`btn ${wentWell === false ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setWentWell(false)}
            >
              Not really
            </button>
          </div>
        </div>

        <div className="field">
          <span className="label">Would you meet this family again?</span>
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
          label="Anything that concerned you?"
          htmlFor="pm-concerns"
          optional
          hint="If something worried you, please also submit a report — feedback here is private and is not routed to our safety team."
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
          <Alert tone="info" title="Sorry to hear that.">
            Not every pairing works, and that is normal. You can leave the conversation or block
            the family at any time, and neither action is shared with them. If something
            concerning happened, please report it.
          </Alert>
        )}
      </div>
    </Modal>
  );
}
