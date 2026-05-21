import request from 'supertest';
import { getApp, getPrismaService, createTestUser } from '@test/setup/e2e.setup';

interface LoginResponse {
  access_token: string;
  user: { id: string; email: string; role: string };
}

interface NotificationResponse {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
}

interface PaginatedNotificationsResponse {
  data: NotificationResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface UnreadCountResponse {
  count: number;
}

describe('NotificationsController (e2e)', () => {
  const prisma = getPrismaService();

  afterEach(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('GET /notifications', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      const app = getApp();
      const user = await createTestUser('notif@example.com', 'Password123!', 'Notif User');
      userId = user.id;

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'notif@example.com', password: 'Password123!' })
        .expect(200);

      accessToken = (loginResponse.body as LoginResponse).access_token;

      // Create test notifications
      await prisma.notification.createMany({
        data: [
          {
            userId,
            title: 'Notification 1',
            message: 'Message 1',
            type: 'INFO',
            isRead: false,
          },
          {
            userId,
            title: 'Notification 2',
            message: 'Message 2',
            type: 'WARNING',
            isRead: true,
          },
          {
            userId,
            title: 'Notification 3',
            message: 'Message 3',
            type: 'INFO',
            isRead: false,
          },
        ],
      });
    });

    it('should return paginated notifications for current user', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as PaginatedNotificationsResponse;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.data.length).toBe(3);
      expect(body.meta.total).toBe(3);
    });

    it('should support pagination params', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get('/notifications?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as PaginatedNotificationsResponse;
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.meta.limit).toBe(2);
    });

    it('should not return notifications for other users', async () => {
      const app = getApp();

      // Create another user with notifications
      const otherUser = await createTestUser('other@example.com', 'Password123!', 'Other User');
      await prisma.notification.create({
        data: {
          userId: otherUser.id,
          title: 'Other Notification',
          message: 'Should not be visible',
          type: 'INFO',
          isRead: false,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as PaginatedNotificationsResponse;
      // Should only return 3 (our user's notifications), not 4
      expect(body.data.length).toBe(3);
      for (const notif of body.data) {
        expect(notif.message).not.toBe('Should not be visible');
      }
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get('/notifications').expect(401);
    });
  });

  describe('GET /notifications/unread/count', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      const app = getApp();
      const user = await createTestUser('unread@example.com', 'Password123!', 'Unread User');
      userId = user.id;

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'unread@example.com', password: 'Password123!' })
        .expect(200);

      accessToken = (loginResponse.body as LoginResponse).access_token;

      await prisma.notification.createMany({
        data: [
          { userId, title: 'Unread 1', message: 'Msg 1', type: 'INFO', isRead: false },
          { userId, title: 'Unread 2', message: 'Msg 2', type: 'INFO', isRead: false },
          { userId, title: 'Read 1', message: 'Msg 3', type: 'INFO', isRead: true },
        ],
      });
    });

    it('should return count of unread notifications', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get('/notifications/unread/count')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as UnreadCountResponse;
      expect(body).toHaveProperty('count', 2);
    });

    it('should return 0 when all notifications are read', async () => {
      const app = getApp();

      // Mark all as read
      await prisma.notification.updateMany({
        where: { userId },
        data: { isRead: true },
      });

      const response = await request(app.getHttpServer())
        .get('/notifications/unread/count')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as UnreadCountResponse;
      expect(body).toHaveProperty('count', 0);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get('/notifications/unread/count').expect(401);
    });
  });

  describe('GET /notifications/:id', () => {
    let accessToken: string;
    let notificationId: string;

    beforeEach(async () => {
      const app = getApp();
      const user = await createTestUser('single@example.com', 'Password123!', 'Single User');

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'single@example.com', password: 'Password123!' })
        .expect(200);

      accessToken = (loginResponse.body as LoginResponse).access_token;

      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Single Notification',
          message: 'Single Message',
          type: 'INFO',
          isRead: false,
        },
      });
      notificationId = notification.id;
    });

    it('should return notification by ID', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get(`/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as NotificationResponse;
      expect(body.id).toBe(notificationId);
      expect(body.title).toBe('Single Notification');
    });

    it('should return 404 for non-existing notification', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .get('/notifications/non-existing-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 404 for notification belonging to another user', async () => {
      const app = getApp();

      // Create another user's notification
      const otherUser = await createTestUser('other-notif@example.com', 'Password123!', 'Other');
      const otherNotif = await prisma.notification.create({
        data: {
          userId: otherUser.id,
          title: 'Other Notification',
          message: 'Other Message',
          type: 'INFO',
          isRead: false,
        },
      });

      await request(app.getHttpServer())
        .get(`/notifications/${otherNotif.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    let accessToken: string;
    let notificationId: string;

    beforeEach(async () => {
      const app = getApp();
      const user = await createTestUser('read@example.com', 'Password123!', 'Read User');

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'read@example.com', password: 'Password123!' })
        .expect(200);

      accessToken = (loginResponse.body as LoginResponse).access_token;

      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'To Read',
          message: 'Message',
          type: 'INFO',
          isRead: false,
        },
      });
      notificationId = notification.id;
    });

    it('should mark notification as read', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .patch(`/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as NotificationResponse;
      expect(body.isRead).toBe(true);

      // Verify in DB
      const notifInDb = await prisma.notification.findUnique({
        where: { id: notificationId },
      });
      expect(notifInDb?.isRead).toBe(true);
    });

    it('should return 404 for non-existing notification', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .patch('/notifications/non-existing-id/read')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /notifications/read-all', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      const app = getApp();
      const user = await createTestUser('read-all@example.com', 'Password123!', 'Read All User');
      userId = user.id;

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'read-all@example.com', password: 'Password123!' })
        .expect(200);

      accessToken = (loginResponse.body as LoginResponse).access_token;

      await prisma.notification.createMany({
        data: [
          { userId, title: 'N1', message: 'M1', type: 'INFO', isRead: false },
          { userId, title: 'N2', message: 'M2', type: 'INFO', isRead: false },
          { userId, title: 'N3', message: 'M3', type: 'INFO', isRead: false },
        ],
      });
    });

    it('should mark all notifications as read', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify all are read in DB
      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      });
      expect(unreadCount).toBe(0);
    });

    it('should not affect other users notifications', async () => {
      const app = getApp();

      // Create another user's unread notification
      const otherUser = await createTestUser('other-read@example.com', 'Password123!', 'Other');
      await prisma.notification.create({
        data: {
          userId: otherUser.id,
          title: 'Other',
          message: 'Other',
          type: 'INFO',
          isRead: false,
        },
      });

      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Other user's notification should still be unread
      const otherUnread = await prisma.notification.count({
        where: { userId: otherUser.id, isRead: false },
      });
      expect(otherUnread).toBe(1);
    });
  });
});
