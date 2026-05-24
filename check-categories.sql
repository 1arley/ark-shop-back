-- Verificar todas as categorias e seus produtos
SELECT 
    c.id,
    c.name,
    c.description,
    c."parentId",
    COUNT(p.id) as product_count,
    (SELECT COUNT(*) FROM "Category" c2 WHERE c2."parentId" = c.id) as subcategory_count
FROM "Category" c
LEFT JOIN "Product" p ON p."categoryId" = c.id
GROUP BY c.id, c.name, c.description, c."parentId"
ORDER BY c."createdAt" DESC;
