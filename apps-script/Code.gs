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
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID = '1_O7dubG_feYKckAda3XD9LYbtMKFIDPODdaLR0E94Gw';

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
