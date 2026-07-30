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

/*
 * Both GOOGLE_CLIENT_ID and GOOGLE_API_KEY below are INTENTIONALLY PUBLIC and safe to commit.
 *
 * Why they have to be public: this is a client-only app with no backend, so anything it uses at
 * runtime ships in the JavaScript bundle that every visitor downloads — there is nowhere to hide
 * them. Google designs both of these as public *identifiers*, not secrets (unlike an OAuth client
 * *secret*, which we never use and which the client-side token flow doesn't require).
 *
 * Why that's safe: neither value grants access to anyone's data.
 *  - The API key is used ONLY to initialize the Google Picker widget (see googleDriveApi/Picker) and
 *    is restricted in the Cloud Console to the Picker API and to this site's referrer origin(s).
 *    Every actual Drive data request (see googleDriveApi.ts) is authorized by a per-user OAuth
 *    access token via `Authorization: Bearer`, never by this key — the token is kept only in memory
 *    for the session and is never persisted. So a copied key cannot read anyone's Drive data; the
 *    worst it could do is consume this project's Picker/Drive API quota, and the referrer
 *    restriction limits even that.
 *  - The OAuth client ID likewise only identifies the app; access is still gated by each user
 *    explicitly consenting in Google's own sign-in popup, scoped to their own files (drive.file).
 */
export const GOOGLE_CLIENT_ID = '230209780222-6nl3cd98o6ari86a5ppok2skkag6e270.apps.googleusercontent.com'

export const GOOGLE_API_KEY = 'AIzaSyArRxYtDlmakKHPZD_akIVNzblwnZFccfs'

/**
 * The Cloud project number, which is the numeric prefix of the OAuth client ID
 * (Google client IDs are always `PROJECTNUMBER-hash.apps.googleusercontent.com`). Passed to the
 * Picker so the app is granted drive.file access to files a teammate shared with the user.
 */
export const GOOGLE_APP_ID = GOOGLE_CLIENT_ID.split('-')[0]

export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export const isGoogleDriveConfigured = GOOGLE_CLIENT_ID.trim().length > 0

export const isGooglePickerConfigured = isGoogleDriveConfigured && GOOGLE_API_KEY.trim().length > 0
