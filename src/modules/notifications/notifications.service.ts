import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  async findAll(userId: string, page: number, limit: number) {
    return this.repository.findByUserId(userId, page, limit);
  }

  async findOne(id: string, userId: string) {
    const notification = await this.repository.findById(id);
    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException('Você não tem permissão para acessar esta notificação.');
    }
    return notification;
  }

  async markAsRead(id: string, userId: string) {
    const result = await this.repository.markAsRead(id, userId);
    if (!result) {
      throw new NotFoundException('Notificação não encontrada ou não pertence ao usuário.');
    }
    return result;
  }

  async markAllAsRead(userId: string) {
    return this.repository.markAllAsRead(userId);
  }

  async countUnread(userId: string) {
    return this.repository.countUnread(userId);
  }
}
