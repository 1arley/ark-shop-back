# 🚀 Guia Rápido: Importação de Produtos via CSV

## ✅ Implementação Concluída

Sua aplicação agora suporta importação em massa de produtos a partir de arquivos CSV do Google Sheets!

---

## 📁 O Que Foi Criado

| Arquivo                                               | Descrição                        |
| ----------------------------------------------------- | -------------------------------- |
| `src/modules/products/services/csv-parser.service.ts` | Serviço de parse de CSV          |
| `src/modules/products/dto/import-products.dto.ts`     | DTO da importação                |
| `src/modules/products/products.controller.ts`         | Endpoint `POST /products/import` |
| `src/modules/products/products.service.ts`            | Lógica de importação             |
| `src/modules/products/products.module.ts`             | Módulo atualizado                |
| `exemplo-produtos.csv`                                | Arquivo de exemplo               |
| `test-import-curl.sh`                                 | Script de teste                  |
| `IMPORTACAO_CSV.md`                                   | Documentação completa            |
| `IMPORT_EXAMPLES.md`                                  | Exemplos de uso                  |

---

## 🎯 Como Usar (Passo a Passo)

### Opção 1: Via Swagger (Mais Fácil)

1. Acesse: `http://localhost:3000/api/docs`
2. Procure: `POST /products/import`
3. Clique em "Try it out"
4. Preencha:

```json
{
  "csvContent": "XBOX,STEAM/PC\nCarimbo de data/hora,Nome do jogo,preço de venda\n07/12/2025,Final fantasy xvi(xbox-europa),R$200,00"
}
```

5. Execute!

### Opção 2: Via cURL (Linha de Comando)

```bash
# Copie e cole no terminal (ajuste o token)
curl -X POST http://localhost:3000/products/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"csvContent":"XBOX,STEAM/PC\nCarimbo de data/hora,Nome do jogo,preço de venda\n07/12/2025,Final fantasy xvi(xbox-europa),R$200,00"}'
```

### Opção 3: Usando o Script Pronto

```bash
# 1. Exporte o token (opcional, se tiver autenticação)
export JWT_TOKEN="seu-token-aqui"

# 2. Rode o script
./test-import-curl.sh ./exemplo-produtos.csv
```

---

## 📊 Formato do CSV

Seu CSV deve ter este formato (exportado do Google Sheets):

```csv
XBOX,STEAM/PC,NINTENDO E-SHOP,PLAYSTATION
Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda,...
07/12/2025 15:01:53,Final fantasy xvi(xbox-europa),R$200,00,17/12/2025 21:49:01,cuphead(steam-global),R$100,00
```

### O Sistema Reconhece:

- ✅ **Plataformas**: XBOX, STEAM/PC, NINTENDO E-SHOP, PLAYSTATION
- ✅ **Preços**: R$200,00 | R$ 200,00 | 200,00
- ✅ **Regiões**: (xbox-europa) → eu, (steam-global) → global, etc.
- ✅ **Nomes**: Remove automaticamente os parênteses do nome final

---

## 📝 Exemplo de Resposta

```json
{
  "imported": 2,
  "failed": 0,
  "products": [
    {
      "id": "abc-123",
      "name": "Final fantasy xvi (XBOX)",
      "price": 200.0,
      "stock": 1,
      "isActive": true
    },
    {
      "id": "def-456",
      "name": "cuphead (STEAM/PC)",
      "price": 100.0,
      "stock": 1,
      "isActive": true
    }
  ],
  "errors": []
}
```

---

## 🔧 Testes Rápidos

### Teste 1: Importar 1 produto

```bash
curl -X POST http://localhost:3000/products/import \
  -H "Content-Type: application/json" \
  -d '{"csvContent":"XBOX\nCarimbo de data/hora,Nome do jogo,preço de venda\n07/12/2025,Test Game,R$50,00"}'
```

### Teste 2: Usar arquivo real

```bash
./test-import-curl.sh ./exemplo-produtos.csv
```

### Teste 3: Ver no Swagger

Acesse: http://localhost:3000/api/docs

---

## ⚠️ Possíveis Erros

| Erro                             | Causa             | Solução                     |
| -------------------------------- | ----------------- | --------------------------- |
| `401 Unauthorized`               | Token inválido    | Verifique o token JWT       |
| `400 Bad Request`                | CSV mal formatado | Use o formato Google Sheets |
| `CSV must have at least 3 lines` | CSV vazio         | Adicione cabeçalho e dados  |
| `Price must be positive`         | Preço inválido    | Use formato R$ 1.234,56     |

---

## 🎉 Funcionalidades

- ✅ Importação em massa de produtos
- ✅ Múltiplas plataformas (XBOX, STEAM, NINTENDO, PLAYSTATION)
- ✅ Extração automática de região
- ✅ Conversão de preços (R$)
- ✅ Tratamento de erros individual
- ✅ Documentação Swagger
- ✅ Tests unitários
- ✅ Suporte a categorias

---

## 📚 Próximos Passos Sugeridos

1. **Testar com dados reais**: Use o arquivo `exemplo-produtos.csv`
2. **Validar no banco**: Verifique os produtos criados
3. **Criar categoria**: Adicione um `categoryId` se necessário
4. **Automatizar**: Crie um script de importação recorrente

---

## 📞 Precisa de Ajuda?

- 📖 Doc completa: `IMPORTACAO_CSV.md`
- 💡 Exemplos: `IMPORT_EXAMPLES.md`
- 🧪 Testes: `src/modules/products/__tests__/products.service.spec.ts`

---

**Status**: ✅ Implementado e testado com sucesso!
