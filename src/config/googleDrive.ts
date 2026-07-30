/**
 * To enable Google Drive sync, create your own OAuth Client ID:
 * 1. https://console.cloud.google.com/ - create a project.
 * 2. Enable the "Google Drive API" for it (APIs & Services -> Library).
 * 3. APIs & Services -> OAuth consent screen - set it up in "Testing" mode and add your
 *    Google account (and anyone else's you want to allow) under "Test users".
 * 4. APIs & Services -> Credentials -> Create Credentials -> OAuth client ID -> Web application.
 *    Add this site's origin(s) under "Authorized JavaScript origins", e.g.
 *    https://hcamalan.github.io and http://localhost:5173 for local dev.
 * 5. Paste the resulting Client ID below. It is not a secret and is safe to commit.
 *
 * To also enable "Open a shared file..." (joining a file a teammate shared with you), you need
 * a Google Picker API key too:
 * 6. Enable the "Google Picker API" for the same project (APIs & Services -> Library).
 * 7. APIs & Services -> Credentials -> Create Credentials -> API key.
 * 8. Restrict it: "API restrictions" -> only "Google Picker API"; "Application restrictions" ->
 *    HTTP referrers -> this site's origin(s), same as step 4 above.
 * 9. Paste the resulting API key below.
 */
export const GOOGLE_CLIENT_ID = '230209780222-6nl3cd98o6ari86a5ppok2skkag6e270.apps.googleusercontent.com'

export const GOOGLE_API_KEY = ''

/**
 * The Cloud project number, which is the numeric prefix of the OAuth client ID
 * (Google client IDs are always `PROJECTNUMBER-hash.apps.googleusercontent.com`). Passed to the
 * Picker so the app is granted drive.file access to files a teammate shared with the user.
 */
export const GOOGLE_APP_ID = GOOGLE_CLIENT_ID.split('-')[0]

export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export const isGoogleDriveConfigured = GOOGLE_CLIENT_ID.trim().length > 0

export const isGooglePickerConfigured = isGoogleDriveConfigured && GOOGLE_API_KEY.trim().length > 0
