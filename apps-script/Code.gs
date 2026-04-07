// ─────────────────────────────────────────────────────────────────────────────
// Frecka Fitness — Form Handler + Dashboard API
// Handles POST submissions from intake.freckafitness.com and
// checkin.freckafitness.com, and GET requests from dashboard.freckafitness.com.
// All data writes to one Google Sheet; dashboard reads via doGet.
//
// SETUP (one-time):
//   1. Create a new Google Sheet and copy its ID from the URL
//   2. Paste the Sheet ID into SHEET_ID below
//   3. In Apps Script: Deploy → New deployment → Web app
//      Execute as: Me  |  Who has access: Anyone
//   4. Copy the /exec URL into SCRIPT_URL in the intake, checkin, and dashboard files
//   5. Triggers:
//      - sendWeeklyCheckinDigest: Time-driven, every Monday at 7–8 AM
//
// SCHEMA UPDATE NOTE:
//   If a "Check-ins" tab already exists with the old 12-column schema, delete
//   that tab (or rename it) before deploying — the new schema has 15 columns.
//   The tab will be recreated automatically on the next form submission.
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID    = '1_O7dubG_feYKckAda3XD9LYbtMKFIDPODdaLR0E94Gw';
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
  'Missed Sessions', 'Best Lift', 'Progress Trend', 'Program Feedback',
  'Soreness', 'Soreness Notes',
  'Nutrition Adherence', 'Nutrition Notes',
  'For Ryan', 'Week Rating'
];

// Progress trend text → numeric (1–4)
const PROGRESS_MAP = {
  'Noticeably down':      1,
  'About the same':       2,
  'Slightly better':      3,
  'Significantly better': 4
};

// Soreness text → numeric (1–4)
const SORENESS_MAP = {
  'Nothing to Flag':                  1,
  'Minor Soreness':                   2,
  'Persistent Soreness or Tightness': 3,
  'Pain \u2014 Needs Attention':      4
};

// ── Entry point: form submissions ─────────────────────────────────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.openById(SHEET_ID);

    if (data.action === 'coachNote') {
      saveCoachNote(ss, data.rowIndex, data.note);
      return jsonResponse({ result: 'success' });
    }

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

// ── Entry point: dashboard data API ──────────────────────────────────────────
// Called by dashboard.freckafitness.com via GET request.
// Returns JSON: { clients: [ { email, firstName, lastName, checkins: [...] } ] }

function doGet(e) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('Check-ins');

    if (!sheet || sheet.getLastRow() < 2) {
      return jsonResponse({ clients: [] });
    }

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const rows    = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();

    // Map each row to a normalised check-in object, preserving the sheet row number
    const checkins = [];
    rows.forEach((r, i) => {
      if (!r[0]) return;
      const obj = {};
      headers.forEach((h, j) => { obj[h] = r[j]; });
      const ci = normalizeCheckin(obj);
      ci._row = i + 2; // 1-indexed sheet row (row 1 = headers)
      checkins.push(ci);
    });

    // Group by email (case-insensitive), preserving all history
    const clientMap = {};
    checkins.forEach(ci => {
      const key = (ci.email || (ci.firstName + ' ' + ci.lastName)).toLowerCase();
      if (!clientMap[key]) {
        clientMap[key] = {
          email:     ci.email,
          firstName: ci.firstName,
          lastName:  ci.lastName,
          checkins:  []
        };
      }
      clientMap[key].checkins.push(ci);
    });

    // Sort each client's history newest-first; sort roster oldest-last-checkin first
    const clients = Object.values(clientMap).map(c => {
      c.checkins.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      return c;
    });

    clients.sort((a, b) =>
      new Date(a.checkins[0]?.submittedAt || 0) - new Date(b.checkins[0]?.submittedAt || 0)
    );

    return jsonResponse({ clients });

  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Normalise a raw row object (keyed by header label) into a clean record
function normalizeCheckin(obj) {
  let progressTrend = obj['Progress Trend'];
  if (typeof progressTrend === 'string') {
    progressTrend = PROGRESS_MAP[progressTrend.trim()] || 0;
  }
  progressTrend = Number(progressTrend) || 0;

  let soreness = obj['Soreness'];
  if (typeof soreness === 'string') {
    soreness = SORENESS_MAP[soreness.trim()] || 0;
  }
  soreness = Number(soreness) || 0;

  // weekRating may be "3 – Average" (old form) or a plain number
  let weekRating = obj['Week Rating'];
  if (typeof weekRating === 'string') {
    weekRating = parseInt(weekRating, 10) || 0;
  }
  weekRating = Number(weekRating) || 0;

  return {
    submittedAt:        formatDate(obj['Submitted At']),
    weekEnding:         obj['Week Ending']            ? obj['Week Ending'].toString()   : '',
    firstName:          obj['First Name']             || '',
    lastName:           obj['Last Name']              || '',
    email:              obj['Email']                  || '',
    missedSessions:     obj['Missed Sessions']        || obj['Missed Reason']           || '',
    bestLift:           obj['Best Lift']              || '',
    progressTrend,
    programFeedback:    obj['Program Feedback']       || '',
    soreness,
    sorenessNotes:      obj['Soreness Notes']         || '',
    nutritionAdherence: Number(obj['Nutrition Adherence']) || 0,
    nutritionNotes:     obj['Nutrition Notes']        || '',
    forRyan:            obj['For Ryan']               || obj['Coach Question']          || '',
    weekRating,
    coachNotes:         obj['Coach Notes']            || '',
    coachNotesDate:     obj['Coach Notes Date']       || ''
  };
}

// ── Coach note writer ─────────────────────────────────────────────────────────

function saveCoachNote(ss, rowIndex, note) {
  const sheet = ss.getSheetByName('Check-ins');
  if (!sheet || !rowIndex) return;

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // Ensure "Coach Notes" column exists
  let noteCol = headers.indexOf('Coach Notes');
  if (noteCol === -1) {
    noteCol = lastCol;
    const h = sheet.getRange(1, noteCol + 1);
    h.setValue('Coach Notes');
    h.setFontWeight('bold').setBackground('#2B3C52').setFontColor('#ffffff');
  }

  // Ensure "Coach Notes Date" column exists (adjacent)
  let dateCol = headers.indexOf('Coach Notes Date');
  if (dateCol === -1) {
    dateCol = Math.max(lastCol, noteCol + 1);
    const h = sheet.getRange(1, dateCol + 1);
    h.setValue('Coach Notes Date');
    h.setFontWeight('bold').setBackground('#2B3C52').setFontColor('#ffffff');
  }

  const timestamp = new Date().toLocaleString('en-CA', { timeZone: 'America/Edmonton' });
  sheet.getRange(rowIndex, noteCol + 1).setValue(note || '');
  sheet.getRange(rowIndex, dateCol + 1).setValue(note ? timestamp : '');
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString();
  return val.toString();
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

  // Encode text enums to numbers for clean storage
  const progressTrend = typeof d.progressTrend === 'string'
    ? (PROGRESS_MAP[d.progressTrend.trim()] || d.progressTrend)
    : d.progressTrend;

  const soreness = typeof d.soreness === 'string'
    ? (SORENESS_MAP[d.soreness.trim()] || d.soreness)
    : d.soreness;

  // weekRating may arrive as "3 – Average" (old form) or plain number
  const weekRating = typeof d.weekRating === 'string'
    ? (parseInt(d.weekRating, 10) || d.weekRating)
    : d.weekRating;

  sheet.appendRow([
    d.submittedAt,
    d.firstName,
    d.lastName,
    d.email,
    d.weekEnding,
    d.missedReason    || '',
    d.bestLift        || '',
    progressTrend,
    d.programFeedback || '',
    soreness,
    d.sorenessNotes   || '',
    d.nutritionAdherence,
    d.nutritionNotes  || '',
    d.coachQuestion   || '',
    weekRating
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
// Apps Script: Triggers → Add trigger → sendWeeklyCheckinDigest
//   Event source: Time-driven | Type: Week timer | Day: Monday | Time: 7–8 AM

function sendWeeklyCheckinDigest() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Check-ins');

  if (!sheet || sheet.getLastRow() < 2) {
    MailApp.sendEmail(COACH_EMAIL, 'Weekly Check-In Digest — No submissions this week', 'No check-ins were submitted this week.');
    return;
  }

  const now    = new Date();
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const rows    = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
  const thisWeek = rows.filter(r => r[0] && new Date(r[0]) >= cutoff);

  if (thisWeek.length === 0) {
    MailApp.sendEmail(COACH_EMAIL, 'Weekly Check-In Digest — No submissions this week', 'No check-ins were submitted this week.');
    return;
  }

  const weekLabel =
    cutoff.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) +
    ' – ' +
    now.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

  const subject = `Weekly Check-In Digest — ${weekLabel} (${thisWeek.length} client${thisWeek.length > 1 ? 's' : ''})`;

  const col     = key => headers.indexOf(key);
  const PLABELS = { 1: 'Noticeably down', 2: 'About the same', 3: 'Slightly better', 4: 'Significantly better' };
  const SLABELS = { 1: 'Nothing to Flag', 2: 'Minor Soreness', 3: 'Persistent Soreness / Tightness', 4: 'Pain — Needs Attention' };

  const blocks = thisWeek.map((r, i) => {
    const fn    = r[col('First Name')]         || '';
    const ln    = r[col('Last Name')]          || '';
    const email = r[col('Email')]              || '';
    const we    = r[col('Week Ending')]        || '';
    const wr    = r[col('Week Rating')]        || '—';
    const prog  = r[col('Progress Trend')]     || 0;
    const sor   = r[col('Soreness')]           || 0;
    const sorN  = r[col('Soreness Notes')]     || '';
    const nutr  = r[col('Nutrition Adherence')] || '—';
    const nutrN = r[col('Nutrition Notes')]    || '';
    const miss  = r[col('Missed Sessions')]    || '';
    const lift  = r[col('Best Lift')]          || '';
    const progF = r[col('Program Feedback')]   || '';
    const ryan  = r[col('For Ryan')]           || '';

    return [
      `── ${i + 1}. ${fn} ${ln} ──────────────────────────`,
      `Week Ending:   ${we}`,
      `Week Rating:   ${wr}/10`,
      `Performance:   ${PLABELS[prog] || prog}`,
      '',
      `Soreness:      ${SLABELS[sor] || sor}${sorN ? ' — ' + sorN : ''}`,
      `Nutrition:     ${nutr}/10${nutrN ? ' — ' + nutrN : ''}`,
      `Missed:        ${miss || '—'}`,
      `Best Lift:     ${lift || '—'}`,
      `Program:       ${progF || '—'}`,
      `For Ryan:      ${ryan || '—'}`,
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
