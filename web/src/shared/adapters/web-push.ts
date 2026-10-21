import type { PushSubscriptionData } from "../domain/device-push";

/** Without an active service worker `ready` never settles, so waiting for it has a deadline. */
const READY_TIMEOUT_MS = 5000;

/** Decodes base64url (what the server publishes) by hand: `atob` only reads classic base64. */
function decodeKey(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function sameBytes(left: ArrayBuffer, right: Uint8Array): boolean {
  const view = new Uint8Array(left);
  return view.length === right.length && view.every((byte, index) => byte === right[index]);
}

function toData(subscription: PushSubscription): PushSubscriptionData {
  const { endpoint, keys } = subscription.toJSON();
  if (endpoint === undefined || keys?.p256dh === undefined || keys.auth === undefined) {
    throw new Error("O aparelho devolveu uma inscrição incompleta.");
  }
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error("O serviço de notificações do aparelho não respondeu."));
    }, READY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function existingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** The only place that knows `PushManager` and the service worker registration. */
export async function currentPushSubscription(): Promise<PushSubscriptionData | null> {
  const subscription = await existingSubscription();
  return subscription ? toData(subscription) : null;
}

/**
 * Subscribes this device with the server's key. An existing subscription for the same key is
 * reused (subscribing again would mint another endpoint); one made for a different key, after the
 * server's pair changed, is dropped and replaced.
 */
export async function subscribeToPush(publicKey: string): Promise<PushSubscriptionData> {
  const registration = await readyRegistration();
  const applicationServerKey = decodeKey(publicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    const { applicationServerKey: existingKey } = existing.options;
    if (existingKey === null || sameBytes(existingKey, applicationServerKey)) {
      return toData(existing);
    }
    await existing.unsubscribe();
  }
  const created = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  return toData(created);
}

/** Cancels this device's subscription and returns its endpoint, or null when there was none. */
export async function unsubscribeFromPush(): Promise<string | null> {
  const subscription = await existingSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return endpoint;
}
