import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { KeysModule } from '@/modules/keys/keys.module';
import { ProductsModule } from '@/modules/products/products.module';

@Module({
  imports: [PrismaModule, KeysModule, ProductsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
  exports: [AdminService, AdminRepository],
})
export class AdminModule {}
