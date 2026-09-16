import type { enCommon } from './en.common';

type Strings<T> = { [K in keyof T]: string };

/**
 * Hebrew — common strings and domain vocabulary.
 *
 * Two translation decisions worth recording, because they run through every string:
 *
 *  1. **The reader is addressed as "אתם" (plural).** Hebrew inflects the second person
 *     by gender, so "you" forces a choice that is wrong for roughly half of readers.
 *     Addressing the family rather than the individual parent is both natural for this
 *     product and sidesteps the problem entirely — "המשפחה שלכם", "אתם יכולים".
 *
 *  2. **"PlayDate" stays in Latin script** as the product name, while the event is
 *     "מפגש משחק". Transliterating the brand ("פליידייט") would read as an import;
 *     translating the event keeps the interface in Hebrew where it matters.
 */
export const heCommon: Strings<typeof enCommon> = {
  // ---------------------------------------------------------------- common
  'common.save': 'שמירה',
  'common.saveChanges': 'שמירת שינויים',
  'common.cancel': 'ביטול',
  'common.close': 'סגירה',
  'common.done': 'סיום',
  'common.edit': 'עריכה',
  'common.remove': 'הסרה',
  'common.back': 'חזרה',
  'common.continue': 'המשך',
  'common.confirm': 'אישור',
  'common.decline': 'דחייה',
  'common.accept': 'אישור',
  'common.submit': 'שליחה',
  'common.skip': 'דילוג',
  'common.send': 'שליחה',
  'common.sending': 'שולח…',
  'common.saving': 'שומר…',
  'common.loading': 'טוען…',
  'common.optional': 'לא חובה',
  'common.yes': 'כן',
  'common.no': 'לא',
  'common.or': 'או',
  'common.report': 'דיווח',
  'common.block': 'חסימה',
  'common.unblock': 'ביטול חסימה',
  'common.leave': 'יציאה',
  'common.withdraw': 'ביטול הבקשה',
  'common.retry': 'ניסיון נוסף',
  'common.somethingWrong': 'משהו השתבש.',
  'common.child': 'ילד',
  'common.children': 'ילדים',
  'common.years': 'שנים',
  'common.year': 'שנה',
  'common.yearsOld': 'בן/בת {n}',
  'common.ageRange': 'גילאי {from}–{to}',
  'common.childN': 'ילד {n}',
  'common.andMore': 'עוד {n}',
  'common.justNow': 'כרגע',
  'common.minAgo': 'לפני {n} דקות',
  'common.hourAgo': 'לפני שעה',
  'common.hoursAgo': 'לפני {n} שעות',
  'common.dayAgo': 'אתמול',
  'common.daysAgo': 'לפני {n} ימים',
  'common.charCount': '{n}/{max}',
  'common.notSet': 'לא הוגדר',

  // ------------------------------------------------------------- language
  'lang.label': 'שפה',
  'lang.switch': 'שינוי שפה',
  'lang.en': 'English',
  'lang.he': 'עברית',

  // ------------------------------------------------------------------- nav
  'nav.dashboard': 'לוח בקרה',
  'nav.yourFamily': 'המשפחה שלכם',
  'nav.myFamily': 'המשפחה שלי',
  'nav.myChildren': 'הילדים שלי',
  'nav.connect': 'התחברות',
  'nav.discover': 'גילוי משפחות',
  'nav.matches': 'התאמות',
  'nav.requests': 'בקשות',
  'nav.messages': 'הודעות',
  'nav.playdates': 'מפגשי משחק',
  'nav.account': 'חשבון',
  'nav.notifications': 'התראות',
  'nav.verification': 'אימות',
  'nav.safetyCentre': 'מרכז הבטיחות',
  'nav.settings': 'הגדרות',
  'nav.staffTools': 'כלי צוות',
  'nav.moderation': 'ניהול תוכן (הדגמה)',
  'nav.signOut': 'התנתקות',
  'nav.openNav': 'פתיחת תפריט',
  'nav.closeNav': 'סגירת תפריט',
  'nav.skipToContent': 'דילוג לתוכן',
  'nav.main': 'ראשי',
  'nav.howItWorks': 'איך זה עובד',
  'nav.safety': 'בטיחות',
  'nav.privacy': 'פרטיות',
  'nav.signIn': 'כניסה',
  'nav.createAccount': 'פתיחת חשבון',
  'nav.goToDashboard': 'ללוח הבקרה',
  'nav.unreadNotifications': '{n} התראות שלא נקראו',
  'nav.loadingFamily': 'טוען את המשפחה שלכם…',

  // -------------------------------------------------------------- footer
  'footer.tagline':
    'משפחות מגלות משפחות. הורים מאומתים, גילוי מבוקר, ושום דבר לא נחשף בלי הסכמה.',
  'footer.product': 'המוצר',
  'footer.createAccount': 'פתיחת חשבון',
  'footer.forParents': 'להורים',
  'footer.meetingSafely': 'להיפגש בבטחה',
  'footer.reportingBlocking': 'דיווח וחסימה',
  'footer.whatWeShow': 'מה מוצג על ילדים',
  'footer.whatWeCollect': 'איזה מידע נאסף',
  'footer.aboutBuild': 'על הגרסה הזו',
  'footer.notLive': 'אב־טיפוס — לא שירות פעיל',
  'footer.verifSimulated': 'האימות מדומה',
  'footer.mockOnly': 'נתוני הדגמה בלבד',
  'footer.bottomLeft': 'PlayDate — אב־טיפוס MVP. משפחות בדיוניות, אימות מדומה.',
  'footer.bottomRight':
    'בדיקה משפטית, בדיקת פרטיות וסקירת בטיחות ילדים הן דרישות לייצור — לא עבודה שהושלמה.',

  // ------------------------------------------------------------ prototype
  'proto.label': 'אב־טיפוס',
  'proto.landing':
    'זהו אב־טיפוס עובד עם משפחות בדיוניות. אימות הזהות <b>מדומה</b>, לא אמיתי, ושום מידע כאן לא עבר ביקורת אבטחה או בדיקה משפטית.',
  'proto.login':
    'אין כאן חשבונות אמיתיים. בחרו ב״כניסה כמשפחת כהן״ כדי להיכנס למשפחת ההדגמה, שכבר יש לה התאמות, בקשות ומפגש מאושר.',
  'proto.password':
    'בייצור, סיסמאות עוברות גיבוב בצד השרת עם Argon2id ונבדקות מול רשימת סיסמאות שדלפו. לאב־הטיפוס הזה אין שרת, ולכן הוא שומר ערך חלופי — לעולם לא סיסמה אמיתית.',
  'proto.codes':
    'אין באב־הטיפוס הזה ספק אימייל או SMS, ולכן הקודים מוצגים כאן. מערכת אמיתית שולחת אותם בערוץ נפרד ולעולם לא מחזירה אותם לדפדפן.',
  'proto.verifNoProvider':
    'אין ספק אימות מחובר. בחרו תוצאה כדי להמשיך בהדגמה. זוהי סימולציה, לא אימות.',
  'proto.verifPage':
    'אין ספק אימות זהות מחובר לגרסה הזו. כל מה שמסומן למטה כ<i>מדומה</i> הוא הדגמה של התהליך, לא בדיקת זהות אמיתית. תג ״מאומת״ שנוצר כאן לא אומר דבר על אף אדם אמיתי.',
  'proto.dashboard':
    'אתם מחוברים למשפחת הדגמה עם נתונים בדיוניים. אימות הזהות מדומה. שום דבר כאן אינו חשבון אמיתי או אדם אמיתי.',
  'proto.security':
    'הרשימה למעלה מתארת את התכנון לייצור. באב־טיפוס הזה, שרץ בדפדפן בלבד, ההפעלות נשמרות ב־localStorage ולא בעוגיות HttpOnly, ואין שרת שיגבב סיסמה. הפירוט המלא ב־docs/PROTOTYPE_DISCLOSURES.md.',
  'proto.admin':
    'בייצור זוהי אפליקציה נפרדת מאחורי הזדהות צוות נפרדת, עם הרשאות לפי תפקיד: נציג אימות רואה החלטות זהות ולעולם לא שיחות של משפחה. היא מוצגת כאן כדי להדגים את הרעיון, ועצם הפתיחה שלה מחשבון הורה נרשמת ביומן הביקורת.',
  'proto.safetyPage':
    'ההגנות המתוארות כאן ממומשות בקוד של אב־הטיפוס, אבל האב־טיפוס לא עבר בדיקות חדירה, ביקורת או סקירה משפטית, ואימות הזהות מדומה. התייחסו לדף הזה כתיאור של התכנון, לא כתעודה.',

  // -------------------------------------------------- domain: categories
  'cat.creative': 'יצירה',
  'cat.active': 'תנועה וספורט',
  'cat.games': 'משחקים',
  'cat.outdoors': 'בחוץ',
  'cat.learning': 'למידה וסקרנות',
  'cat.social': 'סגנון משחק',

  // --------------------------------------------------- domain: interests
  'interest.lego': 'לגו ובנייה',
  'interest.drawing': 'ציור וצביעה',
  'interest.crafts': 'אומנות ויצירה',
  'interest.music': 'מוזיקה ושירה',
  'interest.baking': 'אפייה ובישול',
  'interest.dressup': 'תחפושות ומשחקי דמיון',
  'interest.football': 'כדורגל',
  'interest.basketball': 'כדורסל',
  'interest.swimming': 'שחייה',
  'interest.cycling': 'אופניים וקורקינט',
  'interest.dance': 'ריקוד',
  'interest.gymnastics': 'התעמלות וטיפוס',
  'interest.martial_arts': 'אומנויות לחימה',
  'interest.board_games': 'משחקי קופסה',
  'interest.puzzles': 'פאזלים',
  'interest.card_games': 'משחקי קלפים',
  'interest.chess': 'שחמט',
  'interest.video_games': 'משחקי מחשב',
  'interest.playground': 'גני שעשועים',
  'interest.nature': 'טבע וטיולים',
  'interest.animals': 'חיות ובעלי חיים',
  'interest.gardening': 'גינון',
  'interest.water_play': 'משחקי מים',
  'interest.dinosaurs': 'דינוזאורים',
  'interest.space': 'חלל ואסטרונומיה',
  'interest.science': 'ניסויים מדעיים',
  'interest.reading': 'קריאה וסיפורים',
  'interest.coding': 'תכנות ורובוטיקה',
  'interest.trains': 'רכבות וכלי רכב',
  'interest.imaginative': 'משחקי דמיון',
  'interest.group_games': 'משחקי קבוצה',
  'interest.quiet_play': 'משחק שקט אחד על אחד',

  // -------------------------------------------------- domain: importance
  'importance.1': 'לא חשוב',
  'importance.2': 'העדפה קלה',
  'importance.3': 'חשוב',
  'importance.4': 'חשוב מאוד',
  'importance.5': 'קריטי',
  'enthusiasm.1': 'משתתפ/ת',
  'enthusiasm.2': 'די אוהב/ת',
  'enthusiasm.3': 'נהנה/ית מאוד',
  'enthusiasm.4': 'מת/ה על זה',
  'enthusiasm.5': 'הדבר האהוב ביותר',

  // --------------------------------------------------- domain: activities
  'activity.playground': 'גן שעשועים',
  'activity.park': 'מפגש בפארק',
  'activity.lego': 'לגו ובנייה',
  'activity.board_games': 'משחקי קופסה',
  'activity.swimming': 'שחייה',
  'activity.sports': 'ספורט ומשחקי כדור',
  'activity.crafts': 'אומנות ויצירה',
  'activity.baking': 'אפייה משותפת',
  'activity.museum': 'מוזיאון או תערוכה',
  'activity.other': 'משהו אחר',

  // -------------------------------------------------------- domain: days
  'day.sun': 'ראשון',
  'day.mon': 'שני',
  'day.tue': 'שלישי',
  'day.wed': 'רביעי',
  'day.thu': 'חמישי',
  'day.fri': 'שישי',
  'day.sat': 'שבת',
  'block.morning': 'בוקר',
  'block.afternoon': 'צהריים',
  'block.evening': 'ערב',
  'blockPlural.morning': 'בבקרים',
  'blockPlural.afternoon': 'אחר הצהריים',
  'blockPlural.evening': 'בערבים',
  'avail.weekend': 'בסופי שבוע, {blocks}',
  'avail.weekday': 'בימי חול, {blocks}',
  'avail.mostDays': 'ברוב הימים, {blocks}',
  'avail.none': 'לא הוגדרה זמינות',

  // ------------------------------------------------------ domain: styles
  'style.parents_stay': 'ההורים נשארים',
  'style.drop_off_ok': 'אפשר להשאיר',
  'style.public_places_only': 'מקומות ציבוריים',
  'style.home_visits_ok': 'ביקורי בית בסדר',
  'style.small_groups': 'קבוצות קטנות',
  'style.structured_activities': 'פעילות מתוכננת',
  'styleDesc.parents_stay': 'הורה נשאר לאורך כל המפגש.',
  'styleDesc.public_places_only': 'פארקים, גני שעשועים ומקומות ציבוריים אחרים.',
  'styleDesc.home_visits_ok': 'נשמח לביקורי בית אחרי שנכיר.',
  'styleDesc.drop_off_ok': 'פתוחים להשאיר את הילדים אצל משפחות שאנחנו מכירים.',
  'styleDesc.small_groups': 'ילד או שניים, לא המון.',
  'styleDesc.structured_activities': 'פעילות מתוכננת ולא משחק חופשי.',
  'stylePhrase.parents_stay': 'שההורים יישארו במפגש',
  'stylePhrase.drop_off_ok': 'מפגשים בלי הורים',
  'stylePhrase.public_places_only': 'מפגשים במקומות ציבוריים',
  'stylePhrase.home_visits_ok': 'ביקורי בית',
  'stylePhrase.small_groups': 'קבוצות קטנות',
  'stylePhrase.structured_activities': 'פעילות מתוכננת',

  // ------------------------------------------------ domain: verification
  'verif.verified.label': 'הורה מאומת',
  'verif.verified.desc': 'ההורה השלים אימות זהות.',
  'verif.pending.label': 'אימות בתהליך',
  'verif.pending.desc': 'אימות הזהות בתהליך. הגילוי ייפתח עם סיומו.',
  'verif.failed.label': 'האימות נכשל',
  'verif.failed.desc': 'אימות הזהות לא הושלם. אפשר לנסות שוב או לפנות לתמיכה.',
  'verif.required.label': 'נדרש אימות',
  'verif.required.desc': 'נדרש אימות זהות לפני שאפשר לעיין במשפחות או ליצור קשר.',
  'verif.unstarted.label': 'האימות לא התחיל',
  'verif.unstarted.desc': 'התחילו אימות כדי לפתוח את הגילוי.',
  'verif.expired.label': 'תוקף האימות פג',
  'verif.expired.desc': 'תוקף האימות שלכם פג ויש לחדש אותו.',

  // ------------------------------------------------ domain: trust signals
  'trust.email_verified': 'אימייל מאומת',
  'trust.phone_verified': 'טלפון מאומת',
  'trust.government_id_verified': 'תעודה מזהה מאומתת',
  'trust.two_factor_enabled': 'אימות דו־שלבי פעיל',
  'trust.secondary_parent_verified': 'הורה שני מאומת',
  'trust.profile_complete': 'פרופיל משפחה מלא',
  'trust.account_age': 'ותק בחשבון',
  'trust.completed_playdates': 'מפגשים שהתקיימו',
  'trust.community_standing': 'מעמד בקהילה',
  'trustDesc.email_verified': 'אישרו כתובת אימייל פעילה.',
  'trustDesc.phone_verified': 'אישרו מספר טלפון פעיל באמצעות קוד SMS.',
  'trustDesc.government_id_verified':
    'ספק אימות זהות חיצוני בדק תעודה מזהה ממשלתית מול תמונת סלפי. PlayDate לעולם לא שומר את המסמך.',
  'trustDesc.two_factor_enabled': 'החשבון שלהם דורש גורם אימות שני בכניסה.',
  'trustDesc.secondary_parent_verified': 'גם הורה שני במשפחה הזו השלים אימות.',
  'trustDesc.profile_complete': 'מילאו את פרופיל המשפחה, הילדים והזמינות.',
  'trustDesc.account_age': 'כמה זמן הם ב־PlayDate.',
  'trustDesc.completed_playdates': 'מפגשים שאושרו על ידי שתי המשפחות וסומנו כהתקיימו.',
  'trustDesc.community_standing': 'אין דיווחי בטיחות מבוססים נגד המשפחה הזו.',
  'trust.memberSince': 'חברים מאז {month}',
  'trust.idChecked': 'נבדק על ידי ספק אימות',
  'trust.idInProgress': 'הבדיקה בתהליך',
  'trust.noPlaydates': 'עדיין אין מפגשים',
  'trust.playdatesDone': '{n} מפגשים התקיימו',
  'trust.onePlaydateDone': 'מפגש אחד התקיים',
  'trust.noUpheldReports': 'אין דיווחים מבוססים',
  'trust.none': 'עדיין אין סימני אימות',

  // -------------------------------------------------- domain: match bands
  'band.strong': 'התאמה פוטנציאלית חזקה',
  'band.good': 'התאמה פוטנציאלית טובה',
  'band.possible': 'התאמה אפשרית',
  'band.weak': 'חפיפה מוגבלת',

  // ----------------------------------------------- domain: match reasons
  'reason.sameAge': 'הילדים באותו גיל',
  'reason.sameAgeDetail': 'שניהם בני {age}.',
  'reason.inAgeRange': 'הילדים בטווח הגילאים שהגדרתם',
  'reason.inAgeRangeDetail': 'ההתאמה הקרובה ביותר בהפרש של {gap} שנים, בתוך טווח של {tolerance} שנים.',
  'reason.inAgeRangeDetailOne':
    'ההתאמה הקרובה ביותר בהפרש של שנה, בתוך טווח של {tolerance} שנים.',
  'reason.oneSharedInterest': 'תחום עניין משותף אחד: {named}',
  'reason.sharedInterests': '{n} תחומי עניין משותפים',
  'reason.sharedInterestsDetail': 'כולל {named}.',
  'reason.mattersToBoth': '{interest} חשוב לשתי המשפחות',
  'reason.mattersToBothDetail': 'סימנתם את זה כחשוב מאוד, וגם הילד/ה שלהם מתלהב/ת מזה.',
  'reason.noOverlap': 'עדיין אין תחומי עניין חופפים',
  'reason.noOverlapDetail':
    'ילדים מוצאים שפה משותפת בפגישה — שווה לשקול, זה לא פוסל.',
  'reason.distance': 'המשפחות במרחק של כ־{band}',
  'reason.distanceDetail': 'בתוך {km} ק״מ שאתם מוכנים לנסוע.',
  'reason.availability': 'הזמינות חופפת ב{phrases}',
  'reason.availabilityDetail': 'סה״כ {n} משבצות זמן חופפות.',
  'reason.bothPrefer': 'שתי המשפחות מעדיפות {styles}',
  'reason.dropOffMismatch': 'הם פתוחים למפגשים בלי הורים; אתם מעדיפים להישאר',
  'reason.dropOffMismatchDetail': 'שווה לסכם על זה לפני המפגש הראשון.',
  'exclude.ageGap': 'הגילאים הקרובים ביותר בהפרש של {gap} שנים — מחוץ לטווח של {tolerance} שנים',
  'exclude.noChildren': 'אין ילדים להשוואה',
  'exclude.tooFar': 'כ־{band} משם — מעבר ל־{km} ק״מ שאחת המשפחות נוסעת',
  'exclude.noAvailability': 'אין זמינות חופפת',
  'exclude.blocked': 'חסום',
  'exclude.notDiscoverable': 'המשפחה הזו לא ניתנת לגילוי כרגע',
  'exclude.notAvailable': 'המשפחה הזו לא זמינה כרגע',
  'exclude.noChildrenOnProfile': 'אין ילדים בפרופיל המשפחה הזה',

  // ----------------------------------------------- domain: distance bands
  'dist.under1': 'פחות מק״מ',
  'dist.1to2': '1–2 ק״מ',
  'dist.2to4': '2–4 ק״מ',
  'dist.4to7': '4–7 ק״מ',
  'dist.7to12': '7–12 ק״מ',
  'dist.12to20': '12–20 ק״מ',
  'dist.over20': 'יותר מ־20 ק״מ',
  'dist.aboutAway': 'כ־{band} משם',

  // ------------------------------------------------- domain: safety tips
  'tip.public.title': 'הראשון — במקום ציבורי',
  'tip.public.body':
    'גני שעשועים, פארקים ומתנ״סים מאפשרים לילדים לשחק בחופשיות בזמן ששני ההורים נוכחים ורגועים.',
  'tip.stay.title': 'שני ההורים נשארים בפעם הראשונה',
  'tip.stay.body':
    'מפגש ראשון הוא לא פחות היכרות בין ההורים מאשר בין הילדים. להשאיר את הילדים אפשר בהמשך, אחרי שתכירו.',
  'tip.tell.title': 'ספרו למישהו על התוכנית',
  'tip.tell.body':
    'שתפו מבוגר נוסף שאתם סומכים עליו בזמן ובמקום. PlayDate יכול לרשום את זה עבורכם כשאתם מאשרים מפגש.',
  'tip.onPlatform.title': 'השאירו את השיחות ב־PlayDate',
  'tip.onPlatform.body':
    'אם שיחה עוברת לאפליקציה אחרת, הדיווח והחסימה כבר לא מגנים עליכם. אין שום מיהרות להחליף מספרים.',
  'tip.noExplanation.title': 'אתם לא חייבים הסבר לאף אחד',
  'tip.noExplanation.body':
    'אפשר לדחות, לצאת משיחה או לחסום בכל רגע. המשפחה השנייה לא מקבלת הסבר, ודחייה אף פעם לא נזקפת לחובתכם.',
  'tip.instinct.title': 'סמכו על התחושה, ואז ספרו לנו',
  'tip.instinct.body':
    'אם משהו מרגיש לא בסדר — לחץ, סודיות, התעניינות חריגה דווקא בילד שלכם — דווחו. הדיווחים נבדקים על ידי אנשים, לא בוטים.',

  // ---------------------------------------------- domain: report reasons
  'report.child_safety_urgent.label': 'חשש מיידי לשלום ילד',
  'report.child_safety_urgent.desc': 'משהו שדורש בדיקה דחופה. מקבל עדיפות על הכול.',
  'report.suspicious_behavior.label': 'התנהגות חשודה',
  'report.suspicious_behavior.desc':
    'לחץ, סודיות, התעניינות חריגה בילד, או ניסיונות לארגן מפגש ללא השגחה.',
  'report.fake_identity.label': 'זהות מזויפת או מטעה',
  'report.fake_identity.desc': 'אתם מאמינים שהאדם הזה אינו מי שהוא טוען שהוא.',
  'report.harassment.label': 'הטרדה',
  'report.harassment.desc': 'פנייה חוזרת ולא רצויה, עוינות או הפחדה.',
  'report.inappropriate_messages.label': 'הודעות לא הולמות',
  'report.inappropriate_messages.desc': 'תוכן מיני, אלים או לא הולם אחר בשיחה.',
  'report.misrepresentation.label': 'הצגה מטעה בפרופיל',
  'report.misrepresentation.desc':
    'פרופיל המשפחה שלהם לא משקף את המציאות — גילאים שגויים, ילדים מומצאים, פרטים מטעים.',
  'report.unwanted_contact.label': 'פנייה לא רצויה',
  'report.unwanted_contact.desc': 'הם ממשיכים לפנות אליכם אחרי שדחיתם או יצאתם מהשיחה.',
  'report.safety_concern.label': 'חשש בטיחותי אחר',
  'report.safety_concern.desc': 'משהו שהדאיג אתכם במהלך מפגש או אחריו.',
  'report.inappropriate_content.label': 'תוכן לא הולם',
  'report.inappropriate_content.desc':
    'תמונות, טקסט בפרופיל או תוכן אחר שלא אמור להיות ב־PlayDate.',

  // ------------------------------------------- domain: message scan flags
  'scan.phone':
    'זה נראה כמו מספר טלפון. שמירה על השיחה ב־PlayDate אומרת שדיווח וחסימה עדיין יעבדו אם משהו ישתבש.',
  'scan.email':
    'זה נראה כמו כתובת אימייל. אפשר לשתף פרטי קשר בהמשך — אין מה למהר לפני שנפגשתם.',
  'scan.offPlatform':
    'מעבר מוקדם לאפליקציה אחרת הוא דבר נפוץ, אבל אז PlayDate כבר לא יכול לעזור אם תהיה בעיה. שקלו להישאר כאן עד אחרי המפגש.',
  'scan.address':
    'זה נראה כמו כתובת רחוב. אנחנו ממליצים לא לשתף את כתובת הבית לפני מפגש ראשון במקום ציבורי.',
  'scan.unsupervised': 'למפגש ראשון אנחנו ממליצים ששני ההורים יישארו לאורך כל הביקור.',
  'scan.secrecy':
    'בקשות לסודיות הן סימן אזהרה מוכר. אם ההודעה הזו גרמה לכם לאי־נוחות, אפשר לדווח — הדיווחים נבדקים על ידי צוות הבטיחות שלנו.',
  'scan.childContact':
    'PlayDate לא תומך ביצירת קשר ישיר עם ילד של משפחה אחרת, ובקשה לפרטי קשר של ילד מנוגדת לכללי הבטיחות שלנו. אנא דווחו אם זה מדאיג אתכם.',
};
