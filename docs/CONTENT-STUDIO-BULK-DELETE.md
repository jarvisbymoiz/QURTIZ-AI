# Content Studio bulk deletion

Workspace editors can select individual eligible posts or all eligible posts in the current filter, then confirm permanent deletion. Changing filters clears selection. Each post uses the existing authorized server action; failures remain selected and are reported without pretending the batch was atomic.

The delete action verifies workspace ownership, locks the post and its variants, and protects scheduled, generating, actively publishing and published records. Published delivery history remains archive-only. No external Facebook/Instagram posts are removed.

Before deleting the post, its media cleanup records are inserted in the same database transaction. Queue failure aborts the deletion. Existing foreign-key cascades remove content variants, visuals and publishing-job records. Media paths must belong to the active workspace.

After commit, the existing media eligibility check protects shared files. Unreferenced files are removed from Supabase Storage immediately. Successfully cleaned queue entries retain the existing audit history. Storage failures produce a visible warning and remain eligible for the existing cleanup worker's bounded retries; the user must not interpret database deletion as confirmation of file cleanup when a warning is shown.

Tests cover authorization, queue-before-delete ordering, queue failure, storage failure, shared files, protected parent and variant states, and cross-workspace media paths. Browser verification could not run because the built-in browser kernel reported a missing asset path. No existing customer post was deleted during development.
