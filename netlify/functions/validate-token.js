/**
 * Netlify Function: Validar Token
 * Endpoint: /.netlify/functions/validate-token
 * Método: GET
 * Query params: ?token=PSI-XXXXX
 */

const { createClient } = require('@supabase/supabase-js');

// Configuración desde variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
    // Solo permitir GET
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        // Obtener token de query params
        const token = event.queryStringParameters?.token;
        
        if (!token) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    valido: false, 
                    mensaje: 'Token requerido' 
                })
            };
        }

        // Buscar candidato por token
        const { data: candidato, error } = await supabase
            .from('candidatos')
            .select('*')
            .eq('token', token)
            .single();

        if (error || !candidato) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    valido: false, 
                    mensaje: 'Token inválido' 
                })
            };
        }

        // Verificar expiración
        const ahora = new Date();
        const expiracion = new Date(candidato.fecha_expiracion);
        
        if (ahora > expiracion) {
            // Actualizar estado a expirado
            await supabase
                .from('candidatos')
                .update({ estado: 'expirado' })
                .eq('id', candidato.id);

            return {
                statusCode: 403,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    valido: false, 
                    mensaje: 'Token expirado' 
                })
            };
        }

        // Verificar si ya fue completado
        if (candidato.estado === 'completado') {
            return {
                statusCode: 403,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    valido: false, 
                    mensaje: 'Este test ya fue completado' 
                })
            };
        }

        // Si el estado es pendiente, actualizarlo a en_progreso
        if (candidato.estado === 'pendiente') {
            await supabase
                .from('candidatos')
                .update({ 
                    estado: 'en_progreso',
                    fecha_actualizacion: new Date().toISOString()
                })
                .eq('id', candidato.id);
        }

        // Verificar si hay progreso guardado
        const { data: respuestas } = await supabase
            .from('respuestas')
            .select('*')
            .eq('candidato_id', candidato.id)
            .single();

        // Token válido - devolver datos del candidato y progreso
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                valido: true,
                candidato: {
                    id: candidato.id,
                    nombre: candidato.nombre,
                    email: candidato.email,
                    puesto: candidato.puesto,
                    tiempo_restante: Math.floor((expiracion - ahora) / 1000 / 60), // minutos
                },
                progreso: respuestas ? {
                    cleaver: respuestas.cleaver_data || {},
                    kostick: respuestas.kostick_data || {},
                    situaciones: respuestas.situaciones_data || {},
                    aptitudes: respuestas.aptitudes_data || {},
                    firma: respuestas.firma_base64 || null
                } : null
            })
        };

    } catch (error) {
        console.error('Error validando token:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                valido: false,
                mensaje: 'Error del servidor',
                error: error.message 
            })
        };
    }
};