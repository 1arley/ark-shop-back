import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesRepository } from '../categories.repository';
import { PrismaService } from '@/prisma/prisma.service';

describe('CategoriesRepository', () => {
  let repository: CategoriesRepository;
  let prisma: PrismaService;

  const mockPrismaService = {
    category: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<CategoriesRepository>(CategoriesRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar categoria com parent', async () => {
      const createDto = {
        name: 'Subcategory',
        description: 'A subcategory',
        parentId: 'parent-1',
      };

      const createdCategory = {
        id: 'cat-2',
        name: 'Subcategory',
        description: 'A subcategory',
        parentId: 'parent-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.category.create.mockResolvedValue(createdCategory);

      const result = await repository.create(createDto);

      expect(result).toEqual(createdCategory);
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Subcategory',
          description: 'A subcategory',
          parentId: 'parent-1',
        },
      });
    });

    it('deve criar categoria sem parent', async () => {
      const createDto = {
        name: 'Root Category',
        description: 'A root category',
      };

      const createdCategory = {
        id: 'cat-1',
        name: 'Root Category',
        description: 'A root category',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.category.create.mockResolvedValue(createdCategory);

      const result = await repository.create(createDto);

      expect(result).toEqual(createdCategory);
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Root Category',
          description: 'A root category',
          parentId: undefined,
        },
      });
    });
  });

  describe('findById', () => {
    it('deve encontrar categoria com relações', async () => {
      const category = {
        id: 'cat-1',
        name: 'Games',
        parentId: null,
        parent: null,
        children: [],
        products: [],
        _count: { products: 5, children: 2 },
      };

      mockPrismaService.category.findUnique.mockResolvedValue(category);

      const result = await repository.findById('cat-1');

      expect(result).toEqual(category);
      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        include: {
          parent: true,
          children: true,
          products: { take: 5, orderBy: { createdAt: 'desc' } },
          _count: { select: { products: true, children: true } },
        },
      });
    });

    it('deve retornar null se categoria não existir', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      const result = await repository.findById('cat-999');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('deve listar categorias com relações e ordenadas', async () => {
      const categories = [
        { id: '1', name: 'Electronics', parent: null, children: [], _count: { products: 3 } },
        { id: '2', name: 'Games', parent: null, children: [], _count: { products: 5 } },
      ];

      mockPrismaService.category.findMany.mockResolvedValue(categories);

      const result = await repository.findAll();

      expect(result).toEqual(categories);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        include: {
          parent: true,
          children: true,
          _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('update', () => {
    it('deve atualizar categoria com sucesso', async () => {
      const updateDto = { name: 'Updated Games', description: 'Updated' };
      const updatedCategory = {
        id: 'cat-1',
        name: 'Updated Games',
        description: 'Updated',
        parentId: null,
        parent: null,
        children: [],
      };

      mockPrismaService.category.update.mockResolvedValue(updatedCategory);

      const result = await repository.update('cat-1', updateDto);

      expect(result).toEqual(updatedCategory);
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: {
          name: 'Updated Games',
          description: 'Updated',
          parentId: undefined,
        },
        include: {
          parent: true,
          children: true,
        },
      });
    });
  });

  describe('delete', () => {
    it('deve deletar com force=true mesmo com produtos/filhos', async () => {
      const category = {
        id: 'cat-1',
        name: 'Games',
        parentId: null,
        _count: { products: 5, children: 2 },
      };

      mockPrismaService.category.findUnique.mockResolvedValue(category);
      mockPrismaService.category.delete.mockResolvedValue(category);

      const result = await repository.delete('cat-1', true);

      expect(result).toEqual(category);
      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
      // Não deve verificar contagens adicionais
      expect(prisma.product.count).not.toHaveBeenCalled();
      expect(prisma.category.count).not.toHaveBeenCalled();
    });

    it('deve lançar erro sem force quando tem produtos', async () => {
      const category = {
        id: 'cat-1',
        name: 'Games',
        parentId: null,
        _count: { products: 5, children: 0 },
      };

      mockPrismaService.category.findUnique.mockResolvedValue(category);
      mockPrismaService.product.count.mockResolvedValue(5);
      mockPrismaService.category.count.mockResolvedValue(0);

      await expect(repository.delete('cat-1', false)).rejects.toThrow(
        'Cannot delete category: it has 5 products. Use force=true to delete anyway.',
      );
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('deve lançar erro sem force quando tem subcategorias', async () => {
      const category = {
        id: 'cat-1',
        name: 'Games',
        parentId: null,
        _count: { products: 0, children: 3 },
      };

      mockPrismaService.category.findUnique.mockResolvedValue(category);
      mockPrismaService.product.count.mockResolvedValue(0);
      mockPrismaService.category.count.mockResolvedValue(3);

      await expect(repository.delete('cat-1', false)).rejects.toThrow(
        'Cannot delete category: it has 3 subcategories. Use force=true to delete anyway.',
      );
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('deve deletar sem force quando não tem produtos nem filhos', async () => {
      const category = {
        id: 'cat-1',
        name: 'Games',
        parentId: null,
        _count: { products: 0, children: 0 },
      };

      mockPrismaService.category.findUnique.mockResolvedValue(category);
      mockPrismaService.category.delete.mockResolvedValue(category);

      const result = await repository.delete('cat-1', false);

      expect(result).toEqual(category);
      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
    });

    it('deve lançar erro se categoria não existir', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(repository.delete('cat-999', false)).rejects.toThrow('Category not found');
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });
  });

  describe('findRootCategories', () => {
    it('deve retornar categorias onde parentId é null', async () => {
      const rootCategories = [
        { id: '1', name: 'Games', children: [], _count: { products: 5 } },
        { id: '2', name: 'Electronics', children: [], _count: { products: 3 } },
      ];

      mockPrismaService.category.findMany.mockResolvedValue(rootCategories);

      const result = await repository.findRootCategories();

      expect(result).toEqual(rootCategories);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { parentId: null },
        include: {
          children: true,
          _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
      });
    });
  });
});
