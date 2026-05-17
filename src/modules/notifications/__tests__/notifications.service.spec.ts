import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications.service';
import { NotificationsRepository } from '../notifications.repository';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repository: NotificationsRepository;

  const mockNotificationsRepository = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    countUnread: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: mockNotificationsRepository },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repository = module.get<NotificationsRepository>(NotificationsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('deve listar notificações com paginação', async () => {
      const paginatedResult = {
        data: [
          { id: '1', subject: 'Notificação 1', readAt: null },
          { id: '2', subject: 'Notificação 2', readAt: new Date() },
        ],
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      };

      mockNotificationsRepository.findByUserId.mockResolvedValue(paginatedResult);

      const result = await service.findAll('user-1', 1, 20);

      expect(result).toEqual(paginatedResult);
      expect(repository.findByUserId).toHaveBeenCalledWith('user-1', 1, 20);
    });
  });

  describe('findOne', () => {
    it('deve encontrar notificação com sucesso', async () => {
      const notification = {
        id: 'notif-1',
        userId: 'user-1',
        subject: 'Test Notification',
        content: 'Test content',
        readAt: null,
        type: 'EMAIL',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationsRepository.findById.mockResolvedValue(notification);

      const result = await service.findOne('notif-1', 'user-1');

      expect(result).toEqual(notification);
      expect(repository.findById).toHaveBeenCalledWith('notif-1');
    });

    it('deve lançar NotFoundException se notificação não existir', async () => {
      mockNotificationsRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('notif-999', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ForbiddenException se notificação pertencer a outro usuário', async () => {
      const notification = {
        id: 'notif-1',
        userId: 'user-2',
        subject: 'Test Notification',
        content: 'Test content',
        readAt: null,
        type: 'EMAIL',
        status: 'PENDING',
      };

      mockNotificationsRepository.findById.mockResolvedValue(notification);

      await expect(service.findOne('notif-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markAsRead', () => {
    it('deve marcar notificação como lida', async () => {
      const notification = {
        id: 'notif-1',
        userId: 'user-1',
        subject: 'Test',
        readAt: null,
      };

      const updatedNotification = {
        ...notification,
        readAt: new Date(),
      };

      mockNotificationsRepository.findById.mockResolvedValue(notification);
      mockNotificationsRepository.markAsRead.mockResolvedValue(updatedNotification);

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(result).toEqual(updatedNotification);
      expect(repository.markAsRead).toHaveBeenCalledWith('notif-1');
    });

    it('deve lançar NotFoundException se notificação não existir', async () => {
      mockNotificationsRepository.findById.mockResolvedValue(null);

      await expect(service.markAsRead('notif-999', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ForbiddenException se notificação pertencer a outro usuário', async () => {
      const notification = {
        id: 'notif-1',
        userId: 'user-2',
        subject: 'Test',
        readAt: null,
      };

      mockNotificationsRepository.findById.mockResolvedValue(notification);

      await expect(service.markAsRead('notif-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markAllAsRead', () => {
    it('deve marcar todas as notificações como lidas', async () => {
      mockNotificationsRepository.markAllAsRead.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-1');

      expect(result).toEqual({ count: 5 });
      expect(repository.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('countUnread', () => {
    it('deve contar notificações não lidas', async () => {
      mockNotificationsRepository.countUnread.mockResolvedValue(3);

      const result = await service.countUnread('user-1');

      expect(result).toBe(3);
      expect(repository.countUnread).toHaveBeenCalledWith('user-1');
    });
  });
});
