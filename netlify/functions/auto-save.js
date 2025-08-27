/**
 * Netlify Function: Auto-guardar progreso
 * Endpoint: /.netlify/functions/auto-save
 * Método: POST
 * Body: { token, respuestas }
 */

const { createClient } = require('@supabase/supabase-js');

// Configuración desde variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

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
        const { token, respuestas } = JSON.parse(event.body);

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

        // Validar token y obtener candidato
        const { data: candidato, error: errorCandidato } = await supabase
            .from('candidatos')
            .select('id, estado, fecha_expiracion')
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

        // Preparar datos para guardar
        const datosRespuesta = {
            candidato_id: candidato.id,
            cleaver_data: respuestas.cleaver || {},
            kostick_data: respuestas.kostick || {},
            situaciones_data: respuestas.situaciones || {},
            aptitudes_data: respuestas.aptitudes || {},
            firma_base64: respuestas.firma || null,
            metadata: {
                ultimo_guardado: new Date().toISOString(),
                auto_guardado: true,
                navegador: event.headers['user-agent'] || 'unknown'
            }
        };

        // Verificar si ya existen respuestas
        const { data: respuestasExistentes } = await supabase
            .from('respuestas')
            .select('id')
            .eq('candidato_id', candidato.id)
            .single();

        let resultado;
        if (respuestasExistentes) {
            // Actualizar respuestas existentes
            const { data, error } = await supabase
                .from('respuestas')
                .update(datosRespuesta)
                .eq('id', respuestasExistentes.id)
                .select()
                .single();
            
            if (error) throw error;
            resultado = data;
        } else {
            // Insertar nuevas respuestas
            const { data, error } = await supabase
                .from('respuestas')
                .insert([datosRespuesta])
                .select()
                .single();
            
            if (error) throw error;
            resultado = data;
        }

        // Si el estado del candidato es pendiente, cambiarlo a en_progreso
        if (candidato.estado === 'pendiente') {
            await supabase
                .from('candidatos')
                .update({ 
                    estado: 'en_progreso',
                    fecha_actualizacion: new Date().toISOString()
                })
                .eq('id', candidato.id);
        }

        // Respuesta exitosa
        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                mensaje: 'Progreso guardado exitosamente',
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Error auto-guardando:', error);
        return {
            statusCode: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false,
                error: 'Error guardando progreso',
                detalles: error.message 
            })
        };
    }
};