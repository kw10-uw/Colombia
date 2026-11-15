# Connect the crew with Supabase

GitHub Pages hosts the app. Supabase stores shared records and private files. You can use the app on one phone, offline, before setting this up.

## 1. Create a project

Open [the Supabase dashboard](https://supabase.com/dashboard), create a project, and save its database password somewhere private. You do not enter that password in TurboColombia.

In the project’s SQL Editor, run the complete contents of [`supabase/schema.sql`](../supabase/schema.sql) once. It creates trip/member/record tables, membership functions, revision-checked save functions, and a private `trip-documents` bucket with row-level security. The script is for a new project; running it twice will report existing objects.

If you already ran the first version before the chapter/travel update, run only [`supabase/migrations/002_travel.sql`](../supabase/migrations/002_travel.sql) to allow travel-leg records. It preserves existing trip data.

Enable **Anonymous Sign-Ins** in Authentication → Sign In / Providers (dashboard labels may vary). Each browser receives an anonymous account and retains its session locally, so you do not need a login page. If anonymous sign-in abuse protection requires CAPTCHA on your chosen project configuration, that flow needs additional configuration; this version does not include a CAPTCHA widget.

Copy the project URL and its **publishable key** (or legacy `anon` key) from project settings. Never copy the `service_role`, `sb_secret_…`, database password, or management API token into the app. The UI rejects secret/service-role keys.

References: [anonymous sign-in](https://supabase.com/docs/guides/auth/auth-anonymous), [storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## 2. Connect the first phone

1. Open TurboColombia and pick your avatar.
2. If you already have plans, export a backup in **More → Trip settings → Pack a backup**.
3. In **Keep the crew connected**, choose **Create shared trip**.
4. Enter the project URL and publishable key, then connect.
5. Wait until sync says **All caught up**. Local plans, expenses, and document files upload to the connected trip.
6. Choose **Copy crew invite** and send the link privately to the other travelers.

The invite carries the project URL, public key, and a random 256-bit trip-access code in the URL fragment. The app removes the fragment from browser history after reading it. The server stores a SHA-256 hash of the code. Treat the invite like a key to the trip: everyone possessing it can join, read files, and edit records.

## 3. Join the other phones

Open the invite, choose the correct avatar, back up any existing local trip, acknowledge replacement, then join. The app downloads shared records. Document files download on demand; use **Documents → Keep all offline** before leaving reliable internet.

An anonymous account identifies a browser session, while the chosen avatar attributes edits within your group. Multiple phones can choose the same traveler, and anyone with the invite can choose any avatar. This is appropriate for your trusted group; it is not a verified identity system.

## 4. Test together before the trip

- Add an activity on one phone and sync; verify another phone sees it.
- Add a stay and have all four people vote from their own devices.
- Upload a non-sensitive test PDF; download it on a second phone and then open it offline.
- Put one phone offline, edit an activity, change the same activity on another phone, then reconnect. Settings should show both versions for review.
- Add an expense, check payer and split, record a repayment, and verify all phones agree.
- Export a complete backup after all documents are downloaded; keep it outside browser storage.

## Access and data lifecycle

Tables and file policies restrict access to trip members. All shared members have equal editing rights. The public key by itself is insufficient to read trip data. The frontend is never an authorization boundary; all checks are in the supplied SQL and storage policies.

Deleting a trip item creates a tombstone so an offline phone cannot resurrect it silently. Document removal also attempts to remove the remote storage object. If storage removal fails after the tombstone is saved, an orphaned object can remain in the private bucket; the project owner can clean it up from the Supabase dashboard. The app never publishes documents into the Git repository or a public bucket.

This first version has no invite rotation, member revocation, owner handoff, or in-app cloud trip deletion. If an invite escapes the crew, use the Supabase dashboard to remove memberships and replace the trip, or rotate the invite hash with an administrator operation. Simply disconnecting a phone does not revoke its anonymous user’s membership. Keep project-owner access and a backup.

If Supabase pauses your project after inactivity, restore it from its dashboard. Existing local plans/files remain usable offline, and edits can sync after the backend is available again.
