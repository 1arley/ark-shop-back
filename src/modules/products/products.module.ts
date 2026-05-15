import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { CsvParserService } from './services/csv-parser.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository, CsvParserService],
  exports: [ProductsService, ProductsRepository, CsvParserService],
})
export class ProductsModule {}
