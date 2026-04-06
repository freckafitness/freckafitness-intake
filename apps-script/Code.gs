// ─────────────────────────────────────────────────────────────────────────────
// Frecka Fitness — Form Handler
// Handles POST submissions from both intake.freckafitness.com and
// checkin.freckafitness.com, routing each to its own tab in one Google Sheet.
//
// SETUP (one-time):
//   1. Create a new Google Sheet and copy its ID from the URL
//      (the long string between /d/ and /edit)
//   2. Paste the Sheet ID into SHEET_ID below
//   3. In Apps Script: Deploy → New deployment → Web app
//      Execute as: Me  |  Who has access: Anyone
//   4. Copy the /exec URL and paste it into SCRIPT_URL in both index.html files
//   5. Set up triggers (Triggers tab in Apps Script):
//      - sendIntakeAlert: runs on form submit (handled automatically via doPost)
//      - sendWeeklyCheckinDigest: time-driven, every Monday at 7–8 AM
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID  = '1_O7dubG_feYKckAda3XD9LYbtMKFIDPODdaLR0E94Gw';
const COACH_EMAIL = 'freckafitness@gmail.com';

// ── Column headers ────────────────────────────────────────────────────────────

const INTAKE_HEADERS = [
  'Submitted At', 'First Name', 'Last Name', 'Email', 'Phone', 'Location',
  'Primary Goal', 'Goal Detail', 'Timeline',
  'Sleep Quality', 'Stress Level', 'Occupation',
  'Nutrition', 'Injuries', 'Medical Notes',
  'Feedback Pref', 'Referral Source', 'Anything Else'
];

const CHECKIN_HEADERS = [
  'Submitted At', 'First Name', 'Last Name', 'Email', 'Week Ending',
  'Week Rating', 'Program Feedback',
  'Soreness', 'Soreness Notes',
  'Nutrition Adherence', 'Nutrition Notes',
  'Coach Question'
];

// ── Entry point ───────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SHEET_ID);

    // Route: check-ins have a weekEnding field; intake forms have primaryGoal
    if (data.weekEnding !== undefined) {
      appendCheckin(ss, data);
    } else {
      appendIntake(ss, data);
      sendIntakeAlert(data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Writers ───────────────────────────────────────────────────────────────────

function appendIntake(ss, d) {
  const sheet = getOrCreateSheet(ss, 'Intake', INTAKE_HEADERS);
  sheet.appendRow([
    d.submittedAt,     d.firstName,    d.lastName,     d.email,
    d.phone,           d.location,
    d.primaryGoal,     d.goalDetail,   d.timeline,
    d.sleepQuality,    d.stressLevel,  d.occupation,
    d.nutrition,       d.injuries,     d.medicalNotes,
    d.feedbackPref,    d.referralSource, d.anythingElse
  ]);
}

function appendCheckin(ss, d) {
  const sheet = getOrCreateSheet(ss, 'Check-ins', CHECKIN_HEADERS);
  sheet.appendRow([
    d.submittedAt,          d.firstName,      d.lastName,     d.email,
    d.weekEnding,           d.weekRating,
    d.programFeedback,      d.soreness,       d.sorenessNotes,
    d.nutritionAdherence,   d.nutritionNotes,
    d.coachQuestion
  ]);
}

// ── Intake alert — fires immediately on new submission ────────────────────────

function sendIntakeAlert(d) {
  const subject = `New Intake: ${d.firstName} ${d.lastName} — ${d.primaryGoal}`;
  const body = [
    `New client intake submitted at ${d.submittedAt}`,
    '',
    `Name:       ${d.firstName} ${d.lastName}`,
    `Email:      ${d.email}`,
    `Phone:      ${d.phone}`,
    `Location:   ${d.location}`,
    '',
    `Goal:       ${d.primaryGoal}`,
    `Detail:     ${d.goalDetail}`,
    `Timeline:   ${d.timeline}`,
    '',
    `Sleep:      ${d.sleepQuality}/10`,
    `Stress:     ${d.stressLevel}/10`,
    `Nutrition:  ${d.nutrition}`,
    `Injuries:   ${d.injuries}`,
    `Medical:    ${d.medicalNotes}`,
    '',
    `Feedback:   ${d.feedbackPref}`,
    `Referral:   ${d.referralSource}`,
    `Notes:      ${d.anythingElse}`,
  ].join('\n');

  MailApp.sendEmail(COACH_EMAIL, subject, body);
}

// ── Weekly check-in digest — runs every Monday morning ───────────────────────
// Set up in Apps Script: Triggers → Add trigger → sendWeeklyCheckinDigest
//   Event source: Time-driven | Type: Week timer | Day: Monday | Time: 7–8 AM

function sendWeeklyCheckinDigest() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Check-ins');

  if (!sheet || sheet.getLastRow() < 2) {
    MailApp.sendEmail(COACH_EMAIL, 'Weekly Check-In Digest — No submissions this week', 'No check-ins were submitted this week.');
    return;
  }

  // Collect submissions from the past 7 days (Mon–Sun)
  const now      = new Date();
  const cutoff   = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rows     = sheet.getRange(2, 1, sheet.getLastRow() - 1, CHECKIN_HEADERS.length).getValues();
  const thisWeek = rows.filter(r => r[0] && new Date(r[0]) >= cutoff);

  if (thisWeek.length === 0) {
    MailApp.sendEmail(COACH_EMAIL, 'Weekly Check-In Digest — No submissions this week', 'No check-ins were submitted this week.');
    return;
  }

  // Build email — one block per client
  const weekLabel = cutoff.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) +
                    ' – ' +
                    now.toLocaleDateString('en-CA',    { month: 'short', day: 'numeric', year: 'numeric' });

  const subject = `Weekly Check-In Digest — ${weekLabel} (${thisWeek.length} client${thisWeek.length > 1 ? 's' : ''})`;

  const blocks = thisWeek.map((r, i) => {
    const [submittedAt, firstName, lastName, email, weekEnding, weekRating,
           programFeedback, soreness, sorenessNotes,
           nutritionAdherence, nutritionNotes, coachQuestion] = r;
    return [
      `── ${i + 1}. ${firstName} ${lastName} ──────────────────────────`,
      `Submitted:     ${submittedAt}`,
      `Week Ending:   ${weekEnding}`,
      `Week Rating:   ${weekRating}`,
      '',
      `Program:       ${programFeedback || '—'}`,
      `Soreness:      ${soreness}${sorenessNotes ? ' — ' + sorenessNotes : ''}`,
      `Nutrition:     ${nutritionAdherence}/10${nutritionNotes ? ' — ' + nutritionNotes : ''}`,
      `Question:      ${coachQuestion || '—'}`,
      `Email:         ${email}`,
    ].join('\n');
  });

  const body = [
    `Check-In Digest for ${weekLabel}`,
    `${thisWeek.length} submission${thisWeek.length > 1 ? 's' : ''} received`,
    '',
    ...blocks
  ].join('\n\n');

  MailApp.sendEmail(COACH_EMAIL, subject, body);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#2B3C52');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
