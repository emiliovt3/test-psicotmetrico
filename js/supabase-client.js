/**
 * Cliente de Supabase para el Sistema de Evaluación Psicométrica
 * Maneja toda la comunicación con la base de datos
 */

// Configuración de Supabase (estas variables se deben configurar en producción)
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// Inicializar cliente Supabase
let supabase = null;

// Función para inicializar Supabase con credenciales reales
function initSupabase(url = SUPABASE_URL, key = SUPABASE_ANON_KEY) {
    if (typeof window !== 'undefined' && window.supabase) {
        const { createClient } = window.supabase;
        supabase = createClient(url, key);
        return supabase;
    } else {
        console.error('Supabase client library not loaded');
        return null;
    }
}

/**
 * Clase para manejar todas las operaciones de base de datos
 */
class SupabaseService {
    constructor() {
        this.supabase = supabase;
    }

    // ============= CANDIDATOS =============
    
    /**
     * Crear un nuevo candidato con token único
     */
    async crearCandidato(datosPersonales) {
        const token = this.generarToken();
        const fechaExpiracion = new Date();
        fechaExpiracion.setHours(fechaExpiracion.getHours() + 48); // 48 horas de validez

        const candidato = {
            nombre: datosPersonales.nombre,
            email: datosPersonales.email,
            telefono: datosPersonales.telefono,
            puesto: datosPersonales.puesto,
            token: token,
            estado: 'pendiente',
            fecha_expiracion: fechaExpiracion.toISOString(),
            metadata: {
                navegador: navigator.userAgent,
                fecha_creacion: new Date().toISOString()
            }
        };

        const { data, error } = await this.supabase
            .from('candidatos')
            .insert([candidato])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Validar token y obtener datos del candidato
     */
    async validarToken(token) {
        const { data, error } = await this.supabase
            .from('candidatos')
            .select('*')
            .eq('token', token)
            .single();

        if (error || !data) {
            return { valido: false, mensaje: 'Token inválido' };
        }

        // Verificar si el token ha expirado
        const ahora = new Date();
        const expiracion = new Date(data.fecha_expiracion);
        
        if (ahora > expiracion) {
            return { valido: false, mensaje: 'Token expirado' };
        }

        // Verificar si ya fue usado
        if (data.estado === 'completado') {
            return { valido: false, mensaje: 'Este test ya fue completado' };
        }

        return { 
            valido: true, 
            candidato: data 
        };
    }

    /**
     * Obtener todos los candidatos (para admin)
     */
    async obtenerCandidatos(filtros = {}) {
        let query = this.supabase
            .from('candidatos')
            .select(`
                *,
                respuestas (
                    id,
                    submitted_at
                ),
                resultados (
                    puntaje_total,
                    porcentaje,
                    recomendacion,
                    nivel_riesgo
                )
            `)
            .order('created_at', { ascending: false });

        // Aplicar filtros
        if (filtros.estado) {
            query = query.eq('estado', filtros.estado);
        }
        if (filtros.puesto) {
            query = query.eq('puesto', filtros.puesto);
        }
        if (filtros.desde) {
            query = query.gte('created_at', filtros.desde);
        }
        if (filtros.hasta) {
            query = query.lte('created_at', filtros.hasta);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    // ============= RESPUESTAS =============

    /**
     * Guardar respuestas del test
     */
    async guardarRespuestas(token, respuestas, esFinal = false) {
        // Primero validar el token
        const validacion = await this.validarToken(token);
        if (!validacion.valido) {
            throw new Error(validacion.mensaje);
        }

        const datosRespuesta = {
            candidato_id: validacion.candidato.id,
            cleaver_data: respuestas.cleaver || {},
            kostick_data: respuestas.kostick || {},
            situaciones_data: respuestas.situaciones || {},
            aptitudes_data: respuestas.aptitudes || {},
            firma_base64: respuestas.firma || null,
            metadata: {
                navegador: navigator.userAgent,
                tiempo_total: respuestas.tiempoTotal || null,
                guardado_automatico: !esFinal
            }
        };

        // Si es envío final, actualizar o insertar
        if (esFinal) {
            datosRespuesta.submitted_at = new Date().toISOString();
        }

        // Verificar si ya existen respuestas para este candidato
        const { data: existente } = await this.supabase
            .from('respuestas')
            .select('id')
            .eq('candidato_id', validacion.candidato.id)
            .single();

        let resultado;
        if (existente) {
            // Actualizar respuestas existentes
            const { data, error } = await this.supabase
                .from('respuestas')
                .update(datosRespuesta)
                .eq('id', existente.id)
                .select()
                .single();
            
            if (error) throw error;
            resultado = data;
        } else {
            // Insertar nuevas respuestas
            const { data, error } = await this.supabase
                .from('respuestas')
                .insert([datosRespuesta])
                .select()
                .single();
            
            if (error) throw error;
            resultado = data;
        }

        // Si es envío final, calcular resultados y actualizar estado
        if (esFinal) {
            await this.procesarResultados(validacion.candidato.id, respuestas);
            await this.actualizarEstadoCandidato(validacion.candidato.id, 'completado');
        }

        return resultado;
    }

    /**
     * Auto-guardado de progreso
     */
    async autoGuardar(token, respuestas) {
        return this.guardarRespuestas(token, respuestas, false);
    }

    /**
     * Envío final del test
     */
    async enviarTest(token, respuestas) {
        return this.guardarRespuestas(token, respuestas, true);
    }

    /**
     * Recuperar progreso guardado
     */
    async recuperarProgreso(token) {
        const validacion = await this.validarToken(token);
        if (!validacion.valido) {
            return null;
        }

        const { data, error } = await this.supabase
            .from('respuestas')
            .select('*')
            .eq('candidato_id', validacion.candidato.id)
            .single();

        if (error || !data) return null;

        return {
            cleaver: data.cleaver_data || {},
            kostick: data.kostick_data || {},
            situaciones: data.situaciones_data || {},
            aptitudes: data.aptitudes_data || {},
            firma: data.firma_base64 || null
        };
    }

    // ============= RESULTADOS =============

    /**
     * Procesar y guardar resultados
     */
    async procesarResultados(candidatoId, respuestas) {
        // Usar el motor de scoring
        const motor = new ScoringEngine(respuestas);
        const resultado = motor.calcular();
        const resumen = motor.generarResumenEjecutivo();

        const datosResultado = {
            candidato_id: candidatoId,
            puntaje_total: resultado.puntajeTotal,
            porcentaje: resultado.porcentaje,
            perfil_disc: resultado.perfilDISC,
            tipo_disc: resultado.tipoDISC,
            banderas_rojas: resultado.banderasRojas,
            recomendacion: resultado.recomendacion,
            nivel_riesgo: resultado.nivelRiesgo,
            mensaje: resultado.mensaje,
            puntajes_seccion: resultado.puntajes,
            insights_disc: resultado.insightsDISC,
            fortalezas: resumen.fortalezas,
            debilidades: resumen.debilidades,
            detalles: resultado.detalles,
            fecha_calculo: new Date().toISOString()
        };

        // Verificar si ya existe un resultado
        const { data: existente } = await this.supabase
            .from('resultados')
            .select('id')
            .eq('candidato_id', candidatoId)
            .single();

        if (existente) {
            // Actualizar resultado existente
            const { data, error } = await this.supabase
                .from('resultados')
                .update(datosResultado)
                .eq('id', existente.id)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } else {
            // Insertar nuevo resultado
            const { data, error } = await this.supabase
                .from('resultados')
                .insert([datosResultado])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        }
    }

    /**
     * Obtener resultado de un candidato
     */
    async obtenerResultado(candidatoId) {
        const { data, error } = await this.supabase
            .from('resultados')
            .select('*')
            .eq('candidato_id', candidatoId)
            .single();

        if (error) throw error;
        return data;
    }

    // ============= UTILIDADES =============

    /**
     * Actualizar estado del candidato
     */
    async actualizarEstadoCandidato(candidatoId, nuevoEstado) {
        const { data, error } = await this.supabase
            .from('candidatos')
            .update({ 
                estado: nuevoEstado,
                fecha_actualizacion: new Date().toISOString()
            })
            .eq('id', candidatoId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Generar token único
     */
    generarToken() {
        const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let token = '';
        for (let i = 0; i < 8; i++) {
            token += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
        }
        return `PSI-${token}-${Date.now().toString(36).toUpperCase()}`;
    }

    /**
     * Obtener estadísticas generales
     */
    async obtenerEstadisticas() {
        const { data: totales, error: errorTotales } = await this.supabase
            .from('candidatos')
            .select('estado', { count: 'exact' });

        const { data: porPuesto, error: errorPuesto } = await this.supabase
            .from('candidatos')
            .select('puesto', { count: 'exact' })
            .eq('estado', 'completado');

        const { data: recomendaciones, error: errorRec } = await this.supabase
            .from('resultados')
            .select('recomendacion', { count: 'exact' });

        if (errorTotales || errorPuesto || errorRec) {
            throw new Error('Error obteniendo estadísticas');
        }

        // Procesar y devolver estadísticas
        return {
            totalCandidatos: totales?.length || 0,
            completados: totales?.filter(c => c.estado === 'completado').length || 0,
            pendientes: totales?.filter(c => c.estado === 'pendiente').length || 0,
            porPuesto: this.agruparPorCampo(porPuesto, 'puesto'),
            porRecomendacion: this.agruparPorCampo(recomendaciones, 'recomendacion')
        };
    }

    /**
     * Helper para agrupar datos
     */
    agruparPorCampo(datos, campo) {
        const agrupado = {};
        datos?.forEach(item => {
            const valor = item[campo];
            agrupado[valor] = (agrupado[valor] || 0) + 1;
        });
        return agrupado;
    }
}

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SupabaseService, initSupabase };
}