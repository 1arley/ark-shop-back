import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from '../categories.controller';
import { CategoriesService } from '../categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: CategoriesService;

  const mockCategoriesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findRootCategories: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: mockCategoriesService }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create (admin only)', () => {
    it('deve criar categoria', async () => {
      const createDto = { name: 'Games', description: 'Video games' };
      const createdCategory = {
        id: 'cat-1',
        name: 'Games',
        description: 'Video games',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCategoriesService.create.mockResolvedValue(createdCategory);

      const result = await controller.create(createDto);

      expect(result).toEqual(createdCategory);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll (público)', () => {
    it('deve listar todas as categorias', async () => {
      const categories = [
        { id: '1', name: 'Games', parent: null, children: [], _count: { products: 5 } },
        { id: '2', name: 'Electronics', parent: null, children: [], _count: { products: 3 } },
      ];

      mockCategoriesService.findAll.mockResolvedValue(categories);

      const result = await controller.findAll();

      expect(result).toEqual(categories);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne (público)', () => {
    it('deve buscar categoria por ID', async () => {
      const category = {
        id: 'cat-1',
        name: 'Games',
        parent: null,
        children: [],
        products: [],
        _count: { products: 5, children: 2 },
      };

      mockCategoriesService.findById.mockResolvedValue(category);

      const result = await controller.findOne('cat-1');

      expect(result).toEqual(category);
      expect(service.findById).toHaveBeenCalledWith('cat-1');
    });
  });

  describe('findRoot (público)', () => {
    it('deve retornar categorias raiz', async () => {
      const rootCategories = [{ id: '1', name: 'Games', children: [], _count: { products: 5 } }];

      mockCategoriesService.findRootCategories.mockResolvedValue(rootCategories);

      const result = await controller.findRoot();

      expect(result).toEqual(rootCategories);
      expect(service.findRootCategories).toHaveBeenCalled();
    });
  });

  describe('update (admin only)', () => {
    it('deve atualizar categoria', async () => {
      const updateDto = { name: 'Updated Games' };
      const updatedCategory = {
        id: 'cat-1',
        name: 'Updated Games',
        parent: null,
        children: [],
      };

      mockCategoriesService.update.mockResolvedValue(updatedCategory);

      const result = await controller.update('cat-1', updateDto);

      expect(result).toEqual(updatedCategory);
      expect(service.update).toHaveBeenCalledWith('cat-1', updateDto);
    });
  });

  describe('delete (admin only)', () => {
    it('deve deletar categoria sem force', async () => {
      mockCategoriesService.delete.mockResolvedValue({ id: 'cat-1' });

      const result = await controller.remove('cat-1');

      expect(result).toEqual({ id: 'cat-1' });
      expect(service.delete).toHaveBeenCalledWith('cat-1', false);
    });

    it('deve deletar categoria com force=true', async () => {
      mockCategoriesService.delete.mockResolvedValue({ id: 'cat-1' });

      const result = await controller.remove('cat-1', 'true');

      expect(result).toEqual({ id: 'cat-1' });
      expect(service.delete).toHaveBeenCalledWith('cat-1', true);
    });

    it('deve tratar force como false para qualquer outro valor', async () => {
      mockCategoriesService.delete.mockResolvedValue({ id: 'cat-1' });

      await controller.remove('cat-1', 'false');

      expect(service.delete).toHaveBeenCalledWith('cat-1', false);
    });
  });
});
