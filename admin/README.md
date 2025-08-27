# 📊 Dashboard Administrativo - Sistema de Evaluación Psicométrica

## ⚠️ IMPORTANTE: Estado Actual

Este dashboard está **diseñado y listo** pero **NO FUNCIONA** hasta que configures el backend.

### Por qué no funciona:
- ❌ **No hay base de datos** - Supabase no está configurado
- ❌ **No hay API** - Las funciones de Netlify no están desplegadas  
- ❌ **No hay datos** - Las tablas están vacías
- ❌ **Los enlaces son ejemplos** - Reportes y Configuración son placeholders

## 🔧 Para Activarlo

### Paso 1: Configurar Supabase (10 minutos)
```bash
1. Ir a supabase.com
2. Crear cuenta gratuita
3. Nuevo proyecto → Generar password
4. SQL Editor → Pegar contenido de database/schema.sql
5. Settings → API → Copiar URL y Keys
```

### Paso 2: Configurar Netlify (5 minutos)
```bash
1. Ir a netlify.com
2. Conectar este repositorio desde GitHub
3. Site Settings → Environment Variables:
   - SUPABASE_URL = tu_url
   - SUPABASE_ANON_KEY = tu_key
   - SUPABASE_SERVICE_KEY = tu_service_key
4. Deploy automático
```

### Paso 3: Instalar Dependencias
```bash
cd netlify/functions
npm init -y
npm install @supabase/supabase-js
git add . && git commit -m "Add dependencies"
git push
```

## 📄 Páginas del Dashboard

### 1. **dashboard.html** - Panel Principal
- Muestra estadísticas generales
- Gráficos de tendencias
- Evaluaciones recientes
- **Estado**: Vista estática (sin datos reales)

### 2. **candidatos.html** - Gestión de Candidatos  
- Lista completa con DataTables
- Filtros y búsqueda
- Exportación a Excel
- **Estado**: Tabla vacía (necesita API)

### 3. **resultado-detalle.html** - Vista de Resultados
- Desglose de puntajes
- Perfil DISC
- Recomendaciones
- **Estado**: Plantilla lista (sin datos)

### 4. **login.html** - Autenticación
- Formulario de acceso
- Modo oscuro funcional
- **Estado**: Visual completo (sin validación real)

## 🎨 Características Implementadas

✅ **Diseño Profesional**
- Framework Tabler 1.4.0
- Totalmente responsive
- Modo claro/oscuro

✅ **Componentes Listos**
- DataTables configurado
- ApexCharts para gráficos
- Modales y formularios

✅ **Estructura Completa**
- Navegación consistente
- Layouts preparados
- Estilos personalizados

## 🚫 Lo que NO Funciona

- **Generar Link**: Necesita base de datos
- **Ver Resultados**: Necesita API
- **Filtros**: Necesita datos
- **Exportar**: Necesita registros
- **Login**: Necesita autenticación

## 💡 Modo Demo

Para ver cómo funcionará con datos, puedes:

1. Abrir la consola del navegador (F12)
2. Ejecutar:
```javascript
// Simular datos de candidatos
const datos = [
  {nombre: "Juan Pérez", puesto: "Soldador", puntaje: 85, estado: "completado"},
  {nombre: "María García", puesto: "Electricista", puntaje: 72, estado: "completado"},
  // ... más datos
];
console.table(datos);
```

## 🎯 Cuando Esté Configurado

El dashboard podrá:
- ✅ Mostrar candidatos en tiempo real
- ✅ Generar links únicos por email
- ✅ Ver resultados detallados con scoring
- ✅ Exportar reportes en Excel/PDF
- ✅ Estadísticas actualizadas automáticamente
- ✅ Gestión completa de evaluaciones

## 📚 Recursos

- **Documentación Completa**: Ver `/SETUP.md`
- **Schema de BD**: Ver `/database/schema.sql`
- **API Endpoints**: Ver `/netlify/functions/`
- **Motor de Scoring**: Ver `/js/scoring-engine.js`

## 🆘 Ayuda

Si tienes problemas:
1. Revisa que hayas seguido todos los pasos de SETUP.md
2. Verifica las credenciales en Netlify
3. Revisa los logs en Netlify Functions
4. Asegúrate que las tablas se crearon en Supabase

---

**Recuerda**: Este es un sistema profesional completo. Solo necesita la configuración del backend para funcionar al 100%.