# 🚀 Guía de Configuración - Sistema de Evaluación Psicométrica

## 📋 Pre-requisitos

1. Cuenta en [Supabase](https://supabase.com) (gratis)
2. Cuenta en [Netlify](https://netlify.com) (gratis)
3. Este repositorio en GitHub

## 🔧 Paso 1: Configurar Supabase

### 1.1 Crear Proyecto
1. Ir a [app.supabase.com](https://app.supabase.com)
2. Click en "New Project"
3. Configurar:
   - **Name**: `test-psicometrico` (o el nombre que prefieras)
   - **Database Password**: Generar una contraseña fuerte (guárdala!)
   - **Region**: Seleccionar la más cercana
   - **Pricing Plan**: Free tier es suficiente para empezar

### 1.2 Configurar Base de Datos
1. Una vez creado el proyecto, ir a **SQL Editor**
2. Click en "New Query"
3. Copiar todo el contenido de `database/schema.sql`
4. Pegar y ejecutar (Click en "Run")
5. Deberías ver mensaje de éxito con todas las tablas creadas

### 1.3 Obtener Credenciales
1. Ir a **Settings → API**
2. Copiar estos valores (los necesitarás para Netlify):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Public Key**: `eyJhbGciOiJI...` (clave larga)
   - **Service Role Key**: `eyJhbGciOiJI...` (clave larga - MANTENER SECRETA)

## 🌐 Paso 2: Configurar Netlify

### 2.1 Conectar Repositorio
1. Ir a [app.netlify.com](https://app.netlify.com)
2. Click en "Add new site" → "Import an existing project"
3. Seleccionar "GitHub"
4. Autorizar y seleccionar este repositorio
5. Configuración de build:
   - **Build command**: (dejar vacío)
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`

### 2.2 Configurar Variables de Entorno
1. Ir a **Site settings → Environment variables**
2. Agregar las siguientes variables:

```bash
SUPABASE_URL = "https://xxxxx.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJI..."
SUPABASE_SERVICE_KEY = "eyJhbGciOiJI..."
```

### 2.3 Instalar Dependencias de Functions
1. En tu terminal local, ejecutar:
```bash
cd netlify/functions
npm init -y
npm install @supabase/supabase-js
```

2. Commit y push los cambios:
```bash
git add .
git commit -m "Add Netlify functions dependencies"
git push
```

### 2.4 Deploy
1. Netlify detectará el push y desplegará automáticamente
2. Esperar ~2 minutos para el deploy
3. Tu sitio estará en: `https://tu-sitio.netlify.app`

## 🔗 Paso 3: Actualizar Frontend

### 3.1 Configurar URLs en el Frontend
Editar `test/index-tabler.html` y actualizar las URLs de API:

```javascript
// Buscar y reemplazar estas líneas:
const API_BASE_URL = 'https://tu-sitio.netlify.app/.netlify/functions';

// O usar URL relativa si es el mismo dominio:
const API_BASE_URL = '/.netlify/functions';
```

### 3.2 Agregar Script de Supabase (Opcional)
Si quieres usar Supabase directamente desde el frontend:

```html
<!-- Agregar antes del </body> en index-tabler.html -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  const SUPABASE_URL = 'https://xxxxx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJI...';
  const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
</script>
```

## 📧 Paso 4: Configurar Notificaciones (Opcional)

### 4.1 SendGrid para Emails
1. Crear cuenta en [SendGrid](https://sendgrid.com) (100 emails/día gratis)
2. Obtener API Key
3. Agregar a variables de Netlify:
```bash
SENDGRID_API_KEY = "SG.xxxxx"
EMAIL_FROM = "notificaciones@tuempresa.com"
EMAIL_TO_RH = "rh@tuempresa.com"
```

### 4.2 Crear Function de Email
Crear `netlify/functions/send-notification.js` para enviar emails cuando se complete un test.

## 🧪 Paso 5: Probar el Sistema

### 5.1 Crear Token de Prueba
1. Ir a Supabase → SQL Editor
2. Ejecutar:
```sql
INSERT INTO candidatos (nombre, email, telefono, puesto, token, fecha_expiracion)
VALUES (
    'Test Usuario',
    'test@example.com',
    '555-0100',
    'Soldador',
    'PSI-TEST001',
    NOW() + INTERVAL '48 hours'
);
```

### 5.2 Probar el Test
1. Ir a: `https://tu-sitio.netlify.app/test?token=PSI-TEST001`
2. Completar el test
3. Verificar en Supabase que se guardaron los datos

### 5.3 Probar API Endpoints
```bash
# Validar token
curl https://tu-sitio.netlify.app/.netlify/functions/validate-token?token=PSI-TEST001

# Auto-guardar (POST)
curl -X POST https://tu-sitio.netlify.app/.netlify/functions/auto-save \
  -H "Content-Type: application/json" \
  -d '{"token":"PSI-TEST001","respuestas":{}}'
```

## 📊 Paso 6: Dashboard Admin

### 6.1 Configurar Autenticación
1. En Supabase → Authentication → Providers
2. Habilitar "Email" provider
3. Crear usuario admin:
```sql
-- En SQL Editor
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES ('admin@empresa.com', crypt('password123', gen_salt('bf')), NOW());
```

### 6.2 Acceder al Dashboard
1. Ir a: `https://tu-sitio.netlify.app/admin`
2. Login con credenciales admin
3. Ver candidatos, resultados y estadísticas

## 🔒 Seguridad

### Importante:
1. **NUNCA** compartir `SUPABASE_SERVICE_KEY`
2. Usar RLS (Row Level Security) en Supabase
3. Validar todos los inputs en las functions
4. Usar HTTPS siempre (Netlify lo hace automáticamente)
5. Rotar tokens regularmente

## 🐛 Troubleshooting

### Error: "Token inválido"
- Verificar que el token existe en la tabla `candidatos`
- Verificar que no ha expirado
- Verificar las variables de entorno en Netlify

### Error: "Cannot read properties of undefined"
- Verificar que Supabase client está inicializado
- Verificar que las tablas están creadas
- Verificar permisos RLS

### Functions no funcionan
- Verificar que `@supabase/supabase-js` está instalado
- Verificar logs en Netlify → Functions
- Verificar variables de entorno

## 📝 Checklist Final

- [ ] Supabase proyecto creado
- [ ] Tablas SQL ejecutadas
- [ ] Variables de entorno configuradas en Netlify
- [ ] Dependencias instaladas en functions
- [ ] Site desplegado en Netlify
- [ ] Token de prueba creado
- [ ] Test funciona con token
- [ ] Auto-guardado funciona
- [ ] Resultados se calculan correctamente
- [ ] Dashboard admin accesible

## 🎉 ¡Listo!

Tu sistema está configurado y funcionando. 

**URLs importantes:**
- Test: `https://tu-sitio.netlify.app/test?token=XXX`
- Admin: `https://tu-sitio.netlify.app/admin`
- API: `https://tu-sitio.netlify.app/.netlify/functions/`

## 📚 Recursos Adicionales

- [Documentación Supabase](https://supabase.com/docs)
- [Documentación Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Guía de RLS Supabase](https://supabase.com/docs/guides/auth/row-level-security)