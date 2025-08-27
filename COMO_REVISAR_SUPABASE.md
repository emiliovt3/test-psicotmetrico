# 🔍 Cómo Revisar un Proyecto Existente en Supabase

## Pasos para Identificar tu Proyecto

### 1. **Acceder al Dashboard de Supabase**
- Ve a [app.supabase.com](https://app.supabase.com)
- Inicia sesión
- Verás tu proyecto en la lista

### 2. **Revisar la Base de Datos**

#### Opción A: Ver las Tablas (Más Rápido)
1. Click en tu proyecto
2. En el menú lateral, click en **Table Editor** (icono de tabla)
3. Revisa qué tablas existen:
   - Si ves tablas como `users`, `posts`, `comments` → Es un blog/red social
   - Si ves `products`, `orders`, `customers` → Es un e-commerce
   - Si ves `tasks`, `projects` → Es un gestor de tareas
   - Si está vacío → Proyecto nuevo sin usar

#### Opción B: SQL Editor
1. Ve a **SQL Editor** en el menú lateral
2. Ejecuta esta consulta para ver todas las tablas:
```sql
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

3. Para ver el contenido de una tabla específica:
```sql
-- Reemplaza 'nombre_tabla' con el nombre real
SELECT * FROM nombre_tabla LIMIT 10;
```

### 3. **Revisar la Actividad**
1. Ve a **Database → Backups**
   - Verás la fecha del último backup
   - Si es muy antigua, probablemente no se usa

2. Ve a **Settings → Usage**
   - Revisa el uso de almacenamiento
   - Revisa las llamadas a la API
   - Si todo está en 0 o muy bajo, no se está usando

### 4. **Revisar la Configuración**
1. Ve a **Authentication → Users**
   - Si hay usuarios registrados, revisa sus emails
   - Esto te dará pistas del proyecto

2. Ve a **Storage → Buckets**
   - Si hay buckets con nombres específicos
   - Revisa qué tipo de archivos contienen

### 5. **Revisar las API Keys**
1. Ve a **Settings → API**
2. Copia el **Project URL** (algo como: `https://abcdefg.supabase.co`)
3. Búscalo en tu computadora:

#### En Windows:
```powershell
# Buscar en todos los archivos de tu PC
findstr /s /i "abcdefg.supabase.co" C:\Users\TU_USUARIO\*.*
```

#### O busca en tus repositorios de GitHub:
- Ve a GitHub
- Usa la búsqueda global
- Busca: `"abcdefg.supabase.co"`

## 🎯 Señales de que es un Proyecto de Test Psicométrico

Si encuentras estas tablas, ES ESTE PROYECTO:
- `candidatos`
- `respuestas`
- `resultados`
- `configuracion`
- `logs_actividad`

## 🚨 Antes de Borrar

### Hacer Backup (Por si acaso)
1. Ve a **Settings → Database**
2. Click en **Download Backup**
3. Guarda el archivo .sql

### Exportar Datos Importantes
```sql
-- Exportar todos los datos de una tabla
COPY (SELECT * FROM nombre_tabla) 
TO '/tmp/datos.csv' 
WITH CSV HEADER;
```

## 💡 Si Decides Usarlo para Este Proyecto

### Opción 1: Limpiar y Reutilizar
```sql
-- CUIDADO: Esto borrará TODO
-- Borrar todas las tablas existentes
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Luego ejecutar el schema.sql de este proyecto
```

### Opción 2: Crear Proyecto Nuevo
- Es más seguro crear uno nuevo si no estás seguro
- Supabase permite 2 proyectos gratis

## 📝 Documentar para el Futuro

Crea un archivo en la raíz de cada proyecto:
```markdown
# SUPABASE_INFO.md
- **Proyecto**: Nombre del proyecto
- **URL**: https://xxxxx.supabase.co
- **Propósito**: Para qué es este proyecto
- **Fecha**: Cuándo lo creaste
- **Estado**: Activo/Inactivo/Prueba
```

---

**Tip**: Si el proyecto tiene menos de 1MB de datos y no tiene actividad en los últimos 30 días, probablemente es seguro borrarlo.