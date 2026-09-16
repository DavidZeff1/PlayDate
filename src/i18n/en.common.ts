/**
 * English strings — the source of truth.
 *
 * `TKey` is derived from this object, so every other dictionary is typed as
 * `Record<TKey, string>`: adding a key here and forgetting it in Hebrew is a build
 * error, not a string that quietly falls back on screen.
 *
 * Flat dotted keys rather than nested objects, so a key is greppable verbatim from the
 * component that uses it.
 *
 * Placeholders are `{name}`. Numbers passed as interpolation values are formatted for
 * the active locale.
 */
export const enCommon = {
  // ---------------------------------------------------------------- common
  'common.save': 'Save',
  'common.saveChanges': 'Save changes',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.done': 'Done',
  'common.edit': 'Edit',
  'common.remove': 'Remove',
  'common.back': 'Back',
  'common.continue': 'Continue',
  'common.confirm': 'Confirm',
  'common.decline': 'Decline',
  'common.accept': 'Accept',
  'common.submit': 'Submit',
  'common.skip': 'Skip',
  'common.send': 'Send',
  'common.sending': 'Sending…',
  'common.saving': 'Saving…',
  'common.loading': 'Loading…',
  'common.optional': 'optional',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.or': 'or',
  'common.report': 'Report',
  'common.block': 'Block',
  'common.unblock': 'Unblock',
  'common.leave': 'Leave',
  'common.withdraw': 'Withdraw',
  'common.retry': 'Try again',
  'common.somethingWrong': 'Something went wrong.',
  'common.child': 'child',
  'common.children': 'children',
  'common.years': 'years',
  'common.year': 'year',
  'common.yearsOld': '{n} years old',
  'common.ageRange': '{from}–{to} years old',
  'common.childN': 'Child {n}',
  'common.andMore': '+{n} more',
  'common.justNow': 'just now',
  'common.minAgo': '{n} min ago',
  'common.hourAgo': '{n} hour ago',
  'common.hoursAgo': '{n} hours ago',
  'common.dayAgo': '{n} day ago',
  'common.daysAgo': '{n} days ago',
  'common.charCount': '{n}/{max}',
  'common.notSet': 'Not set',

  // ------------------------------------------------------------- language
  'lang.label': 'Language',
  'lang.switch': 'Change language',
  'lang.en': 'English',
  'lang.he': 'עברית',

  // ------------------------------------------------------------------- nav
  'nav.dashboard': 'Dashboard',
  'nav.yourFamily': 'Your family',
  'nav.myFamily': 'My family',
  'nav.myChildren': 'My children',
  'nav.connect': 'Connect',
  'nav.discover': 'Discover families',
  'nav.matches': 'Matches',
  'nav.requests': 'Requests',
  'nav.messages': 'Messages',
  'nav.playdates': 'PlayDates',
  'nav.account': 'Account',
  'nav.notifications': 'Notifications',
  'nav.verification': 'Verification',
  'nav.safetyCentre': 'Safety Centre',
  'nav.settings': 'Settings',
  'nav.staffTools': 'Staff tools',
  'nav.moderation': 'Moderation (demo)',
  'nav.signOut': 'Sign out',
  'nav.openNav': 'Open navigation',
  'nav.closeNav': 'Close navigation',
  'nav.skipToContent': 'Skip to content',
  'nav.main': 'Main',
  'nav.howItWorks': 'How it works',
  'nav.safety': 'Safety',
  'nav.privacy': 'Privacy',
  'nav.signIn': 'Sign in',
  'nav.createAccount': 'Create account',
  'nav.goToDashboard': 'Go to dashboard',
  'nav.unreadNotifications': '{n} unread notifications',
  'nav.loadingFamily': 'Loading your family…',

  // -------------------------------------------------------------- footer
  'footer.tagline':
    'Families discovering families. Verified parents, controlled discovery, and nothing shared without consent.',
  'footer.product': 'Product',
  'footer.createAccount': 'Create an account',
  'footer.forParents': 'For parents',
  'footer.meetingSafely': 'Meeting safely',
  'footer.reportingBlocking': 'Reporting & blocking',
  'footer.whatWeShow': 'What we show about children',
  'footer.whatWeCollect': 'What we collect',
  'footer.aboutBuild': 'About this build',
  'footer.notLive': 'Prototype — not a live service',
  'footer.verifSimulated': 'Verification is simulated',
  'footer.mockOnly': 'Mock data only',
  'footer.bottomLeft': 'PlayDate — MVP prototype. Fictional families, simulated verification.',
  'footer.bottomRight':
    'Legal, privacy and child-safety review are production requirements, not completed work.',

  // ------------------------------------------------------------ prototype
  'proto.label': 'Prototype',
  'proto.landing':
    'This is a working prototype with fictional families. Identity verification is <b>simulated</b>, not real, and no information here has been security-audited or legally reviewed.',
  'proto.login':
    'No real accounts exist. Use “Explore as the Cohen family” to sign in to the seeded demo family with matches, requests and a confirmed playdate already set up.',
  'proto.password':
    'In production, passwords are hashed server-side with Argon2id and checked against a breached-password list. This prototype has no server, so it stores a placeholder — never a real password.',
  'proto.codes':
    'There is no email or SMS provider in this prototype, so the codes are shown to you below. A real system sends them out of band and never returns them to the browser.',
  'proto.verifNoProvider':
    'No provider is connected. Choose an outcome below to continue the demo. This is a simulation, not a verification.',
  'proto.verifPage':
    'No identity provider is connected to this build. Anything below marked <i>simulated</i> is a demonstration of the workflow, not a real identity check. A verified badge produced here means nothing about any real person.',
  'proto.dashboard':
    'You are signed in to a demo family with fictional data. Identity verification is simulated. Nothing here is a real account or a real person.',
  'proto.security':
    'The list above describes the production design. In this browser-only prototype, sessions are held in localStorage rather than HttpOnly cookies, and there is no server to hash a password. See docs/PROTOTYPE_DISCLOSURES.md for the full difference.',
  'proto.admin':
    'In production this is a separate application behind separate staff authentication, with role-scoped access: a verification agent sees identity decisions and never a family’s conversations. It is shown here to demonstrate the concept, and opening it from a parent account is itself written to the audit log.',
  'proto.safetyPage':
    'The protections described here are implemented in this prototype’s code, but the prototype has not been penetration-tested, audited, or legally reviewed, and identity verification is simulated. Treat this page as a description of the design, not a certification.',

  // -------------------------------------------------- domain: categories
  'cat.creative': 'Creative',
  'cat.active': 'Active & sport',
  'cat.games': 'Games',
  'cat.outdoors': 'Outdoors',
  'cat.learning': 'Learning & curiosity',
  'cat.social': 'Play style',

  // --------------------------------------------------- domain: interests
  'interest.lego': 'LEGO & building',
  'interest.drawing': 'Drawing & painting',
  'interest.crafts': 'Arts & crafts',
  'interest.music': 'Music & singing',
  'interest.baking': 'Baking & cooking',
  'interest.dressup': 'Dress-up & pretend play',
  'interest.football': 'Football',
  'interest.basketball': 'Basketball',
  'interest.swimming': 'Swimming',
  'interest.cycling': 'Cycling & scooters',
  'interest.dance': 'Dance',
  'interest.gymnastics': 'Gymnastics & climbing',
  'interest.martial_arts': 'Martial arts',
  'interest.board_games': 'Board games',
  'interest.puzzles': 'Puzzles',
  'interest.card_games': 'Card games',
  'interest.chess': 'Chess',
  'interest.video_games': 'Video games',
  'interest.playground': 'Playgrounds',
  'interest.nature': 'Nature & hiking',
  'interest.animals': 'Animals & pets',
  'interest.gardening': 'Gardening',
  'interest.water_play': 'Water play',
  'interest.dinosaurs': 'Dinosaurs',
  'interest.space': 'Space & astronomy',
  'interest.science': 'Science experiments',
  'interest.reading': 'Reading & stories',
  'interest.coding': 'Coding & robotics',
  'interest.trains': 'Trains & vehicles',
  'interest.imaginative': 'Imaginative play',
  'interest.group_games': 'Group games',
  'interest.quiet_play': 'Quiet one-on-one play',

  // -------------------------------------------------- domain: importance
  'importance.1': 'Not important',
  'importance.2': 'Slight preference',
  'importance.3': 'Important',
  'importance.4': 'Very important',
  'importance.5': 'Extremely important',
  'enthusiasm.1': 'Will join in',
  'enthusiasm.2': 'Quite likes it',
  'enthusiasm.3': 'Really enjoys it',
  'enthusiasm.4': 'Loves it',
  'enthusiasm.5': "It's their favourite thing",

  // --------------------------------------------------- domain: activities
  'activity.playground': 'Playground',
  'activity.park': 'Park meet-up',
  'activity.lego': 'LEGO & building',
  'activity.board_games': 'Board games',
  'activity.swimming': 'Swimming',
  'activity.sports': 'Sports & ball games',
  'activity.crafts': 'Arts & crafts',
  'activity.baking': 'Baking together',
  'activity.museum': 'Museum or exhibition',
  'activity.other': 'Something else',

  // -------------------------------------------------------- domain: days
  'day.sun': 'Sunday',
  'day.mon': 'Monday',
  'day.tue': 'Tuesday',
  'day.wed': 'Wednesday',
  'day.thu': 'Thursday',
  'day.fri': 'Friday',
  'day.sat': 'Saturday',
  'block.morning': 'Morning',
  'block.afternoon': 'Afternoon',
  'block.evening': 'Evening',
  'blockPlural.morning': 'mornings',
  'blockPlural.afternoon': 'afternoons',
  'blockPlural.evening': 'evenings',
  'avail.weekend': 'Weekend {blocks}',
  'avail.weekday': 'Weekday {blocks}',
  'avail.mostDays': 'Most days, {blocks}',
  'avail.none': 'No availability set',

  // ------------------------------------------------------ domain: styles
  'style.parents_stay': 'Parents stay',
  'style.drop_off_ok': 'Drop-off welcome',
  'style.public_places_only': 'Public places',
  'style.home_visits_ok': 'Home visits OK',
  'style.small_groups': 'Small groups',
  'style.structured_activities': 'Planned activities',
  'styleDesc.parents_stay': 'A parent stays for the whole visit.',
  'styleDesc.public_places_only': 'Parks, playgrounds and other public places.',
  'styleDesc.home_visits_ok': 'Happy to visit homes once we know each other.',
  'styleDesc.drop_off_ok': 'Open to drop-off playdates with familiar families.',
  'styleDesc.small_groups': 'One or two children rather than a crowd.',
  'styleDesc.structured_activities': 'A planned activity rather than free play.',
  'stylePhrase.parents_stay': 'parents staying for the visit',
  'stylePhrase.drop_off_ok': 'drop-off playdates',
  'stylePhrase.public_places_only': 'meeting in public places',
  'stylePhrase.home_visits_ok': 'home visits',
  'stylePhrase.small_groups': 'small groups',
  'stylePhrase.structured_activities': 'a planned activity',

  // ------------------------------------------------ domain: verification
  'verif.verified.label': 'Parent verified',
  'verif.verified.desc': 'This parent completed identity verification.',
  'verif.pending.label': 'Verification pending',
  'verif.pending.desc':
    'Identity verification is in progress. Discovery unlocks once it completes.',
  'verif.failed.label': 'Verification failed',
  'verif.failed.desc':
    'Identity verification did not complete. You can retry or contact support.',
  'verif.required.label': 'Verification required',
  'verif.required.desc':
    'Identity verification is required before you can browse or contact families.',
  'verif.unstarted.label': 'Verification not started',
  'verif.unstarted.desc': 'Start verification to unlock discovery.',
  'verif.expired.label': 'Verification expired',
  'verif.expired.desc': 'Your verification has expired and needs renewing.',

  // ------------------------------------------------ domain: trust signals
  'trust.email_verified': 'Email verified',
  'trust.phone_verified': 'Phone verified',
  'trust.government_id_verified': 'Government ID verified',
  'trust.two_factor_enabled': 'Two-factor authentication on',
  'trust.secondary_parent_verified': 'Second parent verified',
  'trust.profile_complete': 'Family profile complete',
  'trust.account_age': 'Account age',
  'trust.completed_playdates': 'Playdates completed',
  'trust.community_standing': 'Community standing',
  'trustDesc.email_verified': 'They confirmed a working email address.',
  'trustDesc.phone_verified': 'They confirmed a working phone number by SMS code.',
  'trustDesc.government_id_verified':
    'A third-party identity provider checked a government-issued ID against a selfie. PlayDate never stores the document.',
  'trustDesc.two_factor_enabled': 'Their account requires a second factor at sign-in.',
  'trustDesc.secondary_parent_verified':
    'A second parent on this family has also completed verification.',
  'trustDesc.profile_complete':
    'They have filled in their family profile, children and availability.',
  'trustDesc.account_age': 'How long they have been on PlayDate.',
  'trustDesc.completed_playdates':
    'Playdates confirmed by both families and marked as completed.',
  'trustDesc.community_standing': 'No upheld safety reports against this family.',
  'trust.memberSince': 'Member since {month}',
  'trust.idChecked': 'Checked by an identity provider',
  'trust.idInProgress': 'Check in progress',
  'trust.noPlaydates': 'No playdates yet',
  'trust.playdatesDone': '{n} playdates completed',
  'trust.onePlaydateDone': '1 playdate completed',
  'trust.noUpheldReports': 'No upheld reports',
  'trust.none': 'No verified signals yet',

  // -------------------------------------------------- domain: match bands
  'band.strong': 'Strong potential match',
  'band.good': 'Good potential match',
  'band.possible': 'Possible match',
  'band.weak': 'Limited overlap',

  // ----------------------------------------------- domain: match reasons
  'reason.sameAge': 'Children are the same age',
  'reason.sameAgeDetail': 'Both {age} years old.',
  'reason.inAgeRange': 'Children are within your preferred age range',
  'reason.inAgeRangeDetail':
    'Closest pairing is {gap} years apart, inside your {tolerance}-year preference.',
  'reason.inAgeRangeDetailOne':
    'Closest pairing is 1 year apart, inside your {tolerance}-year preference.',
  'reason.oneSharedInterest': '1 shared interest: {named}',
  'reason.sharedInterests': '{n} shared interests',
  'reason.sharedInterestsDetail': 'Including {named}.',
  'reason.mattersToBoth': '{interest} matters to both families',
  'reason.mattersToBothDetail':
    'You marked this highly important, and their child is enthusiastic about it too.',
  'reason.noOverlap': 'No overlapping interests yet',
  'reason.noOverlapDetail':
    'Children often find common ground in person — this is worth weighing, not a dealbreaker.',
  'reason.distance': 'Families are approximately {band} apart',
  'reason.distanceDetail': "Within the {km} km you're happy to travel.",
  'reason.availability': 'Availability overlaps on {phrases}',
  'reason.availabilityDetail': '{n} overlapping time slots in total.',
  'reason.bothPrefer': 'Both families prefer {styles}',
  'reason.dropOffMismatch': 'They are open to drop-off playdates; you prefer to stay',
  'reason.dropOffMismatchDetail': 'Worth agreeing on before the first meeting.',
  'exclude.ageGap': 'Closest ages are {gap} years apart — outside your {tolerance}-year range',
  'exclude.noChildren': 'No children to compare',
  'exclude.tooFar': 'About {band} away — beyond the {km} km either family travels',
  'exclude.noAvailability': 'No overlapping availability',
  'exclude.blocked': 'Blocked',
  'exclude.notDiscoverable': 'This family is not currently discoverable',
  'exclude.notAvailable': 'This family is not currently available',
  'exclude.noChildrenOnProfile': 'No children on this family profile',

  // ----------------------------------------------- domain: distance bands
  'dist.under1': 'Under 1 km',
  'dist.1to2': '1–2 km',
  'dist.2to4': '2–4 km',
  'dist.4to7': '4–7 km',
  'dist.7to12': '7–12 km',
  'dist.12to20': '12–20 km',
  'dist.over20': 'Over 20 km',
  'dist.aboutAway': 'About {band} away',

  // ------------------------------------------------- domain: safety tips
  'tip.public.title': 'Meet in a public place first',
  'tip.public.body':
    'Playgrounds, parks and community centres let children play freely while both parents are present and comfortable.',
  'tip.stay.title': 'Both parents stay for the first visit',
  'tip.stay.body':
    'A first playdate is as much about the parents meeting as the children. Drop-offs can come later, once you know each other.',
  'tip.tell.title': 'Tell someone else your plan',
  'tip.tell.body':
    'Share the time and place with another adult you trust. PlayDate can do this for you when you confirm a playdate.',
  'tip.onPlatform.title': 'Keep conversations on PlayDate',
  'tip.onPlatform.body':
    'If a conversation moves to another app, reporting and blocking no longer protect you. There is no hurry to swap numbers.',
  'tip.noExplanation.title': 'You never owe anyone an explanation',
  'tip.noExplanation.body':
    'Decline, leave a conversation, or block at any time. The other family is not told why, and declining is never held against you.',
  'tip.instinct.title': 'Trust your instinct, then tell us',
  'tip.instinct.body':
    'If something feels wrong — pressure, secrecy, too much interest in your child specifically — report it. Reports are reviewed by people, not bots.',

  // ---------------------------------------------- domain: report reasons
  'report.child_safety_urgent.label': 'Immediate concern for a child',
  'report.child_safety_urgent.desc':
    'Something that needs urgent review. Prioritised ahead of everything else.',
  'report.suspicious_behavior.label': 'Suspicious behaviour',
  'report.suspicious_behavior.desc':
    'Pressure, secrecy, unusual interest in a child, or attempts to arrange unsupervised contact.',
  'report.fake_identity.label': 'Fake or misleading identity',
  'report.fake_identity.desc': 'You believe this person is not who they say they are.',
  'report.harassment.label': 'Harassment',
  'report.harassment.desc': 'Repeated unwanted contact, hostility, or intimidation.',
  'report.inappropriate_messages.label': 'Inappropriate messages',
  'report.inappropriate_messages.desc':
    'Sexual, violent, or otherwise inappropriate content in a conversation.',
  'report.misrepresentation.label': 'Profile misrepresentation',
  'report.misrepresentation.desc':
    'Their family profile does not reflect reality — wrong ages, invented children, misleading details.',
  'report.unwanted_contact.label': 'Unwanted contact',
  'report.unwanted_contact.desc':
    'They keep contacting you after you declined or left the conversation.',
  'report.safety_concern.label': 'Other safety concern',
  'report.safety_concern.desc': 'Something that worried you during or after a playdate.',
  'report.inappropriate_content.label': 'Inappropriate content',
  'report.inappropriate_content.desc':
    'Photos, profile text, or other content that should not be on PlayDate.',

  // ------------------------------------------- domain: message scan flags
  'scan.phone':
    'This looks like a phone number. Keeping conversations on PlayDate means reports and blocking still work if something goes wrong.',
  'scan.email':
    'This looks like an email address. You can share contact details later — there is no rush before you have met.',
  'scan.offPlatform':
    'Moving to another app early is common, but it means PlayDate can no longer help if there is a problem. Consider staying here until after you have met.',
  'scan.address':
    'This looks like a street address. We suggest not sharing your home address before a first meeting in a public place.',
  'scan.unsupervised': 'For a first meeting, we recommend both parents stay for the whole visit.',
  'scan.secrecy':
    'Requests for secrecy are a recognised warning sign. If this message made you uncomfortable, you can report it — reports are reviewed by our safety team.',
  'scan.childContact':
    'PlayDate does not support contacting another family’s child directly, and asking for a child’s contact details is against our safety rules. Please report this if it concerns you.',
} as const;
