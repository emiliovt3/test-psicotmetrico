# 🚀 PRÓXIMOS PASOS - Sistema de Evaluación Psicométrica

**Tiempo total estimado:** 30 minutos para tener el sistema funcionando

---

## 📋 CHECKLIST DE CONFIGURACIÓN

### ✅ Paso 1: Supabase (15 minutos)

#### 1.1 Crear Proyecto
```bash
□ Ir a supabase.com
□ Sign up / Login
□ New Project
□ Project name: "test-psicometrico" 
□ Database Password: [generar uno fuerte]
□ Region: [la más cercana]
□ Create new project
```

#### 1.2 Ejecutar Schema
```bash
□ Ir a SQL Editor (menú lateral)
□ New Query
□ Copiar TODO el contenido de database/schema.sql
□ Pegar en el editor
□ Click "Run" (o Ctrl+Enter)
□ Verificar: "Success. No rows returned"
```

#### 1.3 Copiar Credenciales
```bash
□ Ir a Settings → API
□ Copiar y guardar:
  - Project URL: https://xxxxx.supabase.co
  - anon public: eyJhbGc...
  - service_role: eyJhbGc...
```

### ✅ Paso 2: Netlify (10 minutos)

#### 2.1 Conectar Repositorio
```bash
□ Ir a netlify.com
□ Sign up / Login  
□ "Add new site" → "Import an existing project"
□ Conectar GitHub
□ Seleccionar: test-psicotmetrico
□ Deploy settings (dejar por defecto)
□ Deploy site
```

#### 2.2 Configurar Variables
```bash
□ Site settings → Environment variables
□ Add variable:
  - SUPABASE_URL = [tu URL de Supabase]
  - SUPABASE_ANON_KEY = [tu anon key]
  - SUPABASE_SERVICE_KEY = [tu service key]
□ Save
```

#### 2.3 Instalar Dependencias
```bash
□ En tu computadora:
  cd netlify/functions
  npm init -y
  npm install @supabase/supabase-js
  
□ Commit y push:
  git add .
  git commit -m "Add Netlify dependencies"
  git push
  
□ Esperar redeploy automático (2-3 min)
```

### ✅ Paso 3: Crear Token de Prueba (5 minutos)

#### 3.1 En Supabase SQL Editor
```sql
-- Ejecutar este SQL para crear candidato de prueba
INSERT INTO candidatos (
  nombre, 
  email, 
  telefono, 
  puesto, 
  token, 
  fecha_expiracion
) VALUES (
  'Test Usuario',
  'test@ejemplo.com',
  '555-0100',
  'Soldador',
  'PSI-TEST001',
  NOW() + INTERVAL '48 hours'
);
```

#### 3.2 Probar el Sistema
```bash
□ Ir a: tu-sitio.netlify.app/test?token=PSI-TEST001
□ Debería mostrar "Bienvenido Test Usuario"
□ Completar el test
□ Verificar resultados
```

---

## 🔧 CONFIGURACIÓN ADICIONAL (Opcional)

### Dominio Personalizado
```bash
□ Netlify → Domain settings
□ Add custom domain
□ evaluacion.tuempresa.com
□ Configurar DNS
```

### Emails Automáticos
```bash
□ SendGrid / Resend cuenta gratuita
□ Obtener API Key
□ Agregar a Netlify env variables
□ Modificar functions para enviar emails
```

### Backup Automático
```bash
□ Supabase → Database → Backups
□ Enable Point-in-Time Recovery
□ Configurar retención (7 días gratis)
```

---

## 🧪 PRUEBAS RECOMENDADAS

### Test Funcional
```bash
□ Crear 3 tokens diferentes
□ Completar 1 test completo
□ Dejar 1 a medias (probar auto-guardado)
□ Intentar usar token expirado
```

### Dashboard Admin
```bash
□ Acceder a /admin/dashboard.html
□ Ver si aparecen los candidatos
□ Revisar estadísticas
□ Probar exportación
```

### Validaciones
```bash
□ Test con respuestas deshonestas (debe rechazar)
□ Test con puntaje alto (debe recomendar)
□ Test incompleto (no debe enviar)
```

---

## 🚨 TROUBLESHOOTING

### "Token inválido"
- Verificar que el token existe en BD
- Revisar fecha de expiración
- Verificar variables de entorno

### Dashboard vacío
- Verificar conexión Supabase
- Revisar que haya datos en BD
- Check Network tab para errores

### Functions no responden
- Ver logs en Netlify → Functions
- Verificar npm install se ejecutó
- Revisar variables de entorno

---

## 📊 MÉTRICAS DE ÉXITO

Cuando todo funcione verás:
- ✅ Token validado correctamente
- ✅ Auto-guardado cada 30 segundos
- ✅ Resultados calculados al enviar
- ✅ Dashboard con datos reales
- ✅ Modo oscuro persistente

---

## 🎯 SIGUIENTE SPRINT (Semana 2)

1. **Producción**
   - [ ] Migrar datos históricos
   - [ ] Capacitar usuarios
   - [ ] Monitoreo activo

2. **Mejoras**
   - [ ]. Generación de PDFs
   - [ ] Notificaciones email
   - [ ] Dashboard móvil

3. **Escala**
   - [ ] Cache de resultados
   - [ ] CDN para assets
   - [ ] Rate limiting

---

## 📞 AYUDA

Si algo falla:
1. Revisa los logs de Netlify Functions
2. Verifica las tablas en Supabase
3. Revisa la consola del navegador (F12)
4. Consulta SETUP.md para más detalles

---

**¡En 30 minutos tendrás el sistema funcionando! 🚀**