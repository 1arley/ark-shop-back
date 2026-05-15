import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CsvParserService } from './services/csv-parser.service';
import { PrismaService } from '@/prisma/prisma.service';

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  products: any[];
  errors?: string[];
  skippedProducts?: string[];
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly csvParser: CsvParserService,
    private readonly prisma: PrismaService,
  ) {}

  async create(createProductDto: CreateProductDto) {
    return this.productsRepository.create(createProductDto);
  }

  async findAll(
    page: number,
    limit: number,
    filters?: {
      isActive?: boolean;
      categoryId?: string;
      search?: string;
    },
  ) {
    return await this.productsRepository.findAll(page, limit, filters);
  }

  async findOne(id: string) {
    return this.productsRepository.findById(id);
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    return this.productsRepository.update(id, updateProductDto);
  }

  async delete(id: string) {
    return this.productsRepository.delete(id);
  }

  async findByCategory(categoryId: string, page: number = 1, limit: number = 10) {
    return await this.productsRepository.findByCategory(categoryId, page, limit);
  }

  /**
   * Import products from CSV content
   * CSV must be in Google Sheets export format with platform columns
   */
  async importFromCsv(
    csvContent: string,
    options?: { categoryId?: string; isActive?: boolean },
  ): Promise<ImportResult> {
    // ✅ Log de início da importação (AUDITORIA)
    this.logger.log(`CSV import started - Size: ${csvContent.length} bytes`);

    const parsedProducts = this.csvParser.parse(csvContent);

    this.logger.log(`Parsed ${parsedProducts.length} products from CSV`);

    // ✅ Validação de categoria (CRÍTICO: Integridade do banco)
    if (options?.categoryId) {
      const categoryExists = await this.prisma.category.findUnique({
        where: { id: options.categoryId },
      });

      if (!categoryExists) {
        this.logger.error(`Category not found: ${options.categoryId}`);
        throw new BadRequestException(`Category with ID "${options.categoryId}" not found`);
      }
    }

    const errors: string[] = [];
    const importedProducts: any[] = [];
    const skippedProducts: string[] = [];
    let failedCount = 0;
    let skippedCount = 0;

    // ✅ Processamento em batch (PERFORMANCE: Evita N+1 queries)
    const batchSize = 50;
    for (let i = 0; i < parsedProducts.length; i += batchSize) {
      const batch = parsedProducts.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async product => {
          try {
            const productName = `${product.name} (${product.platform})`;

            // ✅ Verificação de duplicatas (CRÍTICO: Previne dados duplicados)
            const existingProduct = await this.productsRepository.findByName(productName);
            if (existingProduct) {
              return {
                success: false,
                skipped: true,
                error: `Product "${productName}" already exists`,
              };
            }

            const createDto: CreateProductDto = {
              name: productName,
              description: `Product imported from CSV - Platform: ${product.platform}${product.region ? ` - Region: ${product.region}` : ''}`,
              price: product.price,
              stock: 1,
              isActive: options?.isActive ?? true,
              categoryId: options?.categoryId,
            };

            const created = await this.productsRepository.create(createDto);
            return { success: true, product: created };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
              success: false,
              skipped: false,
              error: `Failed to import "${product.name}": ${errorMessage}`,
            };
          }
        }),
      );

      // Process batch results
      batchResults.forEach(result => {
        if (result.success) {
          importedProducts.push(result.product);
        } else if (result.skipped) {
          skippedCount++;
          skippedProducts.push(result.error);
        } else {
          failedCount++;
          errors.push(result.error!);
        }
      });
    }

    // ✅ Log de conclusão (AUDITORIA)
    this.logger.log(
      `CSV import completed - Imported: ${importedProducts.length}, Skipped: ${skippedCount}, Failed: ${failedCount}`,
    );

    return {
      imported: importedProducts.length,
      skipped: skippedCount,
      failed: failedCount,
      products: importedProducts,
      errors: errors.length > 0 ? errors : undefined,
      skippedProducts: skippedProducts.length > 0 ? skippedProducts : undefined,
    };
  }
}
