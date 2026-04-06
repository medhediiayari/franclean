import { api } from './api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Request push permission and subscribe to push notifications */
export async function subscribeToPush(): Promise<boolean> {
  try {
    // Check browser support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('🔔 Push not supported in this browser');
      return false;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('🔔 Push permission denied');
      return false;
    }

    // Get VAPID public key from server
    const { publicKey } = await api.get<{ publicKey: string }>('/push/vapid-key');
    if (!publicKey) {
      console.log('🔔 No VAPID key configured');
      return false;
    }

    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    // Send subscription to server
    const subJson = subscription.toJSON();
    await api.post('/push/subscribe', {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    });

    console.log('🔔 Push subscription active');
    return true;
  } catch (err) {
    console.error('🔔 Push subscription failed:', err);
    return false;
  }
}

/** Unsubscribe from push notifications */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await api.post('/push/unsubscribe', { endpoint });
    }
  } catch (err) {
    console.error('🔔 Unsubscribe failed:', err);
  }
}
