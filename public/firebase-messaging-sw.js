/* Firebase Cloud Messaging service worker for the storefront (browser push, checklist C4).
 *
 * The app registers it from lib/push/web-push.ts as
 *   /firebase-messaging-sw.js?apiKey=…&projectId=…&messagingSenderId=…&appId=…&v=<firebase version>
 * using the NEXT_PUBLIC_FIREBASE_* values from .env.local, so the config only lives there.
 *
 * No fetch handler: this worker never touches page or API requests.
 */
/* global firebase, importScripts */

const params = new URL(self.location.href).searchParams;
const config = {
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};
const sdkVersion = params.get('v');

// Push data key -> query param of /account/notifications/open.
const OPEN_PARAMS = [
  ['id', 'notification_id'],
  ['type', 'type'],
  ['target_type', 'target_type'],
  ['target_id', 'target_id'],
  ['target_slug', 'target_slug'],
  ['variant', 'variant'],
];

// Registered before Firebase loads, so it runs first. Firebase's own handler only opens a
// `fcm_options.link`, which the backend doesn't send; open the notification's screen instead.
self.addEventListener('notificationclick', (event) => {
  const message = event.notification.data && event.notification.data.FCM_MSG;
  if (!message) return;
  event.stopImmediatePropagation();
  event.notification.close();

  const data = message.data || {};
  const query = new URLSearchParams();
  for (const [param, key] of OPEN_PARAMS) {
    if (data[key]) query.set(param, data[key]);
  }
  const path = `/account/notifications/open?${query.toString()}`;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => client.url.startsWith(self.registration.scope));
      if (open) {
        // Navigate inside the running app (keeps its state) instead of reloading the tab.
        await open.focus();
        open.postMessage({ type: 'raf-push-open', url: path });
        return;
      }
      await self.clients.openWindow(path);
    })(),
  );
});

if (config.apiKey && config.projectId && config.messagingSenderId && config.appId && sdkVersion) {
  importScripts(
    `https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-app-compat.js`,
    `https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-messaging-compat.js`,
  );
  firebase.initializeApp(config);
  // Every backend push has a `notification` block, which Firebase shows by itself when no store
  // tab is in front. A tab in front gets the message through onMessage (WebPushSync) instead.
  firebase.messaging();
}
