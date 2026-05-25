import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    // 1. Cria o seller primeiro no banco — se falhar, não criamos nada no Asaas
    let seller;
    try {
      seller = await this.repository.create(dto);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('User already has a seller profile');
      }
      throw error;
    }

    // 2. Tenta criar a subconta no Asaas (marketplace)
    // Se falhar, o seller já existe no banco sem Asaas —
    // podemos reprocessar depois manualmente sem perder dados
    try {
      const result = await this.asaasProvider.createSubAccount({
        name: dto.companyName,
        email: user.email,
        cpfCnpj: dto.document,
        companyType: dto.document.length > 11 ? 'MEI' : undefined,
      });

      // Atualiza o seller com os dados da Asaas
      await this.repository.updateAsaasData(seller.id, {
        asaasAccountId: result.id,
        asaasWalletId: result.walletId,
      });

      this.logger.log(`Asaas subaccount created for seller ${dto.userId}: ${result.id}`);
    } catch (error) {
      this.logger.error(`Failed to create Asaas subaccount for seller ${dto.userId}`, error);
      // Não bloqueia — seller existe no banco, integração Asaas pode ser
      // feita depois manualmente no painel admin
    }

    return seller;
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
