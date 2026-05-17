import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from '../categories.service';
import { CategoriesRepository } from '../categories.repository';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repository: CategoriesRepository;

  const mockCategoriesRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findRootCategories: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: CategoriesRepository, useValue: mockCategoriesRepository },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    repository = module.get<CategoriesRepository>(CategoriesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar categoria com sucesso', async () => {
      const createDto = {
        name: 'Games',
        description: 'Video games category',
      };

      const createdCategory = {
        id: 'cat-1',
        name: 'Games',
        description: 'Video games category',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCategoriesRepository.create.mockResolvedValue(createdCategory);

      const result = await service.create(createDto);

      expect(result).toEqual(createdCategory);
      expect(repository.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findById', () => {
    it('deve encontrar categoria por ID', async () => {
      const category = {
        id: 'cat-1',
        name: 'Games',
        description: 'Video games category',
        parentId: null,
        parent: null,
        children: [],
        products: [],
        _count: { products: 0, children: 0 },
      };

      mockCategoriesRepository.findById.mockResolvedValue(category);

      const result = await service.findById('cat-1');

      expect(result).toEqual(category);
      expect(repository.findById).toHaveBeenCalledWith('cat-1');
    });

    it('deve retornar null se categoria não existir', async () => {
      mockCategoriesRepository.findById.mockResolvedValue(null);

      const result = await service.findById('cat-999');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('deve listar todas as categorias', async () => {
      const categories = [
        { id: '1', name: 'Games', parent: null, children: [], _count: { products: 5 } },
        { id: '2', name: 'Electronics', parent: null, children: [], _count: { products: 3 } },
      ];

      mockCategoriesRepository.findAll.mockResolvedValue(categories);

      const result = await service.findAll();

      expect(result).toEqual(categories);
      expect(repository.findAll).toHaveBeenCalled();
    });
  });

  describe('findRootCategories', () => {
    it('deve retornar apenas categorias raiz', async () => {
      const rootCategories = [
        { id: '1', name: 'Games', children: [], _count: { products: 5 } },
        { id: '2', name: 'Electronics', children: [], _count: { products: 3 } },
      ];

      mockCategoriesRepository.findRootCategories.mockResolvedValue(rootCategories);

      const result = await service.findRootCategories();

      expect(result).toEqual(rootCategories);
      expect(repository.findRootCategories).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('deve atualizar categoria com sucesso', async () => {
      const updateDto = { name: 'Updated Games' };
      const updatedCategory = {
        id: 'cat-1',
        name: 'Updated Games',
        description: 'Updated description',
        parentId: null,
        parent: null,
        children: [],
      };

      mockCategoriesRepository.update.mockResolvedValue(updatedCategory);

      const result = await service.update('cat-1', updateDto);

      expect(result).toEqual(updatedCategory);
      expect(repository.update).toHaveBeenCalledWith('cat-1', updateDto);
    });
  });

  describe('delete', () => {
    it('deve deletar categoria com force=true', async () => {
      mockCategoriesRepository.delete.mockResolvedValue({ id: 'cat-1' });

      const result = await service.delete('cat-1', true);

      expect(result).toEqual({ id: 'cat-1' });
      expect(repository.delete).toHaveBeenCalledWith('cat-1', true);
    });

    it('deve deletar categoria sem force (padrão)', async () => {
      mockCategoriesRepository.delete.mockResolvedValue({ id: 'cat-1' });

      const result = await service.delete('cat-1');

      expect(result).toEqual({ id: 'cat-1' });
      expect(repository.delete).toHaveBeenCalledWith('cat-1', false);
    });
  });
});
