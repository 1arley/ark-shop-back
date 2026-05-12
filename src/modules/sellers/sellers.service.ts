import { Injectable } from '@nestjs/common';
import { SellersRepository } from './sellers.repository';
import { UserService } from '@/user/user.service';
import { CreateSellerDto, UpdateSellerDto } from './dto/create-seller.dto';

@Injectable()
export class SellersService {
  constructor(
    private readonly repository: SellersRepository,
    private readonly userService: UserService,
  ) {}

  async create(dto: CreateSellerDto) {
    await this.userService.findById(dto.userId);
    return this.repository.create(dto);
  }

  async findAll(page: number, limit: number) {
    return this.repository.findAll(page, limit);
  }

  async findOne(id: string) {
    return this.repository.findById(id);
  }

  async update(id: string, dto: UpdateSellerDto) {
    return this.repository.update(id, dto);
  }

  async delete(id: string) {
    return this.repository.delete(id);
  }
}
