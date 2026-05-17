import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsRepository } from '../notifications.repository';
import { PrismaService } from '@/prisma/prisma.service';

describe('NotificationsRepository', () => {
  let repository: NotificationsRepository;
  let prisma: PrismaService;

  const mockPrismaService = {
    notification: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<NotificationsRepository>(NotificationsRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByUserId', () => {
    it('deve listar notificações com paginação', async () => {
      const notifications = [
        { id: '1', userId: 'user-1', subject: 'Notificação 1', readAt: null },
        { id: '2', userId: 'user-1', subject: 'Notificação 2', readAt: new Date() },
      ];

      mockPrismaService.$transaction.mockResolvedValue([notifications, 2]);

      const result = await repository.findByUserId('user-1', 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('deve encontrar notificação por ID', async () => {
      const notification = {
        id: 'notif-1',
        userId: 'user-1',
        subject: 'Test',
        content: 'Content',
        readAt: null,
        type: 'EMAIL',
        status: 'PENDING',
      };

      mockPrismaService.notification.findUnique.mockResolvedValue(notification);

      const result = await repository.findById('notif-1');

      expect(result).toEqual(notification);
      expect(prisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });
    });

    it('deve retornar null se notificação não existir', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue(null);

      const result = await repository.findById('notif-999');

      expect(result).toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('deve marcar notificação como lida', async () => {
      const updatedNotification = {
        id: 'notif-1',
        userId: 'user-1',
        subject: 'Test',
        readAt: new Date(),
      };

      mockPrismaService.notification.update.mockResolvedValue(updatedNotification);

      const result = await repository.markAsRead('notif-1');

      expect(result).toEqual(updatedNotification);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('markAllAsRead', () => {
    it('deve marcar todas as notificações como lidas e retornar contagem', async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await repository.markAllAsRead('user-1');

      expect(result).toEqual({ count: 5 });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('countUnread', () => {
    it('deve contar notificações não lidas', async () => {
      mockPrismaService.notification.count.mockResolvedValue(3);

      const result = await repository.countUnread('user-1');

      expect(result).toBe(3);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
      });
    });
  });
});
