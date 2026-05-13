import { Injectable, Logger } from '@nestjs/common';
import { SellersRepository } from './sellers.repository';
import { UserService } from '@/user/user.service';
import { CreateSellerDto, UpdateSellerDto } from './dto/create-seller.dto';
import { AsaasProvider } from '@/modules/payments/providers/asaas.provider';

@Injectable()
export class SellersService {
  private readonly logger = new Logger(SellersService.name);

  constructor(
    private readonly repository: SellersRepository,
    private readonly userService: UserService,
    private readonly asaasProvider: AsaasProvider,
  ) {}

  async create(dto: CreateSellerDto) {
    const user = await this.userService.findById(dto.userId);

    // Cria a subconta do seller no Asaas (marketplace)
    let asaasAccountId: string | undefined;
    let asaasWalletId: string | undefined;

    try {
      const result = await this.asaasProvider.createSubAccount({
        name: dto.companyName,
        email: user.email,
        cpfCnpj: dto.document,
        companyType: dto.document.length > 11 ? 'MEI' : undefined,
      });

      asaasAccountId = result.id;
      asaasWalletId = result.walletId;

      this.logger.log(`Asaas subaccount created for seller ${dto.userId}: ${result.id}`);
    } catch (error) {
      this.logger.error(`Failed to create Asaas subaccount for seller ${dto.userId}`, error);
      // Não bloqueia o cadastro — o seller pode ser criado sem Asaas
      // e a integração pode ser feita depois manualmente
    }

    return this.repository.create(dto, asaasAccountId, asaasWalletId);
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
