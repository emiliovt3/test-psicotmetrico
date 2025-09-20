/**
 * Netlify Function: Enviar Test Completo
 * Endpoint: /.netlify/functions/submit-test
 * Método: POST
 * Body: { token, respuestas, datosPersonales, tiempoTotal }
 */

const { createClient } = require('@supabase/supabase-js');

// Importar el motor de scoring
const ScoringEngine = require('../../js/scoring-engine.js');

// Production mode configuration - use real database when NODE_ENV=production
let isDevelopment = process.env.NODE_ENV !== 'production';

// Override to development if we don't have Supabase credentials at all
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  isDevelopment = true;
}

// Configuración desde variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Service key para operaciones admin

let supabase = null;
if (!isDevelopment) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    // Solo permitir POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        // Parsear body
        const datos = JSON.parse(event.body);
        const { token, respuestas, datosPersonales, tiempoTotal } = datos;

        if (!token || !respuestas) {
            return {
                statusCode: 400,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Token y respuestas son requeridos'
                })
            };
        }

        // Calcular resultados usando el motor de scoring (siempre funciona)
        const motor = new ScoringEngine(respuestas);
        const resultado = motor.calcular();
        const resumen = motor.generarResumenEjecutivo();

        // DEVELOPMENT MODE - Simular envío exitoso
        if (isDevelopment) {
            const candidatoSimulado = {
                nombre: datosPersonales?.nombre || 'Candidato Demo',
                puesto: 'Soldador'
            };

            console.log('✅ [DEV] Test enviado (simulado):', {
                token: token.substring(0, 8) + '...',
                candidato: candidatoSimulado.nombre,
                puntaje: resultado.puntajeTotal,
                porcentaje: resultado.porcentaje,
                recomendacion: resultado.recomendacion,
                timestamp: new Date().toISOString()
            });

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    mensaje: 'Test enviado exitosamente (desarrollo)',
                    resultado: {
                        puntajeTotal: resultado.puntajeTotal,
                        porcentaje: resultado.porcentaje,
                        recomendacion: resultado.recomendacion,
                        mensaje: resultado.mensaje
                    },
                    candidato: candidatoSimulado,
                    development: true
                })
            };
        }

        // PRODUCTION MODE - Usar Supabase
        // Validar token
        const { data: candidato, error: errorCandidato } = await supabase
            .from('candidatos')
            .select('*')
            .eq('token', token)
            .single();

        if (errorCandidato || !candidato) {
            return {
                statusCode: 404,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Token inválido'
                })
            };
        }

        // Verificar que no esté completado
        if (candidato.estado === 'completado') {
            return {
                statusCode: 403,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Este test ya fue completado'
                })
            };
        }

        // Verificar expiración
        const ahora = new Date();
        const expiracion = new Date(candidato.fecha_expiracion);
        if (ahora > expiracion) {
            return {
                statusCode: 403,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Token expirado'
                })
            };
        }

        // Actualizar datos personales si se proporcionan
        if (datosPersonales) {
            await supabase
                .from('candidatos')
                .update({
                    nombre: datosPersonales.nombre || candidato.nombre,
                    email: datosPersonales.email || candidato.email,
                    telefono: datosPersonales.telefono || candidato.telefono
                })
                .eq('id', candidato.id);
        }

        // Guardar respuestas
        const datosRespuesta = {
            candidato_id: candidato.id,
            cleaver_data: respuestas.cleaver || {},
            kostick_data: respuestas.kostick || {},
            situaciones_data: respuestas.situaciones || {},
            aptitudes_data: respuestas.aptitudes || {},
            firma_base64: respuestas.firma || null,
            metadata: {
                navegador: event.headers['user-agent'] || 'unknown',
                ip: event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown',
                tiempo_total_minutos: tiempoTotal || null,
                fecha_envio: new Date().toISOString()
            },
            submitted_at: new Date().toISOString()
        };

        // Verificar si ya existen respuestas
        const { data: respuestasExistentes } = await supabase
            .from('respuestas')
            .select('id')
            .eq('candidato_id', candidato.id)
            .single();

        let respuestaGuardada;
        if (respuestasExistentes) {
            // Actualizar
            const { data, error } = await supabase
                .from('respuestas')
                .update(datosRespuesta)
                .eq('id', respuestasExistentes.id)
                .select()
                .single();

            if (error) throw error;
            respuestaGuardada = data;
        } else {
            // Insertar
            const { data, error } = await supabase
                .from('respuestas')
                .insert([datosRespuesta])
                .select()
                .single();

            if (error) throw error;
            respuestaGuardada = data;
        }

        // Preparar datos del resultado
        const datosResultado = {
            candidato_id: candidato.id,
            puntaje_total: resultado.puntajeTotal,
            porcentaje: resultado.porcentaje,
            perfil_disc: resultado.perfilDISC,
            tipo_disc: resultado.tipoDISC || '',
            banderas_rojas: resultado.banderasRojas || [],
            recomendacion: resultado.recomendacion,
            nivel_riesgo: resultado.nivelRiesgo || 'MEDIO',
            mensaje: resultado.mensaje || '',
            puntajes_seccion: resultado.puntajes,
            insights_disc: resultado.insightsDISC || [],
            fortalezas: resumen.fortalezas || [],
            debilidades: resumen.debilidades || [],
            detalles: resultado.detalles || {},
            fecha_calculo: new Date().toISOString()
        };

        // Guardar o actualizar resultados
        const { data: resultadosExistentes } = await supabase
            .from('resultados')
            .select('id')
            .eq('candidato_id', candidato.id)
            .single();

        let resultadoGuardado;
        if (resultadosExistentes) {
            // Actualizar
            const { data, error } = await supabase
                .from('resultados')
                .update(datosResultado)
                .eq('id', resultadosExistentes.id)
                .select()
                .single();

            if (error) throw error;
            resultadoGuardado = data;
        } else {
            // Insertar
            const { data, error } = await supabase
                .from('resultados')
                .insert([datosResultado])
                .select()
                .single();

            if (error) throw error;
            resultadoGuardado = data;
        }

        // Actualizar estado del candidato a completado
        await supabase
            .from('candidatos')
            .update({
                estado: 'completado',
                fecha_actualizacion: new Date().toISOString()
            })
            .eq('id', candidato.id);

        // Registrar actividad
        await supabase
            .from('logs_actividad')
            .insert([{
                tipo_evento: 'TEST_COMPLETADO',
                descripcion: `Test completado por ${candidato.nombre}`,
                candidato_id: candidato.id,
                datos: {
                    puntaje: resultado.puntajeTotal,
                    porcentaje: resultado.porcentaje,
                    recomendacion: resultado.recomendacion
                },
                ip_address: event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown',
                user_agent: event.headers['user-agent'] || 'unknown'
            }]);

        // TODO: Enviar notificación por email a RH
        // await enviarEmailNotificacion(candidato, resultado);

        // Respuesta exitosa
        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                mensaje: 'Test enviado exitosamente',
                resultado: {
                    puntajeTotal: resultado.puntajeTotal,
                    porcentaje: resultado.porcentaje,
                    recomendacion: resultado.recomendacion,
                    mensaje: resultado.mensaje
                },
                candidato: {
                    nombre: candidato.nombre,
                    puesto: candidato.puesto
                }
            })
        };

    } catch (error) {
        console.error(`❌ [${isDevelopment ? 'DEV' : 'PROD'}] Error procesando test:`, error);

        // En desarrollo, devolver resultado simulado amigable
        if (isDevelopment) {
            // Intentar calcular resultado aunque haya error
            let resultadoSimulado = {
                puntajeTotal: 85,
                porcentaje: 85,
                recomendacion: 'CONTRATAR',
                mensaje: 'Candidato recomendado (simulado)'
            };

            try {
                const motor = new ScoringEngine(JSON.parse(event.body).respuestas || {});
                const resultado = motor.calcular();
                resultadoSimulado = {
                    puntajeTotal: resultado.puntajeTotal,
                    porcentaje: resultado.porcentaje,
                    recomendacion: resultado.recomendacion,
                    mensaje: resultado.mensaje
                };
            } catch (e) {
                console.log('📝 [DEV] Usando resultado simulado por defecto');
            }

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    mensaje: 'Test procesado (simulado - error controlado)',
                    resultado: resultadoSimulado,
                    candidato: {
                        nombre: 'Candidato Demo',
                        puesto: 'Soldador'
                    },
                    development: true,
                    nota: 'En desarrollo, los errores se manejan de forma amigable'
                })
            };
        }

        return {
            statusCode: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Error procesando el test',
                detalles: error.message
            })
        };
    }
};