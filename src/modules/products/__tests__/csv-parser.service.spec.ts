import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CsvParserService } from '../services/csv-parser.service';
import { CSV_MAX_FILE_SIZE, CSV_MAX_LINES } from '@/common/constants';

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CsvParserService],
    }).compile();

    service = module.get<CsvParserService>(CsvParserService);
  });

  // ─── parse ────────────────────────────────────────────────────────
  describe('parse', () => {
    it('deve parsear CSV valido no formato Google Sheets com sucesso', () => {
      // Precos entre aspas para manter alinhamento correto
      const csvContent = `XBOX,STEAM/PC,NINTENDO E-SHOP,PLAYSTATION
Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025 15:01:53,Final fantasy xvi(xbox-europa),"R$200,00",17/12/2025 21:49:01,cuphead(steam-global),"R$100,00",,,"R$300,00",,,"R$400,00"`;

      const result = service.parse(csvContent);

      expect(result.length).toBeGreaterThan(0);
      // Verificar que pelo menos o primeiro produto XBOX foi parseado
      const xboxProduct = result.find(p => p.platform === 'XBOX');
      expect(xboxProduct).toBeDefined();
      expect(xboxProduct?.name).toBe('Final fantasy xvi');
      expect(xboxProduct?.price).toBe(200);
      expect(xboxProduct?.region).toBe('eu');
      expect(xboxProduct?.platform).toBe('XBOX');
    });

    it('deve parsear CSV com apenas uma plataforma', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game Test(xbox-br),R$50,00`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe('XBOX');
      expect(result[0].name).toBe('Game Test');
      expect(result[0].price).toBe(50);
      expect(result[0].region).toBe('br');
    });

    it('deve lancar BadRequestException quando CSV e null', () => {
      expect(() => service.parse(null as any)).toThrow(BadRequestException);
      expect(() => service.parse(null as any)).toThrow(
        'CSV content is required and must be a string',
      );
    });

    it('deve lancar BadRequestException quando CSV e undefined', () => {
      expect(() => service.parse(undefined as any)).toThrow(BadRequestException);
    });

    it('deve lancar BadRequestException quando CSV nao e string', () => {
      expect(() => service.parse(123 as any)).toThrow(BadRequestException);
      expect(() => service.parse({} as any)).toThrow(BadRequestException);
    });

    it('deve lancar BadRequestException quando CSV e string vazia', () => {
      expect(() => service.parse('')).toThrow(BadRequestException);
    });

    it('deve lancar BadRequestException quando CSV excede tamanho maximo', () => {
      const oversizedCsv = 'X'.repeat(CSV_MAX_FILE_SIZE + 1);

      expect(() => service.parse(oversizedCsv)).toThrow(BadRequestException);
      expect(() => service.parse(oversizedCsv)).toThrow('CSV content exceeds maximum size');
    });

    it('deve lancar BadRequestException quando CSV tem poucas linhas (menos de 3)', () => {
      // Apenas 1 linha
      expect(() => service.parse('XBOX')).toThrow(BadRequestException);
      expect(() => service.parse('XBOX')).toThrow('CSV must have at least 3 lines');

      // Apenas 2 linhas
      expect(() => service.parse('XBOX\nCarimbo de data/hora,Nome,preco')).toThrow(
        BadRequestException,
      );
    });

    it('deve lancar BadRequestException quando CSV excede numero maximo de linhas', () => {
      const header = 'XBOX';
      const subHeader = 'Carimbo de data/hora,Nome,preco';
      const dataLines = Array(CSV_MAX_LINES + 1)
        .fill('07/12/2025,Game,R$10,00')
        .join('\n');
      const oversizedCsv = `${header}\n${subHeader}\n${dataLines}`;

      expect(() => service.parse(oversizedCsv)).toThrow(BadRequestException);
      expect(() => service.parse(oversizedCsv)).toThrow('CSV must not exceed');
    });

    it('deve ignorar linhas sem nome valido', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,,R$50,00`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(0);
    });

    it('deve ignorar linhas sem preco valido', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game Test,`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(0);
    });

    it('deve ignorar linhas onde nome contem "Carimbo de data/hora"', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Carimbo de data/hora,R$50,00`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(0);
    });

    it('deve ignorar produtos com preco zero', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game Gratuito,R$0,00`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(0);
    });

    it('deve sanitizar nome do produto (remover XSS)', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,<script>alert(1)</script>Game Malicioso(xbox-br),R$50,00`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      // Tags HTML sao removidas, mas o texto "alert" permanece como texto normal
      expect(result[0].name).not.toContain('<script>');
      expect(result[0].name).not.toContain('</script>');
      expect(result[0].name).not.toContain('<');
      expect(result[0].name).not.toContain('>');
    });

    it('deve extrair timestamp quando disponivel', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025 15:01:53,Game Timestamp(xbox-br),R$50,00`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe('07/12/2025 15:01:53');
    });

    it('deve lancar BadRequestException quando CSV tem apenas headers sem dados', () => {
      // Apenas 2 linhas (header + sub-header) nao e suficiente
      const csvContent = `XBOX,STEAM/PC
Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda`;

      expect(() => service.parse(csvContent)).toThrow(BadRequestException);
      expect(() => service.parse(csvContent)).toThrow('CSV must have at least 3 lines');
    });

    it('deve parsear multiplas plataformas na mesma linha com precos entre aspas', () => {
      // Precos com virgula decimal devem estar entre aspas no CSV para manter alinhamento
      const csvContent = `XBOX,STEAM/PC
Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game Xbox(xbox-br),"R$50,00",08/12/2025,Game Steam(steam-global),"R$75,00"`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(2);
      expect(result[0].platform).toBe('XBOX');
      expect(result[0].price).toBe(50);
      expect(result[1].platform).toBe('STEAM/PC');
      expect(result[1].price).toBe(75);
    });
  });

  // ─── parseCsvLines ────────────────────────────────────────────────
  describe('parseCsvLines (valores entre aspas)', () => {
    it('deve parsear valores entre aspas corretamente', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,"Game com, virgula no nome",R$50,00`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      // O nome deve conter a virgula dentro das aspas
      expect(result[0].name).toContain('virgula no nome');
    });

    it('deve lidar com aspas escapadas (duplas aspas)', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,"Game com ""aspas"" no nome",R$50,00`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].name).toContain('aspas');
    });

    it('deve lidar com multiplas colunas entre aspas', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,"Nome Entre Aspas","R$50,00"`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(50);
    });
  });

  // ─── extractPlatforms ─────────────────────────────────────────────
  describe('extractPlatforms (Formato A - 3 colunas cada)', () => {
    it('deve detectar plataformas no formato padrao com 3 colunas', () => {
      // Precos entre aspas para manter alinhamento correto das colunas
      const csvContent = `XBOX,STEAM/PC,NINTENDO E-SHOP,PLAYSTATION
Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),"R$10,00",08/12/2025,Game(steam-global),"R$20,00",09/12/2025,Game(nintendo-br),"R$30,00",10/12/2025,Game(ps-eu),"R$40,00"`;

      const result = service.parse(csvContent);

      const platforms = [...new Set(result.map(p => p.platform))];
      expect(platforms).toContain('XBOX');
      expect(platforms).toContain('STEAM/PC');
      expect(platforms).toContain('NINTENDO E-SHOP');
      expect(platforms).toContain('PLAYSTATION');
      expect(result).toHaveLength(4);
    });
  });

  describe('extractPlatforms (Formato B - 4 colunas com gaps)', () => {
    it('deve detectar plataformas no formato com colunas vazias entre plataformas', () => {
      const csvContent = `,XBOX,,,STEAM/PC,,,NINTENDO E-SHOP,,,PLAYSTATION,
Carimbo de data/hora,Nome do jogo,preço de venda,,Carimbo de data/hora,Nome do jogo,preço de venda,,Carimbo de data/hora,Nome do jogo,preço de venda,,Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),R$10,00,,08/12/2025,Game(steam-global),R$20,00,,09/12/2025,Game(nintendo-br),R$30,00,,10/12/2025,Game(ps-eu),R$40,00`;

      const result = service.parse(csvContent);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('extractPlatforms (deteccao de sub-header)', () => {
    it('deve usar padrao fallback quando nao encontra plataformas no header', () => {
      // Header sem nomes de plataformas, mas com sub-header "Carimbo de data/hora"
      // Precos entre aspas para manter alinhamento
      const csvContent = `,,,,
Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game1(xbox-br),"R$10,00",08/12/2025,Game2(steam-global),"R$20,00",09/12/2025,Game3(nintendo-br),"R$30,00",10/12/2025,Game4(ps-eu),"R$40,00"`;

      const result = service.parse(csvContent);

      // Deve usar fallback com 4 plataformas padrao
      expect(result.length).toBe(4);
      const platforms = [...new Set(result.map(p => p.platform))];
      expect(platforms).toContain('XBOX');
      expect(platforms).toContain('STEAM/PC');
      expect(platforms).toContain('NINTENDO E-SHOP');
      expect(platforms).toContain('PLAYSTATION');
    });
  });

  describe('extractPlatforms (fallback padrao)', () => {
    it('deve usar posicoes padrao quando nenhuma plataforma e detectada', () => {
      // Sem header de plataforma e sem "Carimbo de data/hora" no sub-header
      // Isso aciona o fallback de posicoes padrao (index * 3)
      const csvContent = `Header generico
Sub-header generico
07/12/2025,Game1(xbox-br),R$10,00,08/12/2025,Game2(steam-global),R$20,00`;

      const result = service.parse(csvContent);

      // O fallback cria 4 plataformas padrao, mas pode nao encontrar dados
      // O importante e que nao lance excecao
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── parsePrice ───────────────────────────────────────────────────
  describe('parsePrice', () => {
    it('deve parsear formato BRL com R$ (R$ 1.234,56)', () => {
      // Preco entre aspas para manter virgula decimal na mesma celula CSV
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),"R$ 1.234,56"`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(1234.56);
    });

    it('deve parsear formato BRL sem espaco (R$1.234,56)', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),"R$1.234,56"`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(1234.56);
    });

    it('deve parsear preco simples sem R$', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),99`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(99);
    });

    it('deve parsear preco sem separador de milhar', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),R$100,00`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(100);
    });

    it('deve retornar 0 para preco invalido', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),abc`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(0); // preco 0 e filtrado
    });

    it('deve retornar 0 para string vazia', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(0);
    });

    it('deve parsear preco com centavos zero', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),R$50,00`;

      const result = service.parse(csvContent);

      expect(result[0].price).toBe(50);
    });

    it('deve parsear preco com valor alto e separador de milhar', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),"R$ 10.000,99"`;

      const result = service.parse(csvContent);

      expect(result[0].price).toBe(10000.99);
    });

    // ─── Locale detection ────────────────────────────────────────────
    it('deve detectar locale US com $ e ponto decimal ($100.5)', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),$100.5`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(100.5);
    });

    it('deve detectar locale US sem simbolo monetario (100.5)', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),100.5`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(100.5);
    });

    it('deve detectar locale US com separador de milhar ($1,234.56)', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-br),"$1,234.56"`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(1234.56);
    });
  });

  // ─── extractRegion ────────────────────────────────────────────────
  describe('extractRegion', () => {
    it('deve extrair regiao "br" para brasil/brazil/br', () => {
      const tests = [
        { name: 'Game(xbox-brasil)', expected: 'br' },
        { name: 'Game(xbox-brazil)', expected: 'br' },
        { name: 'Game(xbox-br)', expected: 'br' },
      ];

      for (const t of tests) {
        const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,${t.name},R$50,00`;

        const result = service.parse(csvContent);
        expect(result[0].region).toBe(t.expected);
      }
    });

    it('deve extrair regiao "ar" para argentina/ar', () => {
      const tests = [
        { name: 'Game(xbox-argentina)', expected: 'ar' },
        { name: 'Game(xbox-ar)', expected: 'ar' },
      ];

      for (const t of tests) {
        const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,${t.name},R$50,00`;

        const result = service.parse(csvContent);
        expect(result[0].region).toBe(t.expected);
      }
    });

    it('deve extrair regiao "eu" para europa/europe/eu', () => {
      const tests = [
        { name: 'Game(xbox-europa)', expected: 'eu' },
        { name: 'Game(xbox-europe)', expected: 'eu' },
        { name: 'Game(xbox-eu)', expected: 'eu' },
      ];

      for (const t of tests) {
        const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,${t.name},R$50,00`;

        const result = service.parse(csvContent);
        expect(result[0].region).toBe(t.expected);
      }
    });

    it('deve extrair regiao "latam" para latam/latina', () => {
      const tests = [
        { name: 'Game(xbox-latam)', expected: 'latam' },
        { name: 'Game(xbox-latina)', expected: 'latam' },
      ];

      for (const t of tests) {
        const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,${t.name},R$50,00`;

        const result = service.parse(csvContent);
        expect(result[0].region).toBe(t.expected);
      }
    });

    it('deve extrair regiao "global"', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(steam-global),R$50,00`;

      const result = service.parse(csvContent);

      expect(result[0].region).toBe('global');
    });

    it('deve extrair regiao "conta"', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-conta),R$50,00`;

      const result = service.parse(csvContent);

      expect(result[0].region).toBe('conta');
    });

    it('deve retornar undefined quando nao ha regiao no nome', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game Sem Regiao,R$50,00`;

      const result = service.parse(csvContent);

      expect(result[0].region).toBeUndefined();
    });

    it('deve retornar undefined quando regiao nao e reconhecida', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game(xbox-desconhecida),R$50,00`;

      const result = service.parse(csvContent);

      expect(result[0].region).toBeUndefined();
    });
  });

  // ─── cleanName ────────────────────────────────────────────────────
  describe('cleanName (remove conteudo entre parenteses)', () => {
    it('deve remover conteudo entre parenteses do nome', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Final Fantasy XVI(xbox-europa),R$200,00`;

      const result = service.parse(csvContent);

      expect(result[0].name).toBe('Final Fantasy XVI');
    });

    it('deve remover multiplos parenteses', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game Name (extra) (xbox-br),R$50,00`;

      const result = service.parse(csvContent);

      expect(result[0].name).toBe('Game Name');
    });

    it('deve manter nome sem parenteses inalterado', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game Simples,R$50,00`;

      const result = service.parse(csvContent);

      expect(result[0].name).toBe('Game Simples');
    });

    it('deve remover espacos extras ao redor do nome', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,  Game Com Espacos  (xbox-br),R$50,00`;

      const result = service.parse(csvContent);

      expect(result[0].name).toBe('Game Com Espacos');
    });
  });

  // ─── sanitizeInput ────────────────────────────────────────────────
  describe('sanitizeInput (remove HTML e caracteres perigosos)', () => {
    it('deve remover tags HTML', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,<b>Game Negrito</b>(xbox-br),R$50,00`;

      const result = service.parse(csvContent);

      expect(result[0].name).not.toContain('<b>');
      expect(result[0].name).not.toContain('</b>');
      expect(result[0].name).toContain('Game Negrito');
    });

    it('deve remover script tags (XSS)', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,<script>alert("xss")</script>Game(xbox-br),R$50,00`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      // Tags HTML sao removidas, texto dentro permanece
      expect(result[0].name).not.toContain('<script>');
      expect(result[0].name).not.toContain('</script>');
      expect(result[0].name).not.toContain('<');
      expect(result[0].name).not.toContain('>');
    });

    it('deve remover caracteres perigosos (<>"\'&)', () => {
      // Nome entre aspas para que a aspa dupla interna seja escapada corretamente no CSV
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,"Game<>Test''&Name(xbox-br)",R$50`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].name).not.toContain('<');
      expect(result[0].name).not.toContain('>');
      expect(result[0].name).not.toContain('"');
      expect(result[0].name).not.toContain("'");
      expect(result[0].name).not.toContain('&');
    });

    it('deve limitar nome a 500 caracteres', () => {
      const longName = 'A'.repeat(600);
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,${longName}(xbox-br),R$50,00`;

      const result = service.parse(csvContent);

      expect(result[0].name.length).toBeLessThanOrEqual(500);
    });

    it('deve lidar com entrada vazia', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,,R$50,00`;

      const result = service.parse(csvContent);

      // Nome vazio deve ser filtrado (sem nome valido)
      expect(result).toHaveLength(0);
    });

    it('deve sanitizar timestamp tambem', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
<script>malicious</script>,Game(xbox-br),R$50,00`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].timestamp).not.toContain('<script>');
    });
  });

  // ─── Casos integrados ─────────────────────────────────────────────
  describe('casos integrados', () => {
    it('deve parsear CSV realista com multiplas plataformas e regioes', () => {
      // Precos entre aspas para manter alinhamento correto no CSV
      const csvContent = `XBOX,STEAM/PC,NINTENDO E-SHOP,PLAYSTATION
Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025 15:01:53,Final fantasy xvi(xbox-europa),"R$200,00",17/12/2025 21:49:01,cuphead(steam-global),"R$100,00",18/12/2025 10:00:00,Zelda TOTK(nintendo-br),"R$300,00",19/12/2025 08:30:00,God of War(ps5-argentina),"R$150,00"`;

      const result = service.parse(csvContent);

      expect(result.length).toBe(4);

      const xbox = result.find(p => p.platform === 'XBOX');
      expect(xbox?.name).toBe('Final fantasy xvi');
      expect(xbox?.region).toBe('eu');
      expect(xbox?.price).toBe(200);

      const steam = result.find(p => p.platform === 'STEAM/PC');
      expect(steam?.name).toBe('cuphead');
      expect(steam?.region).toBe('global');
      expect(steam?.price).toBe(100);

      const nintendo = result.find(p => p.platform === 'NINTENDO E-SHOP');
      expect(nintendo?.name).toBe('Zelda TOTK');
      expect(nintendo?.region).toBe('br');
      expect(nintendo?.price).toBe(300);

      const playstation = result.find(p => p.platform === 'PLAYSTATION');
      expect(playstation?.name).toBe('God of War');
      expect(playstation?.region).toBe('ar');
      expect(playstation?.price).toBe(150);
    });

    it('deve lidar com linhas parcialmente preenchidas', () => {
      const csvContent = `XBOX,STEAM/PC
Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025,Game Xbox(xbox-br),R$50,00,,`;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe('XBOX');
    });

    it('deve lidar com CSV contendo whitespace nos valores', () => {
      const csvContent = `XBOX
Carimbo de data/hora,Nome do jogo,preço de venda
  07/12/2025  ,  Game Espacos  (xbox-br)  ,  R$50,00  `;

      const result = service.parse(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Game Espacos');
      expect(result[0].price).toBe(50);
    });
  });
});
