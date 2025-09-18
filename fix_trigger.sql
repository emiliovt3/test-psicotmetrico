-- Arreglar el trigger problemático
DROP TRIGGER IF EXISTS log_candidatos ON candidatos;
DROP TRIGGER IF EXISTS log_respuestas ON respuestas;
DROP TRIGGER IF EXISTS log_resultados ON resultados;

-- Recrear función corregida
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
            WHEN TG_TABLE_NAME = 'respuestas' THEN NEW.candidato_id
            WHEN TG_TABLE_NAME = 'resultados' THEN NEW.candidato_id
            ELSE NULL
        END,
        jsonb_build_object('operacion', TG_OP, 'tabla', TG_TABLE_NAME)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear triggers solo para INSERT y UPDATE (no DELETE)
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

-- Ahora insertar el candidato de prueba
INSERT INTO candidatos (
  nombre, email, telefono, puesto, token, fecha_expiracion
) VALUES (
  'Test Usuario', 'test@ejemplo.com', '555-0100', 'Soldador', 
  'PSI-TEST001', NOW() + INTERVAL '48 hours'
);