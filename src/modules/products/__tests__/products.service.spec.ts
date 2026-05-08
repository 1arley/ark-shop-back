import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from '../products.service';
import { ProductsRepository } from '../products.repository';
import { NotFoundException } from '@nestjs/common';

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
});
