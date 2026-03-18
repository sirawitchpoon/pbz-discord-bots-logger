/**
 * Discord Bots Logger – Sync logs to Google Sheet (one sheet per bot + category).
 * All labels and messages in English.
 * Use "Create all sheets (first time)" to pre-create tabs for every feature before any logs arrive.
 *
 * Setup:
 * 1. Create a new Google Sheet
 * 2. Extensions → Apps Script → paste this code
 * 3. Set LOGGER_API_URL and LOGGER_API_KEY below (or use Script Properties)
 * 4. Run "Create all sheets (first time)" once to create all log tabs
 * 5. Run "Sync logs" manually, or set a Time-driven trigger so it runs automatically:
 *    In Apps Script: Triggers (clock icon) → Add Trigger → syncLogs, Time-driven, Minutes timer, Every 10 or 15 minutes.
 *
 * API must be reachable from the internet (open port 3002 on VPS or use tunnel).
 */

// จาก VPS ใช้พอร์ต 3020 (Docker map 3020:3002). ตั้งใน Script Properties: LOGGER_API_URL, LOGGER_API_KEY
const LOGGER_API_URL = 'http://YOUR_VPS_IP:3020';
const LOGGER_API_KEY = 'your-api-key';

// Display names for sheet tabs (botId → "Sheet Name", category → "Category Name")
const BOT_DISPLAY_NAMES = {
  'honorbot-pbz': 'Honorbot',
  'phantom-melody': 'Phantom Melody',
  'pbz-bounty': 'PBZ Bounty',
  'discord-log-bot': 'Discord Log Bot',
  'bingo-bot': 'Bingo Bot',
  'invite-tracker': 'Invite Tracker'
};
const CATEGORY_DISPLAY_NAMES = {
  'daily': 'Daily Checkin',
  'daily_checkin': 'Daily Checkin',
  'button': 'Button',
  'gamble': 'Gamble',
  'coin_flip': 'Coin Flip',
  'music': 'Music',
  'bounty': 'Bounty',
  'leaderboard': 'Leaderboard',
  'manual': 'Manual',
  'tasks': 'Tasks',
  'hall': 'Hall',
  'status': 'Status',
  'queue': 'Queue',
  'song_selection': 'Song Selection',
  'playback': 'Playback',
  'pin': 'Pin',
  'upvote': 'Upvote',
  'unlock': 'Unlock',
  'listening_reward': 'Listening Reward',
  'invite': 'Invite',
  'bingo': 'Bingo',
  'log': 'Log',
  'admin': 'Admin',
  'command': 'Command'
};

/**
 * All (botId, category) pairs to pre-create sheets for reporting and analysis.
 * Add new entries here when you add new log categories in bots.
 */
const ALL_LOG_SHEETS = [
  // Honorbot
  { botId: 'honorbot-pbz', category: 'daily' },
  { botId: 'honorbot-pbz', category: 'tasks' },
  { botId: 'honorbot-pbz', category: 'button' },
  { botId: 'honorbot-pbz', category: 'gamble' },
  { botId: 'honorbot-pbz', category: 'coin_flip' },
  { botId: 'honorbot-pbz', category: 'leaderboard' },
  { botId: 'honorbot-pbz', category: 'manual' },
  { botId: 'honorbot-pbz', category: 'hall' },
  { botId: 'honorbot-pbz', category: 'status' },
  { botId: 'honorbot-pbz', category: 'command' },
  // Phantom Melody
  { botId: 'phantom-melody', category: 'music' },
  { botId: 'phantom-melody', category: 'queue' },
  { botId: 'phantom-melody', category: 'song_selection' },
  { botId: 'phantom-melody', category: 'playback' },
  { botId: 'phantom-melody', category: 'pin' },
  { botId: 'phantom-melody', category: 'upvote' },
  { botId: 'phantom-melody', category: 'unlock' },
  { botId: 'phantom-melody', category: 'listening_reward' },
  { botId: 'phantom-melody', category: 'command' },
  { botId: 'phantom-melody', category: 'admin' },
  // PBZ Bounty
  { botId: 'pbz-bounty', category: 'bounty' },
  { botId: 'pbz-bounty', category: 'button' },
  { botId: 'pbz-bounty', category: 'command' },
  // Invite Tracker
  { botId: 'invite-tracker', category: 'invite' },
  // Bingo Bot
  { botId: 'bingo-bot', category: 'bingo' },
  { botId: 'bingo-bot', category: 'button' },
  // Discord Log Bot (if it sends logs)
  { botId: 'discord-log-bot', category: 'log' }
];

var HEADER_ROW = ['Timestamp (UTC+8)', 'Discord User ID', 'Discord Username', 'Action', 'Details'];

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    url: (props.getProperty('LOGGER_API_URL') || LOGGER_API_URL).replace(/\/$/, ''),
    apiKey: props.getProperty('LOGGER_API_KEY') || LOGGER_API_KEY
  };
}

function getBotSheetName(botId) {
  if (!botId) return 'Unknown';
  var key = String(botId).toLowerCase().replace(/\s/g, '-');
  return BOT_DISPLAY_NAMES[key] || (key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' '));
}

function getCategorySheetName(category) {
  if (!category) return 'General';
  var key = String(category).toLowerCase().replace(/\s/g, '_');
  return CATEGORY_DISPLAY_NAMES[key] || (category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' '));
}

/** Sheet tab name: e.g. "Honorbot - Daily Checkin" */
function getSheetTabName(botId, category) {
  return getBotSheetName(botId) + ' - ' + getCategorySheetName(category);
}

/** Format timestamp for UTC+8 display */
function formatTimestampUtc8(isoString) {
  if (!isoString) return '';
  var d = new Date(isoString);
  return Utilities.formatDate(d, 'GMT+8', 'yyyy-MM-dd HH:mm:ss');
}

function fetchLogs(options) {
  var config = getConfig();
  if (!config.url || config.url.indexOf('YOUR_VPS') !== -1) {
    throw new Error('Set LOGGER_API_URL in Script Properties (Extensions → Apps Script → Project Settings → Script Properties). Example: http://143.14.200.26:3020');
  }
  if (!config.apiKey || config.apiKey === 'your-api-key') {
    throw new Error('Set LOGGER_API_KEY in Script Properties to match the logger API_KEY.');
  }
  var params = [];
  if (options && options.botId) params.push('botId=' + encodeURIComponent(options.botId));
  if (options && options.category) params.push('category=' + encodeURIComponent(options.category));
  if (options && options.limit) params.push('limit=' + Number(options.limit));
  if (options && options.since) params.push('since=' + encodeURIComponent(options.since));
  var qs = params.length ? '?' + params.join('&') : '?limit=5000';
  var url = config.url + '/api/logs' + qs;
  var response;
  try {
    response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'X-API-Key': config.apiKey },
      muteHttpExceptions: true,
      timeout: 60
    });
  } catch (e) {
    throw new Error('Cannot reach ' + config.url + ' — ' + e.message + '. Check URL and that the VPS allows port 3020 from the internet.');
  }
  var code = response.getResponseCode();
  var body = response.getContentText();
  if (code !== 200) {
    var msg = body;
    try {
      var json = JSON.parse(body);
      if (json && json.error) msg = json.error;
    } catch (err) {}
    throw new Error('API ' + code + ': ' + msg + ' (URL: ' + config.url + ')');
  }
  return JSON.parse(body);
}

function ensureSheet(spreadsheet, tabName) {
  var sheet = spreadsheet.getSheetByName(tabName);
  if (sheet) return sheet;
  return spreadsheet.insertSheet(tabName);
}

/**
 * Create all log sheets in advance (for monthly reports and analysis).
 * Run this once so every bot+category has a tab with headers before any logs arrive.
 */
function createAllLogSheets() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var indexSheet = ensureSheet(spreadsheet, 'Index');
  indexSheet.clear();
  indexSheet.getRange('A1').setValue('Log sheets (pre-created). Use Logger → Sync logs to pull data.');
  indexSheet.getRange('A2').setValue('Last sheets created: ' + formatTimestampUtc8(new Date().toISOString()));

  var created = [];
  for (var i = 0; i < ALL_LOG_SHEETS.length; i++) {
    var pair = ALL_LOG_SHEETS[i];
    var tabName = getSheetTabName(pair.botId, pair.category);
    var sheet = ensureSheet(spreadsheet, tabName);
    sheet.clear();
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]).setFontWeight('bold');
    sheet.getRange('A2').setValue('No data yet. Data will appear here after bots send logs and you run Sync logs.');
    created.push(tabName);
  }

  indexSheet.getRange('A4').setValue('Sheets: ' + created.join(', '));
  SpreadsheetApp.getUi().alert('Created ' + created.length + ' log sheets. You can now run "Sync logs" to fill them when bots send data.');
}

/**
 * Ensure all predefined sheets exist (with headers). Called by syncLogs so new categories get a sheet.
 */
function ensureAllLogSheetsExist(spreadsheet) {
  for (var i = 0; i < ALL_LOG_SHEETS.length; i++) {
    var pair = ALL_LOG_SHEETS[i];
    var tabName = getSheetTabName(pair.botId, pair.category);
    var sheet = ensureSheet(spreadsheet, tabName);
    var firstCell = sheet.getRange('A1').getValue();
    var firstCellStr = firstCell != null ? String(firstCell) : '';
    if (!firstCellStr || firstCellStr.indexOf('Timestamp') === -1) {
      sheet.clear();
      sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]).setFontWeight('bold');
    }
  }
}

/**
 * Sync logs into separate sheets by bot + category.
 * Columns: Timestamp (UTC+8), Discord User ID, Discord Username, Action, Details
 */
function syncLogs() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(spreadsheet, 'Index');
  ensureAllLogSheetsExist(spreadsheet);

  var data;
  try {
    data = fetchLogs({ limit: 5000 });
  } catch (e) {
    var indexSheet = ensureSheet(spreadsheet, 'Index');
    indexSheet.clear();
    indexSheet.getRange('A1').setValue('Sync failed');
    indexSheet.getRange('A2').setValue(e.message);
    indexSheet.getRange('A3').setValue('Last attempt: ' + formatTimestampUtc8(new Date().toISOString()));
    SpreadsheetApp.getUi().alert('Sync failed: ' + e.message);
    return;
  }

  if (!data.success || !data.logs || data.logs.length === 0) {
    var indexSheet = ensureSheet(spreadsheet, 'Index');
    indexSheet.clear();
    indexSheet.getRange('A1').setValue('No logs yet. Run again after bots send logs.');
    indexSheet.getRange('A2').setValue('Last sync: ' + formatTimestampUtc8(new Date().toISOString()));
    indexSheet.getRange('A3').setValue('If bots are active, check: Logger API reachable? API_KEY matches?');
    return;
  }

  var grouped = {};
  data.logs.forEach(function (log) {
    var key = (log.botId || 'unknown') + '\t' + (log.category || 'general');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(log);
  });

  var sheetNamesUpdated = [];

  for (var key in grouped) {
    var parts = key.split('\t');
    var botId = parts[0];
    var category = parts[1];
    var tabName = getSheetTabName(botId, category);
    var sheet = ensureSheet(spreadsheet, tabName);
    sheet.clear();
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]).setFontWeight('bold');
    var rows = grouped[key].map(function (log) {
      return [
        formatTimestampUtc8(log.createdAt),
        log.userId || '',
        log.username || '',
        log.action || '',
        log.details && typeof log.details === 'object' ? JSON.stringify(log.details) : (log.details || '')
      ];
    });
    if (rows.length > 0) {
      // getRange(row, col, numRows, numCols) — ใช้ numRows ไม่ใช่ endRow
      sheet.getRange(2, 1, rows.length, HEADER_ROW.length).setValues(rows);
    }
    sheetNamesUpdated.push(tabName);
  }

  // Clear "No data yet" from any pre-created sheet that still has no API data (leave headers)
  for (var i = 0; i < ALL_LOG_SHEETS.length; i++) {
    var pair = ALL_LOG_SHEETS[i];
    var tabName = getSheetTabName(pair.botId, pair.category);
    var sheet = spreadsheet.getSheetByName(tabName);
    if (sheet) {
      var a2 = sheet.getRange('A2').getValue();
      var a2Str = a2 != null ? String(a2) : '';
      if (a2Str && a2Str.indexOf('No data yet') !== -1 && grouped[(pair.botId + '\t' + pair.category)] === undefined) {
        sheet.getRange('A2').clearContent();
      }
    }
  }

  // Newest log is first (API returns createdAt desc)
  var newestLog = data.logs[0];
  var newestTime = newestLog && newestLog.createdAt ? formatTimestampUtc8(newestLog.createdAt) : '—';

  var indexSheet = ensureSheet(spreadsheet, 'Index');
  indexSheet.clear();
  indexSheet.getRange('A1').setValue('Sheets updated: ' + sheetNamesUpdated.join(', '));
  indexSheet.getRange('A2').setValue('Last sync: ' + formatTimestampUtc8(new Date().toISOString()));
  indexSheet.getRange('A3').setValue('Fetched ' + data.logs.length + ' logs; newest in API: ' + newestTime);
}

/** List bots and categories (for reference) */
function listBots() {
  var config = getConfig();
  var response = UrlFetchApp.fetch(config.url + '/api/bots', {
    method: 'get',
    headers: { 'X-API-Key': config.apiKey },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    Logger.log('Error: ' + response.getContentText());
    return;
  }
  var data = JSON.parse(response.getContentText());
  Logger.log('Bots: ' + (data.bots && data.bots.join(', ')));
  Logger.log('Categories: ' + (data.categories && data.categories.join(', ')));
}

/** Test API connection and show newest log time (for debugging). */
function testConnection() {
  var config = getConfig();
  if (!config.url || config.url.indexOf('YOUR_VPS') !== -1) {
    SpreadsheetApp.getUi().alert('Set LOGGER_API_URL in Script Properties first (e.g. http://YOUR_VPS_IP:3020).');
    return;
  }
  try {
    var data = fetchLogs({ limit: 1 });
    var msg = 'Connected. ';
    if (data.logs && data.logs.length > 0) {
      msg += 'Newest log: ' + formatTimestampUtc8(data.logs[0].createdAt) + ' (' + (data.logs[0].botId || '') + ' / ' + (data.logs[0].category || '') + ').';
    } else {
      msg += 'No logs in API yet.';
    }
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Connection failed: ' + e.message);
  }
}

/** Add custom menu when spreadsheet opens */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Logger')
    .addItem('Create all sheets (first time)', 'createAllLogSheets')
    .addItem('Sync logs', 'syncLogs')
    .addItem('Test connection (newest log)', 'testConnection')
    .addItem('List bots/categories (log)', 'listBots')
    .addSeparator()
    .addItem('Set auto sync (every 15 min)', 'setTriggerSync15Min')
    .addToUi();
}

/**
 * Create a Time-driven trigger to run syncLogs every 15 minutes.
 * Run once from the menu; you can edit/delete triggers in Apps Script → Triggers (clock icon).
 */
function setTriggerSync15Min() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncLogs') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('syncLogs')
    .timeBased()
    .everyMinutes(15)
    .create();
  SpreadsheetApp.getUi().alert('Sync logs will run automatically every 15 minutes. To change or remove: Extensions → Apps Script → Triggers (clock icon).');
}
