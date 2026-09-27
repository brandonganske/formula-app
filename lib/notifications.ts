import { api, extractData } from './api';

// In-app notifications: offers, invites, review decisions, payouts,
// challenges, brain ready, results matched. Stored on IQ; HQ posts its
// events there. Each one can deep-link to a screen.

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function getNotifications(limit = 50): Promise<{ items: AppNotification[]; unread: number }> {
  return extractData(await api.get('/creators/me/notifications', { params: { limit } }));
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  await api.post('/creators/me/notifications/read', ids ? { ids } : {});
}
