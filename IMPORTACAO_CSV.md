# Importação de Produtos via CSV

## Visão Geral

O sistema agora suporta importação em massa de produtos a partir de arquivos CSV exportados do Google Sheets. O formato é específico para tabelas de preços de jogos por plataforma.

## Formato do CSV

O CSV deve seguir o formato exportado do Google Sheets com as seguintes colunas:

```
XBOX,STEAM/PC,NINTENDO E-SHOP,PLAYSTATION
Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda,...
07/12/2025 15:01:53,Final fantasy xvi(xbox-europa),R$200,00,17/12/2025 21:49:01,cuphead(steam-global),R$100,00
```

### Estrutura

- **Linha 1**: Nomes das plataformas (XBOX, STEAM/PC, NINTENDO E-SHOP, PLAYSTATION)
- **Linha 2**: Cabeçalhos das colunas (Carimbo de data/hora, Nome do jogo, preço de venda)
- **Linhas subsequentes**: Dados dos produtos

### Formatos de Preço Suportados

- `R$200,00`
- `R$ 200,00`
- `R$1.200,00`
- `200,00`

### Regiões Suportadas

O sistema extrai automaticamente a região do nome do jogo se estiver entre parênteses:

- `br` - Brasil/Brazil
- `ar` - Argentina
- `eu` - Europa
- `latam` - América Latina
- `global` - Global
- `conta` - Conta

## Como Usar

### 1. Exportar CSV do Google Sheets

1. Abra sua planilha no Google Sheets
2. Vá em `Arquivo` → `Fazer download` → `Valores separados por vírgula (.csv)`
3. Salve o arquivo CSV

### 2. Importar via API

**Endpoint:** `POST /products/import`

**Headers:**

```
Authorization: Bearer <seu-token-jwt>
Content-Type: application/json
```

**Body:**

```json
{
  "csvContent": "XBOX,STEAM/PC,NINTENDO E-SHOP\nCarimbo de data/hora,Nome do jogo,preço de venda\n07/12/2025 15:01:53,Final fantasy xvi(xbox-europa),R$200,00",
  "categoryId": "uuid-da-categoria-opcional",
  "isActive": true
}
```

### 3. Resposta da API

```json
{
  "imported": 10,
  "failed": 0,
  "products": [
    {
      "id": "uuid",
      "name": "Final fantasy xvi (XBOX)",
      "price": 200.0,
      "stock": 1,
      "isActive": true,
      "categoryId": null,
      "createdAt": "2025-05-15T...",
      "updatedAt": "2025-05-15T..."
    }
  ],
  "errors": []
}
```

## Exemplo de Uso com cURL

```bash
curl -X POST http://localhost:3000/products/import \
  -H "Authorization: Bearer seu-token-aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "csvContent": "XBOX,STEAM/PC\nCarimbo de data/hora,Nome do jogo,preço de venda\n07/12/2025 15:01:53,Final fantasy xvi(xbox-europa),R$200,00,17/12/2025 21:49:01,cuphead(steam-global),R$100,00"
  }'
```

## Exemplo de Uso com JavaScript/TypeScript

```typescript
async function importProducts(csvContent: string) {
  const response = await fetch('/products/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      csvContent,
      categoryId: 'uuid-da-categoria', // opcional
      isActive: true,
    }),
  });

  const result = await response.json();
  console.log(`Importados: ${result.imported}, Falharam: ${result.failed}`);

  if (result.errors) {
    console.error('Erros:', result.errors);
  }
}
```

## Tratamento de Erros

O sistema retorna um array de erros para produtos que falharem na importação:

```json
{
  "imported": 8,
  "failed": 2,
  "products": [...],
  "errors": [
    "Failed to import \"Jogo inválido\": Price must be a positive number",
    "Failed to import \"Outro jogo\": Name is required"
  ]
}
```

## Notas Importantes

1. **Nomes de Produtos**: O sistema remove automaticamente informações entre parênteses do nome base e as adiciona como descrição.

2. **Plataforma**: Cada produto importado terá o nome da plataforma adicionado ao final, ex: `Final fantasy xvi (XBOX)`.

3. **Estoque**: Todos os produtos importados recebem estoque inicial de 1 unidade.

4. **Descrição**: Uma descrição automática é gerada com informações sobre plataforma e região.

5. **Categorias**: Se um `categoryId` for fornecido, todos os produtos importados serão associados a essa categoria.

## Arquivos Criados

- `src/modules/products/dto/import-products.dto.ts` - DTO para importação
- `src/modules/products/services/csv-parser.service.ts` - Serviço de parse de CSV
- `src/modules/products/products.service.ts` - Atualizado com método `importFromCsv`
- `src/modules/products/products.repository.ts` - Atualizado com método `createMany`
- `src/modules/products/products.controller.ts` - Atualizado com endpoint `POST /products/import`
- `src/modules/products/products.module.ts` - Atualizado com `CsvParserService`
