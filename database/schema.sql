-- ==============================================
-- Schema de Base de Datos - Sistema Psicométrico
-- Base de datos: PostgreSQL (Supabase)
-- ==============================================

-- Habilitar UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- TABLA: candidatos
-- Almacena información de los candidatos y sus tokens
-- ==============================================
CREATE TABLE IF NOT EXISTS candidatos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    puesto VARCHAR(50) NOT NULL,
    token VARCHAR(50) UNIQUE NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_progreso', 'completado', 'expirado')),
    fecha_expiracion TIMESTAMP NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_candidatos_token ON candidatos(token);
CREATE INDEX idx_candidatos_estado ON candidatos(estado);
CREATE INDEX idx_candidatos_puesto ON candidatos(puesto);
CREATE INDEX idx_candidatos_created ON candidatos(created_at DESC);

-- ==============================================
-- TABLA: respuestas
-- Almacena todas las respuestas del test
-- ==============================================
CREATE TABLE IF NOT EXISTS respuestas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidato_id UUID NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
    cleaver_data JSONB DEFAULT '{}',
    kostick_data JSONB DEFAULT '{}',
    situaciones_data JSONB DEFAULT '{}',
    aptitudes_data JSONB DEFAULT '{}',
    firma_base64 TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    submitted_at TIMESTAMP,
    UNIQUE(candidato_id) -- Solo una respuesta por candidato
);

-- Índice para búsquedas por candidato
CREATE INDEX idx_respuestas_candidato ON respuestas(candidato_id);

-- ==============================================
-- TABLA: resultados
-- Almacena los resultados calculados y recomendaciones
-- ==============================================
CREATE TABLE IF NOT EXISTS resultados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidato_id UUID NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
    puntaje_total DECIMAL(5,2) NOT NULL,
    porcentaje INTEGER NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
    perfil_disc JSONB NOT NULL,
    tipo_disc VARCHAR(10),
    banderas_rojas JSONB DEFAULT '[]',
    recomendacion VARCHAR(50) NOT NULL,
    nivel_riesgo VARCHAR(20),
    mensaje TEXT,
    puntajes_seccion JSONB,
    insights_disc JSONB DEFAULT '[]',
    fortalezas JSONB DEFAULT '[]',
    debilidades JSONB DEFAULT '[]',
    detalles JSONB DEFAULT '{}',
    pdf_url TEXT,
    fecha_calculo TIMESTAMP DEFAULT NOW(),
    UNIQUE(candidato_id) -- Solo un resultado por candidato
);

-- Índices para búsquedas y reportes
CREATE INDEX idx_resultados_candidato ON resultados(candidato_id);
CREATE INDEX idx_resultados_recomendacion ON resultados(recomendacion);
CREATE INDEX idx_resultados_porcentaje ON resultados(porcentaje DESC);

-- ==============================================
-- TABLA: configuracion
-- Sistema de configuración global mejorado
-- ==============================================
CREATE TABLE IF NOT EXISTS configuracion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seccion VARCHAR(50) NOT NULL,              -- Sección de configuración (company, email, security, etc.)
    clave VARCHAR(100) NOT NULL,               -- Clave de configuración dentro de la sección
    valor JSONB NOT NULL,                      -- Valor de configuración (puede ser cualquier tipo JSON)
    valor_encriptado BOOLEAN DEFAULT FALSE,    -- Indica si el valor está encriptado
    tipo_dato VARCHAR(20) DEFAULT 'json',      -- Tipo de dato (string, number, boolean, json, encrypted)
    descripcion TEXT,                          -- Descripción de la configuración
    es_sistema BOOLEAN DEFAULT FALSE,          -- Si es configuración del sistema (no editable por UI)
    es_sensible BOOLEAN DEFAULT FALSE,         -- Si contiene datos sensibles (passwords, tokens, etc.)
    version INTEGER DEFAULT 1,                -- Control de versión para configuraciones
    actualizado_por VARCHAR(100),             -- Usuario que realizó el cambio
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(seccion, clave)                    -- Combinación única de sección + clave
);

-- Índices para búsquedas optimizadas
CREATE INDEX idx_configuracion_seccion ON configuracion(seccion);
CREATE INDEX idx_configuracion_clave ON configuracion(clave);
CREATE INDEX idx_configuracion_tipo ON configuracion(tipo_dato);
CREATE INDEX idx_configuracion_sensible ON configuracion(es_sensible);
CREATE INDEX idx_configuracion_updated ON configuracion(updated_at DESC);

-- ==============================================
-- TABLA: configuracion_historial
-- Historial de cambios de configuración
-- ==============================================
CREATE TABLE IF NOT EXISTS configuracion_historial (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    configuracion_id UUID NOT NULL REFERENCES configuracion(id) ON DELETE CASCADE,
    valor_anterior JSONB,
    valor_nuevo JSONB NOT NULL,
    actualizado_por VARCHAR(100),
    razon_cambio TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para búsquedas por configuración
CREATE INDEX idx_config_historial_config ON configuracion_historial(configuracion_id);
CREATE INDEX idx_config_historial_fecha ON configuracion_historial(created_at DESC);

-- Configuración inicial del sistema
INSERT INTO configuracion (seccion, clave, valor, descripcion, es_sistema, tipo_dato) VALUES
    -- Configuración básica del sistema
    ('sistema', 'emails_notificacion', '["rh@empresa.com"]', 'Emails que reciben notificaciones del sistema', true, 'json'),
    ('sistema', 'tiempo_expiracion_horas', '48', 'Horas de validez del token de evaluación', true, 'number'),
    ('sistema', 'auto_guardado_segundos', '30', 'Frecuencia de auto-guardado en segundos', true, 'number'),

    -- Configuración de puntuación
    ('evaluacion', 'puntajes_maximos', '{
        "cleaver": 40,
        "kostick": 30,
        "situaciones": 25,
        "aptitudes": 27
    }', 'Puntajes máximos por sección del test', false, 'json'),

    ('evaluacion', 'umbrales_recomendacion', '{
        "contratar": 80,
        "contratar_con_reservas": 65,
        "segunda_entrevista": 50,
        "rechazar": 0
    }', 'Umbrales de porcentaje para recomendaciones de contratación', false, 'json'),

    ('evaluacion', 'tiempo_limite_minutos', '60', 'Tiempo límite para completar la evaluación', false, 'number'),
    ('evaluacion', 'permitir_retomar', 'true', 'Permitir retomar evaluación después de desconexión', false, 'boolean'),
    ('evaluacion', 'mostrar_progreso', 'true', 'Mostrar barra de progreso durante la evaluación', false, 'boolean'),

    -- Configuración de empresa
    ('empresa', 'nombre', '"Empresa de Signos Luminosos"', 'Nombre de la empresa', false, 'string'),
    ('empresa', 'logo_url', '""', 'URL del logo de la empresa', false, 'string'),
    ('empresa', 'color_primario', '"#0066cc"', 'Color primario de la marca', false, 'string'),
    ('empresa', 'color_secundario', '"#ffffff"', 'Color secundario de la marca', false, 'string'),
    ('empresa', 'direccion', '""', 'Dirección física de la empresa', false, 'string'),
    ('empresa', 'telefono', '""', 'Teléfono de contacto', false, 'string'),
    ('empresa', 'email_contacto', '""', 'Email de contacto general', false, 'string'),

    -- Configuración de seguridad
    ('seguridad', 'max_intentos_login', '5', 'Máximo número de intentos de login fallidos', false, 'number'),
    ('seguridad', 'tiempo_bloqueo_minutos', '15', 'Tiempo de bloqueo después de máximos intentos', false, 'number'),
    ('seguridad', 'requerir_2fa', 'false', 'Requerir autenticación de dos factores', false, 'boolean'),
    ('seguridad', 'duracion_sesion_horas', '8', 'Duración máxima de la sesión administrativa', false, 'number'),

    -- Configuración de email (valores sensibles)
    ('email', 'smtp_host', '""', 'Servidor SMTP para envío de emails', false, 'string'),
    ('email', 'smtp_puerto', '587', 'Puerto del servidor SMTP', false, 'number'),
    ('email', 'smtp_usuario', '""', 'Usuario SMTP', false, 'string'),
    ('email', 'smtp_password', '""', 'Contraseña SMTP', true, 'encrypted'),
    ('email', 'remitente_nombre', '"Sistema Psicométrico"', 'Nombre del remitente en emails', false, 'string'),
    ('email', 'remitente_email', '""', 'Email del remitente', false, 'string'),
    ('email', 'plantilla_invitacion', '""', 'Plantilla HTML para email de invitación', false, 'string'),
    ('email', 'plantilla_recordatorio', '""', 'Plantilla HTML para email de recordatorio', false, 'string'),

    -- Configuración de reportes
    ('reportes', 'incluir_graficos', 'true', 'Incluir gráficos en reportes PDF', false, 'boolean'),
    ('reportes', 'marca_agua', '"CONFIDENCIAL"', 'Marca de agua en reportes', false, 'string'),
    ('reportes', 'footer_personalizado', '""', 'Footer personalizado en reportes', false, 'string'),
    ('reportes', 'auto_archivar_dias', '90', 'Días para auto-archivar reportes antiguos', false, 'number'),

    -- Puestos de trabajo con perfiles DISC
    ('puestos', 'soldador', '{
        "nombre": "Soldador",
        "descripcion": "Técnico especializado en soldadura",
        "disc_ideal": {"D": 2, "I": 4, "S": 8, "C": 7},
        "disc_min": {"D": 1, "I": 2, "S": 6, "C": 5},
        "disc_max": {"D": 4, "I": 6, "S": 9, "C": 9},
        "prioridad": "critical",
        "activo": true,
        "competencias_tecnicas": ["soldadura_mig", "soldadura_tig", "lectura_planos"],
        "banderas_rojas": ["D > 6", "S < 5"]
    }', 'Perfil del puesto: Soldador', false, 'json'),

    ('puestos', 'electricista', '{
        "nombre": "Electricista",
        "descripcion": "Técnico especializado en instalaciones eléctricas",
        "disc_ideal": {"D": 3, "I": 3, "S": 7, "C": 8},
        "disc_min": {"D": 1, "I": 1, "S": 5, "C": 6},
        "disc_max": {"D": 5, "I": 5, "S": 9, "C": 9},
        "prioridad": "critical",
        "activo": true,
        "competencias_tecnicas": ["instalaciones_electricas", "tableros", "motores"],
        "banderas_rojas": ["D > 6", "C < 5"]
    }', 'Perfil del puesto: Electricista', false, 'json')
ON CONFLICT (seccion, clave) DO NOTHING;

-- ==============================================
-- TABLA: sesiones_admin
-- Control de acceso para administradores
-- ==============================================
CREATE TABLE IF NOT EXISTS sesiones_admin (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(100) NOT NULL,
    token_sesion VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    ultimo_acceso TIMESTAMP DEFAULT NOW(),
    expira_en TIMESTAMP NOT NULL,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para sesiones
CREATE INDEX idx_sesiones_token ON sesiones_admin(token_sesion);
CREATE INDEX idx_sesiones_activa ON sesiones_admin(activa);

-- ==============================================
-- TABLA: logs_actividad
-- Registro de todas las actividades importantes
-- ==============================================
CREATE TABLE IF NOT EXISTS logs_actividad (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_evento VARCHAR(50) NOT NULL,
    descripcion TEXT,
    candidato_id UUID REFERENCES candidatos(id) ON DELETE SET NULL,
    datos JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX idx_logs_tipo ON logs_actividad(tipo_evento);
CREATE INDEX idx_logs_candidato ON logs_actividad(candidato_id);
CREATE INDEX idx_logs_created ON logs_actividad(created_at DESC);

-- ==============================================
-- VISTAS ÚTILES
-- ==============================================

-- Vista completa de candidatos con resultados
CREATE OR REPLACE VIEW vista_candidatos_completo AS
SELECT 
    c.*,
    r.submitted_at as fecha_completado,
    res.puntaje_total,
    res.porcentaje,
    res.recomendacion,
    res.nivel_riesgo,
    res.tipo_disc,
    res.pdf_url
FROM candidatos c
LEFT JOIN respuestas r ON c.id = r.candidato_id
LEFT JOIN resultados res ON c.id = res.candidato_id
ORDER BY c.created_at DESC;

-- Vista de estadísticas por puesto
CREATE OR REPLACE VIEW estadisticas_por_puesto AS
SELECT 
    c.puesto,
    COUNT(*) as total_candidatos,
    COUNT(CASE WHEN c.estado = 'completado' THEN 1 END) as completados,
    COUNT(CASE WHEN res.recomendacion = 'CONTRATAR' THEN 1 END) as recomendados_contratar,
    COUNT(CASE WHEN res.recomendacion = 'RECHAZADO' THEN 1 END) as rechazados,
    AVG(res.porcentaje) as promedio_porcentaje
FROM candidatos c
LEFT JOIN resultados res ON c.id = res.candidato_id
GROUP BY c.puesto;

-- ==============================================
-- FUNCIONES ÚTILES
-- ==============================================

-- Función para limpiar tokens expirados
CREATE OR REPLACE FUNCTION limpiar_tokens_expirados()
RETURNS void AS $$
BEGIN
    UPDATE candidatos 
    SET estado = 'expirado'
    WHERE estado = 'pendiente' 
    AND fecha_expiracion < NOW();
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas del dashboard
CREATE OR REPLACE FUNCTION obtener_estadisticas_dashboard()
RETURNS TABLE (
    total_evaluaciones INTEGER,
    completadas_hoy INTEGER,
    completadas_semana INTEGER,
    completadas_mes INTEGER,
    tasa_aprobacion DECIMAL,
    tiempo_promedio_minutos INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_evaluaciones,
        COUNT(CASE WHEN DATE(r.submitted_at) = CURRENT_DATE THEN 1 END)::INTEGER as completadas_hoy,
        COUNT(CASE WHEN r.submitted_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END)::INTEGER as completadas_semana,
        COUNT(CASE WHEN r.submitted_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END)::INTEGER as completadas_mes,
        AVG(CASE WHEN res.recomendacion IN ('CONTRATAR', 'CONTRATAR_CON_RESERVAS') THEN 100 ELSE 0 END)::DECIMAL as tasa_aprobacion,
        AVG(EXTRACT(EPOCH FROM (r.submitted_at - c.created_at)) / 60)::INTEGER as tiempo_promedio_minutos
    FROM candidatos c
    LEFT JOIN respuestas r ON c.id = r.candidato_id
    LEFT JOIN resultados res ON c.id = res.candidato_id
    WHERE c.estado = 'completado';
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_actividad ENABLE ROW LEVEL SECURITY;

-- Políticas para candidatos (acceso público con token válido)
CREATE POLICY "Candidatos pueden ver su propia info" ON candidatos
    FOR SELECT 
    USING (auth.jwt() ->> 'token' = token);

CREATE POLICY "Admin puede ver todos los candidatos" ON candidatos
    FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para respuestas
CREATE POLICY "Candidatos pueden insertar/actualizar sus respuestas" ON respuestas
    FOR ALL 
    USING (
        candidato_id IN (
            SELECT id FROM candidatos 
            WHERE token = auth.jwt() ->> 'token'
        )
    );

CREATE POLICY "Admin puede ver todas las respuestas" ON respuestas
    FOR SELECT 
    USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para resultados
CREATE POLICY "Solo admin puede ver resultados" ON resultados
    FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para configuración
CREATE POLICY "Solo admin puede gestionar configuración" ON configuracion
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para historial de configuración
CREATE POLICY "Solo admin puede ver historial de configuración" ON configuracion_historial
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- ==============================================
-- TRIGGERS
-- ==============================================

-- Trigger para actualizar fecha_actualizacion
CREATE OR REPLACE FUNCTION actualizar_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER actualizar_fecha_candidatos
    BEFORE UPDATE ON candidatos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_modificacion();

-- Trigger para actualizar updated_at en configuración
CREATE TRIGGER actualizar_fecha_configuracion
    BEFORE UPDATE ON configuracion
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_modificacion();

-- Función para registrar cambios de configuración en historial
CREATE OR REPLACE FUNCTION registrar_cambio_configuracion()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo registrar si el valor realmente cambió
    IF OLD.valor IS DISTINCT FROM NEW.valor THEN
        INSERT INTO configuracion_historial (
            configuracion_id,
            valor_anterior,
            valor_nuevo,
            actualizado_por,
            razon_cambio
        ) VALUES (
            NEW.id,
            OLD.valor,
            NEW.valor,
            NEW.actualizado_por,
            'Cambio automático vía sistema'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para historial de configuración
CREATE TRIGGER historial_configuracion
    AFTER UPDATE ON configuracion
    FOR EACH ROW
    EXECUTE FUNCTION registrar_cambio_configuracion();

-- Trigger para registrar actividad
CREATE OR REPLACE FUNCTION registrar_actividad()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO logs_actividad (
        tipo_evento,
        descripcion,
        candidato_id,
        datos
    ) VALUES (
        TG_OP || '_' || TG_TABLE_NAME,
        'Operación ' || TG_OP || ' en tabla ' || TG_TABLE_NAME,
        CASE 
            WHEN TG_TABLE_NAME = 'candidatos' THEN NEW.id
            WHEN TG_TABLE_NAME IN ('respuestas', 'resultados') THEN NEW.candidato_id
            ELSE NULL
        END,
        jsonb_build_object('operacion', TG_OP, 'tabla', TG_TABLE_NAME)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de actividad a tablas principales
CREATE TRIGGER log_candidatos
    AFTER INSERT OR UPDATE ON candidatos
    FOR EACH ROW
    EXECUTE FUNCTION registrar_actividad();

CREATE TRIGGER log_respuestas
    AFTER INSERT OR UPDATE ON respuestas
    FOR EACH ROW
    EXECUTE FUNCTION registrar_actividad();

CREATE TRIGGER log_resultados
    AFTER INSERT OR UPDATE ON resultados
    FOR EACH ROW
    EXECUTE FUNCTION registrar_actividad();

-- ==============================================
-- DATOS DE PRUEBA (OPCIONAL - Comentar en producción)
-- ==============================================

-- Insertar candidato de prueba
-- INSERT INTO candidatos (nombre, email, telefono, puesto, token, fecha_expiracion)
-- VALUES (
--     'Test Usuario',
--     'test@example.com',
--     '555-0100',
--     'Soldador',
--     'PSI-TEST-123',
--     NOW() + INTERVAL '48 hours'
-- );

-- ==============================================
-- GRANTS (Ajustar según configuración de Supabase)
-- ==============================================

-- Dar permisos al usuario anon de Supabase
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT, UPDATE ON candidatos, respuestas, logs_actividad TO anon;
GRANT SELECT ON configuracion TO anon;  -- Solo lectura para configuración pública

-- Dar permisos al usuario autenticado
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Dar permisos al service role (admin)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;