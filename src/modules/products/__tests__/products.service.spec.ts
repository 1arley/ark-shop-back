import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ProductsService } from '../products.service';
import { ProductsRepository } from '../products.repository';
import { CsvParserService } from '../services/csv-parser.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let productsRepository: ProductsRepository;
  let _csvParser: CsvParserService;
  let prisma: PrismaService;

  const mockProductsRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findByCategory: jest.fn(),
    findByName: jest.fn(),
    createMany: jest.fn(),
  };

  const mockCsvParser = {
    parse: jest.fn(),
  };

  const mockPrisma = {
    category: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: mockProductsRepository },
        { provide: CsvParserService, useValue: mockCsvParser },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    // Silenciar logs durante os testes
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    service = module.get<ProductsService>(ProductsService);
    productsRepository = module.get<ProductsRepository>(ProductsRepository);
    csvParser = module.get<CsvParserService>(CsvParserService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  // ─── create ───────────────────────────────────────────────────────
  describe('create', () => {
    it('deve criar um produto com sucesso e delegar ao repositorio', async () => {
      const createDto = {
        name: 'Produto Teste',
        price: 99.9,
        description: 'Descricao do produto',
        stock: 5,
        isActive: true,
        categoryId: 'cat-uuid',
      };
      const createdProduct = {
        id: 'prod-1',
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockProductsRepository.create.mockResolvedValue(createdProduct);

      const result = await service.create(createDto);

      expect(result).toEqual(createdProduct);
      expect(productsRepository.create).toHaveBeenCalledWith(createDto);
      expect(productsRepository.create).toHaveBeenCalledTimes(1);
    });

    it('deve criar produto com campos opcionais undefined', async () => {
      const createDto = { name: 'Simples', price: 10 };
      const created = {
        id: 'prod-2',
        ...createDto,
        stock: 0,
        isActive: true,
        createdAt: new Date(),
      };

      mockProductsRepository.create.mockResolvedValue(created);

      const result = await service.create(createDto);

      expect(result).toEqual(created);
      expect(productsRepository.create).toHaveBeenCalledWith(createDto);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────
  describe('findAll', () => {
    it('deve retornar produtos paginados sem filtros', async () => {
      const expected = {
        data: [{ id: '1', name: 'Produto A', price: 10 }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockProductsRepository.findAll.mockResolvedValue(expected);

      const result = await service.findAll(1, 10);

      expect(result).toEqual(expected);
      expect(productsRepository.findAll).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('deve retornar produtos com filtro isActive', async () => {
      const expected = {
        data: [{ id: '1', name: 'Ativo', price: 10, isActive: true }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockProductsRepository.findAll.mockResolvedValue(expected);

      const result = await service.findAll(1, 10, { isActive: true });

      expect(result).toEqual(expected);
      expect(productsRepository.findAll).toHaveBeenCalledWith(1, 10, { isActive: true });
    });

    it('deve retornar produtos com filtro categoryId', async () => {
      const expected = {
        data: [{ id: '1', name: 'Cat Produto', price: 10, categoryId: 'cat-1' }],
        meta: { total: 1, page: 2, limit: 5, totalPages: 1 },
      };
      mockProductsRepository.findAll.mockResolvedValue(expected);

      const result = await service.findAll(2, 5, { categoryId: 'cat-1' });

      expect(result).toEqual(expected);
      expect(productsRepository.findAll).toHaveBeenCalledWith(2, 5, { categoryId: 'cat-1' });
    });

    it('deve retornar produtos com filtro search', async () => {
      const expected = {
        data: [{ id: '1', name: 'Resultado Busca', price: 10 }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockProductsRepository.findAll.mockResolvedValue(expected);

      const result = await service.findAll(1, 10, { search: 'busca' });

      expect(result).toEqual(expected);
      expect(productsRepository.findAll).toHaveBeenCalledWith(1, 10, { search: 'busca' });
    });

    it('deve retornar produtos com todos os filtros combinados', async () => {
      const expected = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      mockProductsRepository.findAll.mockResolvedValue(expected);

      const result = await service.findAll(1, 10, {
        isActive: false,
        categoryId: 'cat-1',
        search: 'teste',
      });

      expect(result).toEqual(expected);
      expect(productsRepository.findAll).toHaveBeenCalledWith(1, 10, {
        isActive: false,
        categoryId: 'cat-1',
        search: 'teste',
      });
    });

    it('deve retornar lista vazia quando nenhum produto existe', async () => {
      const expected = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      mockProductsRepository.findAll.mockResolvedValue(expected);

      const result = await service.findAll(1, 10);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────
  describe('findOne', () => {
    it('deve retornar um produto pelo ID', async () => {
      const product = { id: 'prod-1', name: 'Produto', price: 50, category: { id: 'cat-1' } };
      mockProductsRepository.findById.mockResolvedValue(product);

      const result = await service.findOne('prod-1');

      expect(result).toEqual(product);
      expect(productsRepository.findById).toHaveBeenCalledWith('prod-1');
    });

    it('deve lancar NotFoundException quando produto nao existe', async () => {
      mockProductsRepository.findById.mockRejectedValue(
        new NotFoundException('Product with ID invalid not found'),
      );

      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('invalid')).rejects.toThrow('Product with ID invalid not found');
    });
  });

  // ─── update ───────────────────────────────────────────────────────
  describe('update', () => {
    it('deve atualizar um produto com sucesso', async () => {
      const updateDto = { name: 'Nome Atualizado', price: 150 };
      const updated = { id: 'prod-1', ...updateDto, updatedAt: new Date() };
      mockProductsRepository.update.mockResolvedValue(updated);

      const result = await service.update('prod-1', updateDto);

      expect(result).toEqual(updated);
      expect(productsRepository.update).toHaveBeenCalledWith('prod-1', updateDto);
    });

    it('deve lancar NotFoundException quando produto nao existe para atualizacao', async () => {
      mockProductsRepository.update.mockRejectedValue(
        new NotFoundException('Product with ID nao-existe not found'),
      );

      await expect(service.update('nao-existe', { name: 'Novo' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve atualizar parcialmente apenas campos fornecidos', async () => {
      const updateDto = { isActive: false };
      const updated = { id: 'prod-1', isActive: false, updatedAt: new Date() };
      mockProductsRepository.update.mockResolvedValue(updated);

      const result = await service.update('prod-1', updateDto);

      expect(result).toEqual(updated);
      expect(productsRepository.update).toHaveBeenCalledWith('prod-1', { isActive: false });
    });
  });

  // ─── delete ───────────────────────────────────────────────────────
  describe('delete', () => {
    it('deve deletar um produto com sucesso', async () => {
      const deleted = { id: 'prod-1', name: 'Deletado' };
      mockProductsRepository.delete.mockResolvedValue(deleted);

      const result = await service.delete('prod-1');

      expect(result).toEqual(deleted);
      expect(productsRepository.delete).toHaveBeenCalledWith('prod-1');
    });

    it('deve lancar NotFoundException quando produto nao existe para delecao', async () => {
      mockProductsRepository.delete.mockRejectedValue(
        new NotFoundException('Product with ID deletar not found'),
      );

      await expect(service.delete('deletar')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByCategory ───────────────────────────────────────────────
  describe('findByCategory', () => {
    it('deve retornar produtos de uma categoria com paginacao padrao', async () => {
      const expected = {
        data: [{ id: '1', name: 'Cat Item', price: 20, category: { id: 'cat-1' } }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockProductsRepository.findByCategory.mockResolvedValue(expected);

      const result = await service.findByCategory('cat-1');

      expect(result).toEqual(expected);
      expect(productsRepository.findByCategory).toHaveBeenCalledWith('cat-1', 1, 10);
    });

    it('deve retornar produtos com paginacao customizada', async () => {
      const expected = {
        data: [{ id: '1', name: 'Item', price: 20 }],
        meta: { total: 5, page: 2, limit: 3, totalPages: 2 },
      };
      mockProductsRepository.findByCategory.mockResolvedValue(expected);

      const result = await service.findByCategory('cat-1', 2, 3);

      expect(result).toEqual(expected);
      expect(productsRepository.findByCategory).toHaveBeenCalledWith('cat-1', 2, 3);
    });

    it('deve retornar lista vazia quando categoria nao tem produtos', async () => {
      const expected = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      mockProductsRepository.findByCategory.mockResolvedValue(expected);

      const result = await service.findByCategory('cat-vazia');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  // ─── importFromCsv ────────────────────────────────────────────────
  describe('importFromCsv', () => {
    const csvContent =
      'XBOX,STEAM/PC\nCarimbo de data/hora,Nome do jogo,preço de venda\n07/12/2025,Game,R$100,00';

    it('deve importar produtos com sucesso a partir de CSV valido', async () => {
      const parsedProducts = [{ name: 'Game', price: 100, platform: 'XBOX', region: 'eu' }];
      const createdProduct = { id: 'new-1', name: 'Game (XBOX)', price: 100 };

      mockCsvParser.parse.mockReturnValue(parsedProducts);
      mockProductsRepository.findByName.mockResolvedValue(null);
      mockProductsRepository.create.mockResolvedValue(createdProduct);

      const result = await service.importFromCsv(csvContent);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.products).toHaveLength(1);
      expect(result.products[0]).toEqual(createdProduct);
      expect(result.errors).toBeUndefined();
      expect(result.skippedProducts).toBeUndefined();
      expect(productsRepository.create).toHaveBeenCalledWith({
        name: 'Game (XBOX)',
        description: expect.stringContaining('Platform: XBOX'),
        price: 100,
        stock: 0,
        isActive: true,
        categoryId: undefined,
      });
    });

    it('deve importar com categoria e isActive customizados', async () => {
      const parsedProducts = [{ name: 'Game', price: 50, platform: 'STEAM/PC' }];
      const createdProduct = { id: 'new-2', name: 'Game (STEAM/PC)', price: 50 };

      mockCsvParser.parse.mockReturnValue(parsedProducts);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Games' });
      mockProductsRepository.findByName.mockResolvedValue(null);
      mockProductsRepository.create.mockResolvedValue(createdProduct);

      const result = await service.importFromCsv(csvContent, {
        categoryId: 'cat-1',
        isActive: false,
      });

      expect(result.imported).toBe(1);
      expect(productsRepository.create).toHaveBeenCalledWith({
        name: 'Game (STEAM/PC)',
        description: expect.stringContaining('Platform: STEAM/PC'),
        price: 50,
        stock: 0,
        isActive: false,
        categoryId: 'cat-1',
      });
    });

    it('deve lancar BadRequestException quando categoria nao existe', async () => {
      mockCsvParser.parse.mockReturnValue([]);
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.importFromCsv(csvContent, { categoryId: 'cat-inexistente' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.importFromCsv(csvContent, { categoryId: 'cat-inexistente' }),
      ).rejects.toThrow('Category with ID "cat-inexistente" not found');
      expect(productsRepository.create).not.toHaveBeenCalled();
    });

    it('nao deve validar categoria quando categoryId nao e fornecido', async () => {
      mockCsvParser.parse.mockReturnValue([]);

      const result = await service.importFromCsv(csvContent);

      expect(prisma.category.findUnique).not.toHaveBeenCalled();
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('deve pular produtos duplicados', async () => {
      const parsedProducts = [{ name: 'Game Duplicado', price: 100, platform: 'XBOX' }];
      const existingProduct = { id: 'existing-1', name: 'Game Duplicado (XBOX)', price: 100 };

      mockCsvParser.parse.mockReturnValue(parsedProducts);
      mockProductsRepository.findByName.mockResolvedValue(existingProduct);

      const result = await service.importFromCsv(csvContent);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.skippedProducts).toBeDefined();
      expect(result.skippedProducts).toHaveLength(1);
      expect(result.skippedProducts![0]).toContain('already exists');
      expect(productsRepository.create).not.toHaveBeenCalled();
    });

    it('deve lidar com erros de importacao graciosamente', async () => {
      const parsedProducts = [{ name: 'Game com Erro', price: 100, platform: 'XBOX' }];

      mockCsvParser.parse.mockReturnValue(parsedProducts);
      mockProductsRepository.findByName.mockResolvedValue(null);
      mockProductsRepository.create.mockRejectedValue(new Error('Erro no banco de dados'));

      const result = await service.importFromCsv(csvContent);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('Failed to import');
      expect(result.errors![0]).toContain('Erro no banco de dados');
    });

    it('deve processar resultados mistos (importados, pulados, falhas)', async () => {
      const parsedProducts = [
        { name: 'Game A', price: 100, platform: 'XBOX' },
        { name: 'Game B', price: 200, platform: 'STEAM/PC' },
        { name: 'Game C', price: 300, platform: 'PLAYSTATION' },
      ];

      mockCsvParser.parse.mockReturnValue(parsedProducts);

      // Game A: importado com sucesso
      // Game B: duplicado
      // Game C: falha
      mockProductsRepository.findByName
        .mockResolvedValueOnce(null) // Game A - nao existe
        .mockResolvedValueOnce({ id: 'exist-1' }) // Game B - existe
        .mockResolvedValueOnce(null); // Game C - nao existe

      mockProductsRepository.create
        .mockResolvedValueOnce({ id: 'new-a', name: 'Game A (XBOX)' }) // Game A - sucesso
        .mockRejectedValueOnce(new Error('Falha ao criar')); // Game C - falha

      const result = await service.importFromCsv(csvContent);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.products).toHaveLength(1);
      expect(result.skippedProducts).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });

    it('deve lidar com CSV vazio (nenhum produto parseado)', async () => {
      mockCsvParser.parse.mockReturnValue([]);

      const result = await service.importFromCsv(csvContent);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.products).toEqual([]);
      expect(result.errors).toBeUndefined();
      expect(result.skippedProducts).toBeUndefined();
    });

    it('deve processar em batches quando ha muitos produtos', async () => {
      // Criar 120 produtos para testar batch de 50
      const parsedProducts = Array.from({ length: 120 }, (_, i) => ({
        name: `Game ${i}`,
        price: i + 1,
        platform: 'XBOX',
      }));

      mockCsvParser.parse.mockReturnValue(parsedProducts);
      mockProductsRepository.findByName.mockResolvedValue(null);
      mockProductsRepository.create.mockResolvedValue({ id: 'new', name: 'Game' });

      const result = await service.importFromCsv(csvContent);

      expect(result.imported).toBe(120);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      // 120 produtos / batch de 50 = 3 batches (50 + 50 + 20)
      expect(productsRepository.findByName).toHaveBeenCalledTimes(120);
      expect(productsRepository.create).toHaveBeenCalledTimes(120);
    });

    it('deve incluir regiao na descricao quando disponivel', async () => {
      const parsedProducts = [
        { name: 'Game Regional', price: 100, platform: 'XBOX', region: 'eu' },
      ];

      mockCsvParser.parse.mockReturnValue(parsedProducts);
      mockProductsRepository.findByName.mockResolvedValue(null);
      mockProductsRepository.create.mockResolvedValue({ id: 'new', name: 'Game Regional (XBOX)' });

      await service.importFromCsv(csvContent);

      expect(productsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('Region: eu'),
        }),
      );
    });

    it('deve usar isActive true como padrao quando nao especificado', async () => {
      const parsedProducts = [{ name: 'Game', price: 100, platform: 'XBOX' }];

      mockCsvParser.parse.mockReturnValue(parsedProducts);
      mockProductsRepository.findByName.mockResolvedValue(null);
      mockProductsRepository.create.mockResolvedValue({ id: 'new' });

      await service.importFromCsv(csvContent);

      expect(productsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });

    it('deve lancar erro quando csvParser lancar excecao', async () => {
      mockCsvParser.parse.mockImplementation(() => {
        throw new BadRequestException('CSV invalido');
      });

      await expect(service.importFromCsv(csvContent)).rejects.toThrow(BadRequestException);
    });
  });
});
