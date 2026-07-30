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
 */
export const GOOGLE_CLIENT_ID = '230209780222-6nl3cd98o6ari86a5ppok2skkag6e270.apps.googleusercontent.com'

export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export const isGoogleDriveConfigured = GOOGLE_CLIENT_ID.trim().length > 0
