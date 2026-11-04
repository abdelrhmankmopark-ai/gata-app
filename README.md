# Gata App — جتاب

An Arabic-first, installable messaging PWA with an original G mark and a Liquid Glass-inspired interface.

## Included
- Supabase email/password authentication.
- Username lookup (8–24 lowercase letters, digits, or underscores; must contain a digit).
- Direct conversations and realtime messages.
- Online/offline indicator based on last activity.
- Read receipts and delete-for-everyone.
- Arabic/English language preference.
- PWA manifest, app icon, and offline app shell.

## Backend
The app connects to the Supabase project configured during setup. The browser uses only the publishable key; database access is restricted by Row Level Security. Never add a Supabase service-role/secret key to this repository.

## Publish
A GitHub Actions workflow is included. In repository Settings → Pages, set **Build and deployment → Source** to **GitHub Actions**. Pushes to `main` will then deploy the site.

After deployment, open the Pages URL in Chrome and use **Add to Home screen** to install it.

## Important
This is an early working version. Test account registration, email confirmation, two-user messaging, realtime delivery, read receipts, and delete-for-everyone before inviting others. Audio/video calls, push notifications, media uploads, group chats, and end-to-end encryption are not included yet.
