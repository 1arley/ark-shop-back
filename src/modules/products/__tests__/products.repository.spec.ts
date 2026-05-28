import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsRepository } from '../products.repository';
import { PrismaService } from '@/prisma/prisma.service';

describe('ProductsRepository', () => {
  let repository: ProductsRepository;
  let prisma: PrismaService;

  const mockPrismaService = {
    key: {
      count: jest.fn(),
    },
    account: {
      count: jest.fn(),
    },
    product: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<ProductsRepository>(ProductsRepository);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
    mockPrismaService.key.count.mockResolvedValue(0);
    mockPrismaService.account.count.mockResolvedValue(0);
  });

  it('deve estar definido', () => {
    expect(repository).toBeDefined();
  });

  // ─── create ───────────────────────────────────────────────────────
  describe('create', () => {
    it('deve criar um produto com todos os campos', async () => {
      const createDto = {
        name: 'Produto Completo',
        description: 'Descricao completa',
        price: 199.9,
        stock: 10,
        isActive: false,
        categoryId: 'cat-uuid',
        imageUrl: 'http://img.com/prod.jpg',
      };
      const createdProduct = {
        id: 'prod-1',
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.product.create.mockResolvedValue(createdProduct);

      const result = await repository.create(createDto);

      expect(result).toEqual(createdProduct);
      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          name: 'Produto Completo',
          description: 'Descricao completa',
          price: 199.9,
          stock: 10,
          isActive: false,
          categoryId: 'cat-uuid',
          imageUrl: 'http://img.com/prod.jpg',
          productType: 'KEY',
          instructions: undefined,
        },
      });
    });

    it('deve usar stock padrao 0 quando nao fornecido', async () => {
      const createDto = { name: 'Sem Stock', price: 50 };
      const created = { id: 'prod-2', ...createDto, stock: 0, isActive: true };

      mockPrismaService.product.create.mockResolvedValue(created);

      await repository.create(createDto);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stock: 0,
        }),
      });
    });

    it('deve usar isActive padrao false quando nao fornecido', async () => {
      const createDto = { name: 'Ativo Padrao', price: 30 };
      const created = { id: 'prod-3', ...createDto, stock: 0, isActive: false };

      mockPrismaService.product.create.mockResolvedValue(created);

      await repository.create(createDto);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isActive: false,
        }),
      });
    });

    it('deve criar produto com campos opcionais undefined (categoryId, imageUrl)', async () => {
      const createDto = { name: 'Simples', price: 10 };
      const created = { id: 'prod-4', ...createDto, stock: 0, isActive: false };

      mockPrismaService.product.create.mockResolvedValue(created);

      await repository.create(createDto);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          name: 'Simples',
          description: undefined,
          price: 10,
          stock: 0,
          isActive: false,
          categoryId: undefined,
          imageUrl: undefined,
          productType: 'KEY',
          instructions: undefined,
        },
      });
    });

    it('deve criar produto com isActive false explicito', async () => {
      const createDto = { name: 'Inativo', price: 25, isActive: false };
      const created = { id: 'prod-5', ...createDto, stock: 0 };

      mockPrismaService.product.create.mockResolvedValue(created);

      await repository.create(createDto);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isActive: false,
        }),
      });
    });

    it('deve bloquear criacao ativa sem estoque real para produto KEY', async () => {
      const createDto = {
        name: 'Sem Keys',
        price: 25,
        isActive: true,
        productType: 'KEY' as const,
      };

      await expect(repository.create(createDto)).rejects.toThrow(BadRequestException);
      await expect(repository.create(createDto)).rejects.toThrow(
        'Cannot activate KEY product without available stock. Import at least one available key first.',
      );
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('deve permitir criacao ativa quando houver estoque real para produto ACCOUNT', async () => {
      const createDto = {
        name: 'Conta Ativa',
        price: 25,
        isActive: true,
        productType: 'ACCOUNT' as const,
      };
      const created = { id: 'prod-account', ...createDto, stock: 0 };
      mockPrismaService.account.count.mockResolvedValue(1);
      mockPrismaService.product.create.mockResolvedValue(created);

      await repository.create(createDto);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true, productType: 'ACCOUNT' }),
        }),
      );
    });
  });

  // ─── findById ─────────────────────────────────────────────────────
  describe('findById', () => {
    it('deve retornar um produto quando encontrado', async () => {
      const product = {
        id: 'prod-1',
        name: 'Produto',
        price: 50,
        category: { id: 'cat-1', name: 'Categoria' },
        _count: { keys: 3 },
      };

      mockPrismaService.product.findUnique.mockResolvedValue(product);

      const result = await repository.findById('prod-1');

      expect(result).toEqual(product);
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        include: {
          category: true,
          _count: { select: { keys: true } },
        },
      });
    });

    it('deve lancar NotFoundException quando produto nao existe', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(repository.findById('nao-existe')).rejects.toThrow(NotFoundException);
      await expect(repository.findById('nao-existe')).rejects.toThrow(
        'Product with ID nao-existe not found',
      );
    });

    it('deve incluir categoria e contagem de keys', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Test',
        price: 10,
        category: { id: 'cat-1' },
        _count: { keys: 0 },
      });

      await repository.findById('prod-1');

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        include: {
          category: true,
          _count: { select: { keys: true } },
        },
      });
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────
  describe('findAll', () => {
    it('deve retornar produtos paginados sem filtros', async () => {
      const products = [
        { id: '1', name: 'Produto A', price: 10 },
        { id: '2', name: 'Produto B', price: 20 },
      ];

      mockPrismaService.product.findMany.mockResolvedValue(products);
      mockPrismaService.product.count.mockResolvedValue(2);

      const result = await repository.findAll(1, 10);

      expect(result.data).toEqual(products);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {},
        include: { category: true },
        orderBy: [{ stock: 'desc' }, { createdAt: 'desc' }],
      });
      expect(prisma.product.count).toHaveBeenCalledWith({ where: {} });
    });

    it('deve retornar produtos com filtro isActive', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await repository.findAll(1, 10, { isActive: true });

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: { isActive: true },
        include: { category: true },
        orderBy: [{ stock: 'desc' }, { createdAt: 'desc' }],
      });
    });

    it('deve retornar produtos com filtro categoryId', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await repository.findAll(1, 10, { categoryId: 'cat-1' });

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: { categoryId: 'cat-1' },
        include: { category: true },
        orderBy: [{ stock: 'desc' }, { createdAt: 'desc' }],
      });
    });

    it('deve retornar produtos com filtro search (name e description)', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await repository.findAll(1, 10, { search: 'termo' });

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {
          OR: [
            { name: { contains: 'termo', mode: 'insensitive' } },
            { description: { contains: 'termo', mode: 'insensitive' } },
          ],
        },
        include: { category: true },
        orderBy: [{ stock: 'desc' }, { createdAt: 'desc' }],
      });
    });

    it('deve aplicar todos os filtros combinados', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await repository.findAll(1, 10, {
        isActive: false,
        categoryId: 'cat-1',
        search: 'busca',
      });

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {
          isActive: false,
          categoryId: 'cat-1',
          OR: [
            { name: { contains: 'busca', mode: 'insensitive' } },
            { description: { contains: 'busca', mode: 'insensitive' } },
          ],
        },
        include: { category: true },
        orderBy: [{ stock: 'desc' }, { createdAt: 'desc' }],
      });
    });

    it('deve calcular skip corretamente para pagina 2', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await repository.findAll(2, 10);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('deve calcular skip corretamente para pagina 3 com limit 5', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await repository.findAll(3, 5);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('deve calcular totalPages corretamente', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(25);

      const result = await repository.findAll(1, 10);

      expect(result.meta.totalPages).toBe(3); // ceil(25/10) = 3
    });

    it('deve retornar lista vazia quando nenhum produto corresponde', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      const result = await repository.findAll(1, 10);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('deve usar parametros padrao quando nao fornecidos', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await repository.findAll();

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it('deve executar findMany e count em paralelo (Promise.all)', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await repository.findAll(1, 10);

      // Ambos devem ter sido chamados
      expect(prisma.product.findMany).toHaveBeenCalled();
      expect(prisma.product.count).toHaveBeenCalled();
    });
  });

  // ─── update ───────────────────────────────────────────────────────
  describe('update', () => {
    it('deve atualizar um produto quando encontrado', async () => {
      const updateDto = { name: 'Atualizado', price: 150 };
      const existingProduct = { id: 'prod-1', name: 'Antigo', price: 100 };
      const updatedProduct = { id: 'prod-1', ...updateDto, updatedAt: new Date() };

      mockPrismaService.product.findUnique.mockResolvedValue(existingProduct);
      mockPrismaService.product.update.mockResolvedValue(updatedProduct);

      const result = await repository.update('prod-1', updateDto);

      expect(result).toEqual(updatedProduct);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: {
          name: 'Atualizado',
          description: undefined,
          price: 150,
          stock: undefined,
          isActive: undefined,
          categoryId: undefined,
          imageUrl: undefined,
          productType: undefined,
          instructions: undefined,
        },
      });
      expect(prisma.key.count).toHaveBeenCalledTimes(2);
      expect(prisma.account.count).toHaveBeenCalledTimes(2);
    });

    it('deve atualizar apenas campos fornecidos', async () => {
      const updateDto = { isActive: false };
      mockPrismaService.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: true });
      mockPrismaService.product.update.mockResolvedValue({ id: 'prod-1', isActive: false });

      await repository.update('prod-1', updateDto);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: {
          name: undefined,
          description: undefined,
          price: undefined,
          stock: undefined,
          isActive: false,
          categoryId: undefined,
          imageUrl: undefined,
          productType: undefined,
          instructions: undefined,
        },
      });
      expect(prisma.key.count).toHaveBeenCalledTimes(2);
      expect(prisma.account.count).toHaveBeenCalledTimes(2);
    });

    it('deve atualizar todos os campos quando fornecidos', async () => {
      const updateDto = {
        name: 'Completo',
        description: 'Nova descricao',
        price: 300,
        stock: 50,
        isActive: true,
        categoryId: 'cat-2',
        imageUrl: 'http://new.img',
      };
      mockPrismaService.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: false });
      mockPrismaService.key.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      mockPrismaService.account.count.mockResolvedValue(0);
      mockPrismaService.product.update.mockResolvedValue({ id: 'prod-1', ...updateDto });

      await repository.update('prod-1', updateDto);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: {
          name: 'Completo',
          description: 'Nova descricao',
          price: 300,
          stock: 50,
          isActive: true,
          categoryId: 'cat-2',
          imageUrl: 'http://new.img',
          productType: undefined,
          instructions: undefined,
        },
      });
    });

    it('deve sincronizar stock com keys disponiveis quando produto possui keys', async () => {
      const updateDto = { stock: 50, isActive: true };

      mockPrismaService.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: false });
      mockPrismaService.key.count
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(3);
      mockPrismaService.account.count.mockResolvedValue(0);
      mockPrismaService.product.update.mockResolvedValue({
        id: 'prod-1',
        ...updateDto,
        stock: 3,
      });

      await repository.update('prod-1', updateDto);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: {
          name: undefined,
          description: undefined,
          price: undefined,
          stock: 3,
          isActive: true,
          categoryId: undefined,
          imageUrl: undefined,
          productType: undefined,
          instructions: undefined,
        },
      });
    });

    it('deve sincronizar stock com accounts disponiveis quando produto possui accounts', async () => {
      const updateDto = { stock: 50, isActive: true };

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        productType: 'ACCOUNT',
        isActive: false,
      });
      mockPrismaService.key.count.mockResolvedValue(0);
      mockPrismaService.account.count
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(4);
      mockPrismaService.product.update.mockResolvedValue({
        id: 'prod-1',
        ...updateDto,
        stock: 4,
      });

      await repository.update('prod-1', updateDto);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: {
          name: undefined,
          description: undefined,
          price: undefined,
          stock: 4,
          isActive: true,
          categoryId: undefined,
          imageUrl: undefined,
          productType: undefined,
          instructions: undefined,
        },
      });
    });

    it('deve bloquear ativacao quando nao houver estoque disponivel do tipo KEY', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        productType: 'KEY',
        isActive: false,
      });
      mockPrismaService.key.count.mockResolvedValue(0);
      mockPrismaService.account.count.mockResolvedValue(0);

      await expect(repository.update('prod-1', { isActive: true })).rejects.toThrow(
        BadRequestException,
      );
      await expect(repository.update('prod-1', { isActive: true })).rejects.toThrow(
        'Cannot activate KEY product without available stock. Import at least one available key first.',
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });

  // ─── delete ───────────────────────────────────────────────────────
  describe('delete', () => {
    it('deve deletar um produto quando encontrado', async () => {
      const existingProduct = { id: 'prod-1', name: 'Para Deletar' };
      const deletedProduct = { id: 'prod-1', name: 'Para Deletar' };

      mockPrismaService.product.findUnique.mockResolvedValue(existingProduct);
      mockPrismaService.product.delete.mockResolvedValue(deletedProduct);

      const result = await repository.delete('prod-1');

      expect(result).toEqual(deletedProduct);
      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-1' } });
    });
  });

  // ─── findByCategory ───────────────────────────────────────────────
  describe('findByCategory', () => {
    it('deve retornar produtos de uma categoria com paginacao padrao', async () => {
      const products = [{ id: '1', name: 'Cat Produto', price: 10, category: { id: 'cat-1' } }];

      mockPrismaService.product.findMany.mockResolvedValue(products);
      mockPrismaService.product.count.mockResolvedValue(1);

      const result = await repository.findByCategory('cat-1');

      expect(result.data).toEqual(products);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: { categoryId: 'cat-1' },
        include: { category: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('deve retornar produtos com paginacao customizada', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(15);

      const result = await repository.findByCategory('cat-1', 2, 5);

      expect(result.meta).toEqual({
        total: 15,
        page: 2,
        limit: 5,
        totalPages: 3,
      });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });

    it('deve retornar lista vazia quando categoria nao tem produtos', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      const result = await repository.findByCategory('cat-vazia');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('deve executar findMany e count em paralelo', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await repository.findByCategory('cat-1');

      expect(prisma.product.findMany).toHaveBeenCalled();
      expect(prisma.product.count).toHaveBeenCalled();
    });
  });

  // ─── findByName ───────────────────────────────────────────────────
  describe('findByName', () => {
    it('deve retornar um produto quando encontrado por nome', async () => {
      const product = { id: 'prod-1', name: 'Produto Busca', price: 50 };

      mockPrismaService.product.findFirst.mockResolvedValue(product);

      const result = await repository.findByName('Produto Busca');

      expect(result).toEqual(product);
      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: 'Produto Busca',
            mode: 'insensitive',
          },
        },
      });
    });

    it('deve retornar null quando produto nao existe por nome', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);

      const result = await repository.findByName('Nao Existe');

      expect(result).toBeNull();
    });

    it('deve buscar com mode insensitive', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);

      await repository.findByName('qualquer nome');

      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: 'qualquer nome',
            mode: 'insensitive',
          },
        },
      });
    });
  });

  // ─── createMany ───────────────────────────────────────────────────
  describe('createMany', () => {
    it('deve criar multiplos produtos em batch', async () => {
      const products = [
        { name: 'Produto A', price: 10, stock: 5, isActive: true },
        { name: 'Produto B', price: 20, stock: 3, isActive: false },
        { name: 'Produto C', price: 30 },
      ];
      const result = { count: 3 };

      mockPrismaService.product.createMany.mockResolvedValue(result);

      const batchResult = await repository.createMany(products);

      expect(batchResult).toEqual(result);
      expect(prisma.product.createMany).toHaveBeenCalledWith({
        data: [
          {
            name: 'Produto A',
            description: undefined,
            price: 10,
            stock: 5,
            isActive: true,
            categoryId: undefined,
            imageUrl: undefined,
          },
          {
            name: 'Produto B',
            description: undefined,
            price: 20,
            stock: 3,
            isActive: false,
            categoryId: undefined,
            imageUrl: undefined,
          },
          {
            name: 'Produto C',
            description: undefined,
            price: 30,
            stock: 0,
            isActive: true,
            categoryId: undefined,
            imageUrl: undefined,
          },
        ],
      });
    });

    it('deve usar valores padrao para stock e isActive em createMany', async () => {
      const products = [{ name: 'Simples', price: 10 }];
      mockPrismaService.product.createMany.mockResolvedValue({ count: 1 });

      await repository.createMany(products);

      expect(prisma.product.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ stock: 0, isActive: true })],
      });
    });

    it('deve criar multiplos produtos com todos os campos', async () => {
      const products = [
        {
          name: 'Completo',
          description: 'Desc',
          price: 100,
          stock: 10,
          isActive: true,
          categoryId: 'cat-1',
          imageUrl: 'http://img.com',
        },
      ];
      mockPrismaService.product.createMany.mockResolvedValue({ count: 1 });

      await repository.createMany(products);

      expect(prisma.product.createMany).toHaveBeenCalledWith({
        data: [
          {
            name: 'Completo',
            description: 'Desc',
            price: 100,
            stock: 10,
            isActive: true,
            categoryId: 'cat-1',
            imageUrl: 'http://img.com',
          },
        ],
      });
    });

    it('deve retornar count zero para lista vazia', async () => {
      mockPrismaService.product.createMany.mockResolvedValue({ count: 0 });

      const result = await repository.createMany([]);

      expect(result.count).toBe(0);
      expect(prisma.product.createMany).toHaveBeenCalledWith({ data: [] });
    });
  });
});
