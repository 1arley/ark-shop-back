import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  const mockNotificationsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    countUnread: jest.fn(),
  };

  const mockAuthenticatedRequest = {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      role: 'USER',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockNotificationsService }],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('deve listar notificações com paginação', async () => {
      const paginatedResult = {
        data: [{ id: '1', subject: 'Notificação 1', readAt: null }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };

      mockNotificationsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(mockAuthenticatedRequest as any, 1, 20);

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith('user-1', 1, 20);
    });

    it('deve usar valores padrão para paginação', async () => {
      mockNotificationsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      await controller.findAll(mockAuthenticatedRequest as any, 1, 20);

      expect(service.findAll).toHaveBeenCalledWith('user-1', 1, 20);
    });
  });

  describe('findOne', () => {
    it('deve buscar notificação por ID', async () => {
      const notification = {
        id: 'notif-1',
        userId: 'user-1',
        subject: 'Test',
        readAt: null,
      };

      mockNotificationsService.findOne.mockResolvedValue(notification);

      const result = await controller.findOne(mockAuthenticatedRequest as any, 'notif-1');

      expect(result).toEqual(notification);
      expect(service.findOne).toHaveBeenCalledWith('notif-1', 'user-1');
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

      mockNotificationsService.markAsRead.mockResolvedValue(updatedNotification);

      const result = await controller.markAsRead(mockAuthenticatedRequest as any, 'notif-1');

      expect(result).toEqual(updatedNotification);
      expect(service.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
    });
  });

  describe('markAllAsRead', () => {
    it('deve marcar todas as notificações como lidas', async () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue({ count: 5 });

      const result = await controller.markAllAsRead(mockAuthenticatedRequest as any);

      expect(result).toEqual({ count: 5 });
      expect(service.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('countUnread', () => {
    it('deve contar notificações não lidas', async () => {
      mockNotificationsService.countUnread.mockResolvedValue(3);

      const result = await controller.countUnread(mockAuthenticatedRequest as any);

      expect(result).toEqual({ count: 3 });
      expect(service.countUnread).toHaveBeenCalledWith('user-1');
    });
  });
});
