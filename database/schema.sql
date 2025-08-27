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
-- Configuración global del sistema
-- ==============================================
CREATE TABLE IF NOT EXISTS configuracion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clave VARCHAR(50) UNIQUE NOT NULL,
    valor JSONB NOT NULL,
    descripcion TEXT,
    actualizado_por VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Configuración inicial
INSERT INTO configuracion (clave, valor, descripcion) VALUES
    ('emails_notificacion', '["rh@empresa.com"]', 'Emails que reciben notificaciones'),
    ('tiempo_expiracion_horas', '48', 'Horas de validez del token'),
    ('auto_guardado_segundos', '30', 'Frecuencia de auto-guardado'),
    ('puntajes_maximos', '{
        "cleaver": 40,
        "kostick": 30,
        "situaciones": 25,
        "aptitudes": 27
    }', 'Puntajes máximos por sección'),
    ('umbrales_recomendacion', '{
        "contratar": 80,
        "contratar_con_reservas": 65,
        "segunda_entrevista": 50,
        "rechazar": 0
    }', 'Umbrales de porcentaje para recomendaciones')
ON CONFLICT (clave) DO NOTHING;

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

-- Dar permisos al usuario autenticado
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Dar permisos al service role (admin)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;