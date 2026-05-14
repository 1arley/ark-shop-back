# 🧹 Como Limpar Categorias Fantasmas

## Problema

Algumas categorias não podem ser deletadas porque o sistema detecta (incorretamente) que elas têm produtos ou subcategorias, mesmo quando não têm.

## Solução Aplicada

### 1. Melhorada a validação de exclusão

O novo código agora:

- ✅ Verifica diretamente no banco de dados (não usa cache)
- ✅ Fornece mensagem de erro detalhada
- ✅ Permite deletar forçadamente com `?force=true`

### 2. Como Deletar Categorias Fantasmas

#### Opção 1: Via API (Recomendado)

```bash
# Deletar categoria forçadamente (admin necessário)
DELETE https://ark-shop-back.onrender.com/api/categories/{id}?force=true
Authorization: Bearer {seu-token-admin}
```

#### Opção 2: Via SQL (Direto no banco)

```sql
-- 1. Identificar categorias órfãs
SELECT
    c.id,
    c.name,
    COUNT(p.id) as product_count,
    (SELECT COUNT(*) FROM "Category" c2 WHERE c2."parentId" = c.id) as children_count
FROM "Category" c
LEFT JOIN "Product" p ON p."categoryId" = c.id
WHERE c."parentId" IS NULL
GROUP BY c.id, c.name
HAVING COUNT(p.id) = 0
  AND (SELECT COUNT(*) FROM "Category" c2 WHERE c2."parentId" = c.id) = 0;

-- 2. Deletar categoria específica (substitua {id})
DELETE FROM "Category" WHERE id = '{id}';

-- 3. Deletar todas as categorias órfãs de uma vez
DELETE FROM "Category"
WHERE "parentId" IS NULL
  AND id NOT IN (
    SELECT DISTINCT "categoryId" FROM "Product" WHERE "categoryId" IS NOT NULL
  )
  AND id NOT IN (
    SELECT DISTINCT "parentId" FROM "Category" WHERE "parentId" IS NOT NULL
  );
```

### 3. Prevenir Problemas Futuros

#### No código frontend:

```javascript
// Antes de deletar, verifique se a categoria tem produtos
async function deleteCategory(id) {
  try {
    // Tenta deletar normalmente
    await api.delete(`/categories/${id}`);
  } catch (error) {
    if (error.response?.status === 400) {
      // Se falhar, pergunta se quer deletar forçadamente
      const confirm = window.confirm(
        'Esta categoria pode ter produtos ou subcategorias. Deseja deletar mesmo assim?',
      );
      if (confirm) {
        await api.delete(`/categories/${id}?force=true`);
      }
    } else {
      throw error;
    }
  }
}
```

### 4. Verificar o Status Atual

```bash
# Listar todas as categorias
curl https://ark-shop-back.onrender.com/api/categories

# Ver detalhes de uma categoria específica
curl https://ark-shop-back.onrender.com/api/categories/{id}
```

### 5. Endpoints Disponíveis

| Endpoint                                | Descrição                           |
| --------------------------------------- | ----------------------------------- |
| `GET /api/categories`                   | Lista todas as categorias           |
| `GET /api/categories/:id`               | Detalhes de uma categoria           |
| `DELETE /api/categories/:id?force=true` | Deleta forçadamente                 |
| `GET /api/categories/root`              | Apenas categorias de nível superior |

---

## Fluxo Recomendado

1. **Liste as categorias** → `GET /api/categories`
2. **Identifique as fantasmas** → Procure por categorias sem produtos reais
3. **Delete individualmente** → `DELETE /api/categories/{id}?force=true`
4. **Verifique o resultado** → `GET /api/categories` novamente

---

**Nota:** O parâmetro `force=true` deve ser usado apenas quando você tem certeza que a categoria não tem produtos importantes, pois ele ignora as validações de segurança.
