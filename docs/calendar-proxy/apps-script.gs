/**
 * Google Apps Script web app proxy for fetching Google Calendar iCal (.ics) feeds.
 * Deploy as Web App: Execute as "Me", Who has access "Anyone".
 */
function doGet(e) {
  try {
    var targetUrl = e && e.parameter ? e.parameter.url : "";
    if (!targetUrl || targetUrl.indexOf("https://calendar.google.com/calendar/ical/") !== 0) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: "Allowed only for https://calendar.google.com/calendar/ical/ URLs" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var response = UrlFetchApp.fetch(targetUrl, {
      method: "get",
      muteHttpExceptions: true,
      followRedirects: true,
    });
    var code = response.getResponseCode();
    var body = response.getContentText();
    if (code !== 200) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: "Upstream status " + code })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
