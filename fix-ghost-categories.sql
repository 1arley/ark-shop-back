-- ============================================
-- DIAGNÓSTICO E LIMPEZA DE CATEGORIAS FANTASMAS
-- ============================================

-- 1. Verificar todas as categorias e seus relacionamentos
SELECT 
    c.id,
    c.name,
    c.description,
    c."parentId",
    c."createdAt",
    COUNT(p.id) as product_count,
    (SELECT COUNT(*) FROM "Category" c2 WHERE c2."parentId" = c.id) as subcategory_count
FROM "Category" c
LEFT JOIN "Product" p ON p."categoryId" = c.id
GROUP BY c.id, c.name, c.description, c."parentId", c."createdAt"
ORDER BY c."createdAt" DESC;

-- 2. Verificar categorias órfãs (sem pai e sem produtos)
SELECT 
    c.id,
    c.name,
    c."parentId",
    c."createdAt",
    COUNT(p.id) as product_count,
    (SELECT COUNT(*) FROM "Category" c2 WHERE c2."parentId" = c.id) as children_count
FROM "Category" c
LEFT JOIN "Product" p ON p."categoryId" = c.id
WHERE c."parentId" IS NULL
GROUP BY c.id, c.name, c."parentId", c."createdAt"
HAVING COUNT(p.id) = 0 AND (SELECT COUNT(*) FROM "Category" c2 WHERE c2."parentId" = c.id) = 0;

-- 3. Verificar categorias com produtos fantasmas
SELECT 
    c.id,
    c.name,
    COUNT(p.id) as product_count
FROM "Category" c
LEFT JOIN "Product" p ON p."categoryId" = c.id
GROUP BY c.id, c.name
HAVING COUNT(p.id) > 0;

-- 4. Verificar produtos com categoria inválida
SELECT 
    p.id,
    p.name,
    p."categoryId",
    c.id as category_exists
FROM "Product" p
LEFT JOIN "Category" c ON c.id = p."categoryId"
WHERE c.id IS NULL;

-- 5. Deletar categorias órfãs (sem produtos e sem filhos)
-- ATENÇÃO: Use com cuidado!
-- DELETE FROM "Category" 
-- WHERE "parentId" IS NULL 
--   AND id NOT IN (SELECT DISTINCT "categoryId" FROM "Product")
--   AND id NOT IN (SELECT DISTINCT "parentId" FROM "Category" WHERE "parentId" IS NOT NULL);

-- 6. Atualizar produtos para remover categoria inválida
-- UPDATE "Product" SET "categoryId" = NULL WHERE "categoryId" = 'categoria-id-aqui';

-- 7. Deletar categoria específica (se tiver certeza que não tem produtos)
-- DELETE FROM "Category" WHERE id = 'categoria-id-aqui';

-- 8. Verificar hierarquia de categorias
SELECT 
    c.id,
    c.name,
    c."parentId",
    p.name as parent_name,
    (SELECT COUNT(*) FROM "Category" c2 WHERE c2."parentId" = c.id) as children_count
FROM "Category" c
LEFT JOIN "Category" p ON p.id = c."parentId"
ORDER BY c."parentId", c.name;
