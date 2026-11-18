# DerickStay — deployment guide (Android + GitHub)

This is a real Supabase-backed starter application. It includes email/password registration, email confirmation, login, owner profiles, bios limited to 177 words, up to seven property photos, listing editing, public browsing, and profile/listing-view notifications stored in the database.

## Important limitation about AI photo checks
The frontend calls a Supabase Edge Function named `screen-image` before accepting profile or property photos. The function is deliberately not included as a fake detector. You must connect a genuine image-analysis provider and deploy that function before photo uploads will work. AI detectors can produce false positives and cannot prove a photograph is genuine. Do not use this as identity verification or as the sole basis for accusing a user of fraud.

## 1. Create the Supabase backend
1. Open https://supabase.com in Chrome on Android and create a free project.
2. In the project, open **SQL Editor → New query**.
3. Open `supabase/schema.sql` in this repository, copy all its contents, paste into SQL Editor, and press **Run**.
4. Open **Project Settings → API**. Copy the Project URL and the anon/public key. Never use the `service_role` key in browser code.
5. In the repository, copy `config.js.example` to a new file named `config.js`; replace the two placeholder values. Commit the file only if the repository is private. The anon key is designed for browser use, but your RLS policies must remain enabled. For a public repo, use GitHub Actions secrets or keep the config out of version control and configure deployment another way.

## 2. Enable email confirmation
1. Supabase Dashboard → Authentication → Providers → Email.
2. Enable Email provider and turn on **Confirm email**.
3. Authentication → URL Configuration: set Site URL to your deployed website URL.
4. Add your GitHub Pages URL to Redirect URLs, e.g. `https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY/`.
5. Configure SMTP for reliable production delivery. Supabase's built-in email service has sending limits and is intended for testing.

## 3. Add AI image screening
1. Choose an image-analysis API/provider and read its current terms, privacy rules and pricing.
2. Create a Supabase Edge Function named `screen-image`.
3. Implement the function to accept `{filename,mime_type,image_base64}`, analyze the image server-side, and return exactly `{decision:"approve"}` or `{decision:"reject",reason:"..."}`. Return a non-approve response if uncertain. Do not put provider API keys in `app.js` or `config.js`; store them as Edge Function secrets.
4. Deploy the function and test with known real and AI-generated sample images. Keep a manual review/appeal process because AI classification is not definitive.
5. Until this is configured, image uploads intentionally fail closed.

## 4. Deploy with GitHub Pages
1. Upload all project files to the root of your GitHub repository. Make sure `index.html`, `app.js`, `styles.css`, and `config.js` are in the root.
2. Open repository **Settings → Pages**.
3. Under Build and deployment choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
4. Wait for GitHub Pages to publish. Open the Pages URL on your Android phone.
5. Add that exact URL to Supabase Authentication URL Configuration.

## 5. Test the core workflow
- Register with an email you can access.
- Click the confirmation email, then sign in.
- Complete profile and bio.
- Add a property with up to seven photos after AI screening is deployed.
- Sign in with a second test account and open the first user's profile or property.
- Sign back in as the first user and open **My account** to see notifications and manage listings.

## Current implementation notes
- Profile-view notifications are created when an authenticated user opens another member's profile.
- Listing-view notifications are created when an authenticated user opens a property detail.
- These are in-app notifications shown in the account dashboard, not SMS or push notifications.
- Public listings and profile photos are publicly viewable. Do not upload sensitive documents or private images.
- Before launch, add privacy policy, terms, reporting/blocking, moderation, rate limits, spam protection, and an appropriate contact process.
- GitHub Pages hosts static frontend files only; Supabase provides the backend database, authentication and storage.
