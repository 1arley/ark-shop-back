import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from '../products.service';
import { ProductsRepository } from '../products.repository';
import { NotFoundException } from '@nestjs/common';
import { CsvParserService } from '../services/csv-parser.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CsvParserService } from '../services/csv-parser.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: ProductsRepository;

  const _mockPrismaService = {
    product: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: ProductsRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findByCategory: jest.fn(),
          },
        },
        {
          provide: CsvParserService,
          useValue: {
            parse: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            category: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    repository = module.get<ProductsRepository>(ProductsRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product', async () => {
      const createProductDto = {
        name: 'Test Product',
        price: 29.99,
        description: 'Test Description',
        stock: 10,
        isActive: true,
      };

      const expectedProduct = {
        id: 'uuid',
        ...createProductDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(repository, 'create').mockResolvedValue(expectedProduct as any);

      const result = await service.create(createProductDto as any);
      expect(result).toEqual(expectedProduct);
      expect(repository.create).toHaveBeenCalledWith(createProductDto);
    });
  });

  describe('findOne', () => {
    it('should return a product', async () => {
      const productId = 'test-id';
      const expectedProduct = {
        id: productId,
        name: 'Test Product',
        price: 29.99,
      };

      jest.spyOn(repository, 'findById').mockResolvedValue(expectedProduct as any);

      const result = await service.findOne(productId);
      expect(result).toEqual(expectedProduct);
      expect(repository.findById).toHaveBeenCalledWith(productId);
    });

    it('should throw NotFoundException if product not found', async () => {
      jest.spyOn(repository, 'findById').mockRejectedValue(new NotFoundException());

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      const expectedResponse = {
        data: [
          { id: '1', name: 'Product 1', price: 19.99 },
          { id: '2', name: 'Product 2', price: 29.99 },
        ],
        meta: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      jest.spyOn(repository, 'findAll').mockResolvedValue(expectedResponse as any);

      const result = await service.findAll(1, 10);
      expect(result).toEqual(expectedResponse);
      expect(repository.findAll).toHaveBeenCalledWith(1, 10, undefined);
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const productId = 'test-id';
      const updateDto = { name: 'Updated Name' };
      const updatedProduct = { id: productId, ...updateDto };

      jest.spyOn(repository, 'update').mockResolvedValue(updatedProduct as any);

      const result = await service.update(productId, updateDto as any);
      expect(result).toEqual(updatedProduct);
      expect(repository.update).toHaveBeenCalledWith(productId, updateDto);
    });
  });

  describe('delete', () => {
    it('should delete a product', async () => {
      const productId = 'test-id';
      jest.spyOn(repository, 'delete').mockResolvedValue(undefined as any);

      await service.delete(productId);
      expect(repository.delete).toHaveBeenCalledWith(productId);
    });
  });

  describe('importFromCsv', () => {
    it('should import products from CSV', async () => {
      const csvContent =
        'XBOX,STEAM/PC\nCarimbo de data/hora,Nome do jogo,preço de venda\n07/12/2025,Test Game(xbox-europa),R$100,00';
      const parsedProducts = [{ name: 'Test Game', price: 100, platform: 'XBOX', region: 'eu' }];
      const createdProduct = { id: 'uuid', name: 'Test Game (XBOX)', price: 100 };

      const mockParse = jest.spyOn(service['csvParser'], 'parse');
      mockParse.mockReturnValue(parsedProducts as any);

      jest.spyOn(repository, 'create').mockResolvedValue(createdProduct as any);

      const result = await service.importFromCsv(csvContent);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(0);
      expect(repository.create).toHaveBeenCalledWith({
        name: 'Test Game (XBOX)',
        description: expect.stringContaining('Platform: XBOX'),
        price: 100,
        stock: 1,
        isActive: true,
        categoryId: undefined,
      });
    });

    it('should handle import errors gracefully', async () => {
      const csvContent =
        'XBOX\nCarimbo de data/hora,Nome do jogo,preço de venda\n07/12/2025,Test Game,R$100,00';
      const parsedProducts = [{ name: 'Test Game', price: 100, platform: 'XBOX' }];

      const mockParse = jest.spyOn(service['csvParser'], 'parse');
      mockParse.mockReturnValue(parsedProducts as any);

      jest.spyOn(repository, 'create').mockRejectedValue(new Error('Database error'));

      const result = await service.importFromCsv(csvContent);

      expect(result.imported).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('Failed to import');
    });
  });
});
