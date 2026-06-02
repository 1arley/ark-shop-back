import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsController } from '../products.controller';
import { ProductsService } from '../products.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let productsService: ProductsService;

  const mockProductsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findByCategory: jest.fn(),
    importFromCsv: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockProductsService }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    productsService = module.get<ProductsService>(ProductsService);

    jest.clearAllMocks();
  });

  it('deve estar definido', () => {
    expect(controller).toBeDefined();
  });

  // ─── create ───────────────────────────────────────────────────────
  describe('create', () => {
    it('deve criar um produto com sucesso (admin)', async () => {
      const createDto = { name: 'Novo Produto', price: 99.9 };
      const createdProduct = { id: 'prod-1', ...createDto, createdAt: new Date() };

      mockProductsService.create.mockResolvedValue(createdProduct);

      const result = await controller.create(createDto);

      expect(result).toEqual(createdProduct);
      expect(productsService.create).toHaveBeenCalledWith(createDto);
    });

    it('deve delegar ao service com todos os campos', async () => {
      const createDto = {
        name: 'Completo',
        price: 50,
        description: 'Desc',
        stock: 10,
        isActive: true,
        categoryId: 'cat-1',
        imageUrl: 'http://img.com',
      };
      const created = { id: 'prod-2', ...createDto };

      mockProductsService.create.mockResolvedValue(created);

      await controller.create(createDto);

      expect(productsService.create).toHaveBeenCalledWith(createDto);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────
  describe('findAll', () => {
    it('deve retornar produtos com parametros padrao', async () => {
      const expected = {
        data: [{ id: '1', name: 'Produto' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockProductsService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(1, 10, undefined, undefined, undefined);

      expect(result).toEqual(expected);
      expect(productsService.findAll).toHaveBeenCalledWith(1, 10, {
        isActive: undefined,
        categoryId: undefined,
        search: undefined,
      });
    });

    it('deve retornar produtos com page e limit customizados', async () => {
      const expected = {
        data: [],
        meta: { total: 0, page: 3, limit: 25, totalPages: 0 },
      };
      mockProductsService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(3, 25, undefined, undefined, undefined);

      expect(result).toEqual(expected);
      expect(productsService.findAll).toHaveBeenCalledWith(3, 25, {
        isActive: undefined,
        categoryId: undefined,
        search: undefined,
      });
    });

    it('deve filtrar por isActive=true', async () => {
      mockProductsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await controller.findAll(1, 10, 'true', undefined, undefined);

      expect(productsService.findAll).toHaveBeenCalledWith(1, 10, {
        isActive: true,
        categoryId: undefined,
        search: undefined,
      });
    });

    it('deve filtrar por isActive=false', async () => {
      mockProductsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await controller.findAll(1, 10, 'false', undefined, undefined);

      expect(productsService.findAll).toHaveBeenCalledWith(1, 10, {
        isActive: false,
        categoryId: undefined,
        search: undefined,
      });
    });

    it('deve filtrar por categoryId', async () => {
      mockProductsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await controller.findAll(1, 10, undefined, 'cat-uuid', undefined);

      expect(productsService.findAll).toHaveBeenCalledWith(1, 10, {
        isActive: undefined,
        categoryId: 'cat-uuid',
        search: undefined,
      });
    });

    it('deve filtrar por search', async () => {
      mockProductsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await controller.findAll(1, 10, undefined, undefined, 'termo busca');

      expect(productsService.findAll).toHaveBeenCalledWith(1, 10, {
        isActive: undefined,
        categoryId: undefined,
        search: 'termo busca',
      });
    });

    it('deve aplicar todos os filtros simultaneamente', async () => {
      mockProductsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await controller.findAll(2, 20, 'true', 'cat-1', 'pesquisa');

      expect(productsService.findAll).toHaveBeenCalledWith(2, 20, {
        isActive: true,
        categoryId: 'cat-1',
        search: 'pesquisa',
      });
    });

    it('deve tratar isActive como undefined quando string vazia', async () => {
      mockProductsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      // Quando isActive nao e fornecido como query param, chega como undefined
      await controller.findAll(1, 10, undefined, undefined, undefined);

      expect(productsService.findAll).toHaveBeenCalledWith(1, 10, {
        isActive: undefined,
        categoryId: undefined,
        search: undefined,
      });
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────
  describe('findOne', () => {
    it('deve retornar um produto pelo ID', async () => {
      const product = { id: 'prod-1', name: 'Produto', price: 50 };
      mockProductsService.findOne.mockResolvedValue(product);

      const result = await controller.findOne('prod-1');

      expect(result).toEqual(product);
      expect(productsService.findOne).toHaveBeenCalledWith('prod-1');
    });

    it('deve lancar NotFoundException quando produto nao existe', async () => {
      mockProductsService.findOne.mockRejectedValue(
        new NotFoundException('Product with ID nao-existe not found'),
      );

      await expect(controller.findOne('nao-existe')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────
  describe('update', () => {
    it('deve atualizar um produto com sucesso (admin)', async () => {
      const updateDto = { name: 'Atualizado', price: 200 };
      const updated = { id: 'prod-1', ...updateDto };
      mockProductsService.update.mockResolvedValue(updated);

      const result = await controller.update('prod-1', updateDto);

      expect(result).toEqual(updated);
      expect(productsService.update).toHaveBeenCalledWith('prod-1', updateDto);
    });

    it('deve atualizar parcialmente', async () => {
      const updateDto = { isActive: false };
      const updated = { id: 'prod-1', isActive: false };
      mockProductsService.update.mockResolvedValue(updated);

      const result = await controller.update('prod-1', updateDto);

      expect(result).toEqual(updated);
      expect(productsService.update).toHaveBeenCalledWith('prod-1', { isActive: false });
    });

    it('deve lancar NotFoundException quando produto nao existe', async () => {
      mockProductsService.update.mockRejectedValue(
        new NotFoundException('Product with ID nao-existe not found'),
      );

      await expect(controller.update('nao-existe', { name: 'Novo' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── remove (delete) ──────────────────────────────────────────────
  describe('remove', () => {
    it('deve deletar um produto com sucesso (admin)', async () => {
      const deleted = { id: 'prod-1', name: 'Deletado' };
      mockProductsService.delete.mockResolvedValue(deleted);

      const result = await controller.remove('prod-1');

      expect(result).toEqual(deleted);
      expect(productsService.delete).toHaveBeenCalledWith('prod-1');
    });

    it('deve lancar NotFoundException quando produto nao existe', async () => {
      mockProductsService.delete.mockRejectedValue(
        new NotFoundException('Product with ID deletar not found'),
      );

      await expect(controller.remove('deletar')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── importFromCsv (body-based) ───────────────────────────────────
  describe('importFromCsv', () => {
    it('deve importar produtos via CSV content no body', async () => {
      const body = {
        csvContent: 'XBOX\nCarimbo de data/hora,Nome,preco\n07/12/2025,Game,R$100,00',
        categoryId: 'cat-1',
        isActive: true,
      };
      const importResult = {
        imported: 1,
        skipped: 0,
        failed: 0,
        products: [{ id: 'new-1' }],
      };
      mockProductsService.importFromCsv.mockResolvedValue(importResult);

      const result = await controller.importFromCsv(body);

      expect(result).toEqual(importResult);
      expect(productsService.importFromCsv).toHaveBeenCalledWith(body.csvContent, {
        categoryId: 'cat-1',
        isActive: true,
      });
    });

    it('deve lancar BadRequestException quando csvContent nao e fornecido', async () => {
      const body = { categoryId: 'cat-1' };

      await expect(controller.importFromCsv(body as any)).rejects.toThrow(BadRequestException);
      await expect(controller.importFromCsv(body as any)).rejects.toThrow(
        'CSV content is required',
      );
      expect(productsService.importFromCsv).not.toHaveBeenCalled();
    });

    it('deve importar sem categoryId e isActive opcionais', async () => {
      const body = { csvContent: 'XBOX\nCarimbo de data/hora,Nome,preco\ndata,Game,R$50,00' };
      mockProductsService.importFromCsv.mockResolvedValue({
        imported: 1,
        skipped: 0,
        failed: 0,
        products: [],
      });

      await controller.importFromCsv(body);

      expect(productsService.importFromCsv).toHaveBeenCalledWith(body.csvContent, {
        categoryId: undefined,
        isActive: undefined,
      });
    });
  });

  // ─── importFromCsvFile (file upload) ──────────────────────────────
  describe('importFromCsvFile', () => {
    it('deve importar produtos a partir de upload de arquivo CSV', async () => {
      const csvBuffer = Buffer.from(
        'XBOX\nCarimbo de data/hora,Nome,preco\n07/12/2025,Game,R$100,00',
      );
      const file = {
        originalname: 'produtos.csv',
        buffer: csvBuffer,
        mimetype: 'text/csv',
        size: csvBuffer.length,
      } as Express.Multer.File;

      const body = { categoryId: 'cat-1', isActive: false };
      const importResult = { imported: 1, skipped: 0, failed: 0, products: [] };
      mockProductsService.importFromCsv.mockResolvedValue(importResult);

      const result = await controller.importFromCsvFile(file, body);

      expect(result).toEqual(importResult);
      expect(productsService.importFromCsv).toHaveBeenCalledWith(
        'XBOX\nCarimbo de data/hora,Nome,preco\n07/12/2025,Game,R$100,00',
        { categoryId: 'cat-1', isActive: false },
      );
    });

    it('deve lancar BadRequestException quando arquivo nao e fornecido', async () => {
      await expect(controller.importFromCsvFile(null as any, {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.importFromCsvFile(null as any, {})).rejects.toThrow(
        'CSV file is required',
      );
      expect(productsService.importFromCsv).not.toHaveBeenCalled();
    });

    it('deve lancar BadRequestException quando tipo de arquivo nao e CSV', async () => {
      const file = {
        originalname: 'produtos.xlsx',
        buffer: Buffer.from('data'),
        mimetype: 'application/vnd.ms-excel',
        size: 100,
      } as Express.Multer.File;

      await expect(controller.importFromCsvFile(file, {})).rejects.toThrow(BadRequestException);
      await expect(controller.importFromCsvFile(file, {})).rejects.toThrow(
        'Only CSV files are allowed',
      );
      expect(productsService.importFromCsv).not.toHaveBeenCalled();
    });

    it('deve lancar BadRequestException quando arquivo CSV esta vazio', async () => {
      const file = {
        originalname: 'vazio.csv',
        buffer: Buffer.from(''),
        mimetype: 'text/csv',
        size: 0,
      } as Express.Multer.File;

      await expect(controller.importFromCsvFile(file, {})).rejects.toThrow(BadRequestException);
      await expect(controller.importFromCsvFile(file, {})).rejects.toThrow('CSV file is empty');
      expect(productsService.importFromCsv).not.toHaveBeenCalled();
    });

    it('deve lancar BadRequestException quando arquivo contem apenas espacos', async () => {
      const file = {
        originalname: 'espacos.csv',
        buffer: Buffer.from('   \n  \t  '),
        mimetype: 'text/csv',
        size: 10,
      } as Express.Multer.File;

      await expect(controller.importFromCsvFile(file, {})).rejects.toThrow(BadRequestException);
      await expect(controller.importFromCsvFile(file, {})).rejects.toThrow('CSV file is empty');
    });

    it('deve aceitar arquivo com extensao .CSV maiuscula', async () => {
      const csvBuffer = Buffer.from('XBOX\nCarimbo de data/hora,Nome,preco\ndata,Game,R$10,00');
      const file = {
        originalname: 'produtos.CSV',
        buffer: csvBuffer,
        mimetype: 'text/csv',
        size: csvBuffer.length,
      } as Express.Multer.File;

      mockProductsService.importFromCsv.mockResolvedValue({
        imported: 1,
        skipped: 0,
        failed: 0,
        products: [],
      });

      const result = await controller.importFromCsvFile(file, {});

      expect(result).toBeDefined();
      expect(productsService.importFromCsv).toHaveBeenCalled();
    });

    it('deve rejeitar arquivo .txt', async () => {
      const file = {
        originalname: 'dados.txt',
        buffer: Buffer.from('data'),
        mimetype: 'text/plain',
        size: 10,
      } as Express.Multer.File;

      await expect(controller.importFromCsvFile(file, {})).rejects.toThrow(
        'Only CSV files are allowed',
      );
    });

    it('deve rejeitar arquivo .json', async () => {
      const file = {
        originalname: 'dados.json',
        buffer: Buffer.from('{}'),
        mimetype: 'application/json',
        size: 10,
      } as Express.Multer.File;

      await expect(controller.importFromCsvFile(file, {})).rejects.toThrow(
        'Only CSV files are allowed',
      );
    });

    it('deve importar sem body params opcionais', async () => {
      const csvBuffer = Buffer.from('XBOX\nCarimbo de data/hora,Nome,preco\ndata,Game,R$10,00');
      const file = {
        originalname: 'produtos.csv',
        buffer: csvBuffer,
        mimetype: 'text/csv',
        size: csvBuffer.length,
      } as Express.Multer.File;

      mockProductsService.importFromCsv.mockResolvedValue({
        imported: 1,
        skipped: 0,
        failed: 0,
        products: [],
      });

      await controller.importFromCsvFile(file, {});

      expect(productsService.importFromCsv).toHaveBeenCalledWith(expect.any(String), {
        categoryId: undefined,
        isActive: undefined,
      });
    });
  });
});
