-- =============================================
-- LIMPIAR BASE DE DATOS PARA PRODUCCIÓN
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Eliminar todos los candidatos de prueba
DELETE FROM candidatos;

-- 2. Eliminar todas las respuestas
DELETE FROM respuestas;

-- 3. Eliminar todos los resultados
DELETE FROM resultados;

-- 4. Eliminar logs de actividad (opcional)
DELETE FROM logs_actividad;

-- 5. Resetear secuencias (si las hubiera)
-- No aplica para UUIDs

-- 6. Verificar limpieza
SELECT 'candidatos' as tabla, COUNT(*) as registros FROM candidatos
UNION ALL
SELECT 'respuestas' as tabla, COUNT(*) as registros FROM respuestas  
UNION ALL
SELECT 'resultados' as tabla, COUNT(*) as registros FROM resultados
UNION ALL
SELECT 'logs_actividad' as tabla, COUNT(*) as registros FROM logs_actividad;

-- =============================================
-- RESULTADO ESPERADO: Todas las tablas en 0
-- =============================================