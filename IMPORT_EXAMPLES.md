# Exemplos de Requisição para Importação CSV

## 1. Exemplo Básico com cURL

```bash
curl -X POST http://localhost:3000/products/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "csvContent": "XBOX,STEAM/PC\nCarimbo de data/hora,Nome do jogo,preço de venda\n07/12/2025 15:01:53,Final fantasy xvi(xbox-europa),R$200,00,17/12/2025 21:49:01,cuphead(steam-global),R$100,00"
  }'
```

## 2. Usando o Arquivo CSV de Exemplo

```bash
# Com autenticação
export JWT_TOKEN="seu-token-jwt-aqui"
./test-import-curl.sh ./exemplo-produtos.csv

# Sem autenticação (se aplicável)
./test-import-curl.sh ./exemplo-produtos.csv
```

## 3. Exemplo Completo com Todos os Dados

```bash
curl -X POST http://localhost:3000/products/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "csvContent": "XBOX,STEAM/PC,NINTENDO E-SHOP,PLAYSTATION\nCarimbo de data/hora,Nome do jogo,preço de venda,,Carimbo de data/hora,Nome do jogo,preço de venda,,Carimbo de data/hora,Nome do jogo,preço de venda,,Carimbo de data/hora,Nome do jogo,preço de venda\n07/12/2025 15:01:53,Final fantasy xvi(xbox-europa),R$200,00,,17/12/2025 21:49:01,cuphead(steam-global),R$100,00,,07/12/2025 15:08:55,Donkey kong bananza(nintendo switch 2-europa),R$400,00,,07/12/2025 15:03:27,Final fantasy xvi(playstation-europa),R$200,00\n06/12/2025 17:37:12,Forza horizon 5(xbox-conta),R$150,00,,10/12/2025 13:24:18,Star wars jedi survivor(steam-global),R$150,00"
  }'
```

## 4. Via JavaScript/Node.js

```javascript
const fs = require('fs');

async function importProducts() {
  const csvContent = fs.readFileSync('./exemplo-produtos.csv', 'utf-8');

  const response = await fetch('http://localhost:3000/products/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer SEU_TOKEN_JWT',
    },
    body: JSON.stringify({
      csvContent,
      isActive: true,
    }),
  });

  const result = await response.json();
  console.log('Importados:', result.imported);
  console.log('Falharam:', result.failed);
  console.log('Erros:', result.errors);
}

importProducts();
```

## 5. Via Python

```python
import requests
import json

csv_content = open('./exemplo-produtos.csv', 'r').read()

response = requests.post(
    'http://localhost:3000/products/import',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer SEU_TOKEN_JWT'
    },
    json={
        'csvContent': csv_content,
        'isActive': True
    }
)

result = response.json()
print(f"Importados: {result['imported']}")
print(f"Falharam: {result['failed']}")
if 'errors' in result:
    print(f"Erros: {result['errors']}")
```

## 6. Via PowerShell

```powershell
$csvContent = Get-Content -Path "./exemplo-produtos.csv" -Raw
$token = "SEU_TOKEN_JWT"

$response = Invoke-RestMethod -Uri "http://localhost:3000/products/import" `
  -Method Post `
  -Headers @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
  } `
  -Body (@{
    csvContent = $csvContent
    isActive = $true
  } | ConvertTo-Json)

Write-Host "Importados: $($response.imported)"
Write-Host "Falharam: $($response.failed)"
```

## 7. Teste Rápido (Sem Autenticação)

Se sua API não exigir autenticação para teste:

```bash
curl -X POST http://localhost:3000/products/import \
  -H "Content-Type: application/json" \
  -d '{
    "csvContent": "XBOX,STEAM/PC\nCarimbo de data/hora,Nome do jogo,preço de venda\n07/12/2025,Test Game(xbox-europa),R$100,00"
  }'
```

## 8. Via Swagger UI

1. Acesse: `http://localhost:3000/api/docs`
2. Procure por `POST /products/import`
3. Clique em "Try it out"
4. Preencha o corpo com:

```json
{
  "csvContent": "XBOX,STEAM/PC\nCarimbo de data/hora,Nome do jogo,preço de venda\n07/12/2025,Final fantasy xvi(xbox-europa),R$200,00",
  "isActive": true
}
```

5. Clique em "Execute"

## Formato Esperado da Resposta

```json
{
  "imported": 10,
  "failed": 0,
  "products": [
    {
      "id": "uuid-aqui",
      "name": "Final fantasy xvi (XBOX)",
      "price": 200.0,
      "stock": 1,
      "isActive": true,
      "createdAt": "2025-05-15T...",
      "updatedAt": "2025-05-15T..."
    }
  ],
  "errors": []
}
```

## Dicas

- Substitua `SEU_TOKEN_JWT` pelo seu token real
- O CSV deve estar no formato Google Sheets exportado
- Preços devem estar no formato brasileiro: `R$ 1.234,56`
- É possível especificar um `categoryId` para categorizar todos os produtos importados
