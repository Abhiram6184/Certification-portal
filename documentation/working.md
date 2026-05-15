## How nultipage implemented

Client-Side Routing: I'll use the URL hash (#) to determine which view to display. This allows the new tab to open directly to the correct page (...#requestVoucher).
Session Persistence: I'll use the browser's localStorage to securely remember the logged-in user. This ensures that when a new tab opens, the user remains logged in and doesn't have to authenticate again.
These changes will provide the exact functionality you requested while also making the application more robust, all without altering any other features.