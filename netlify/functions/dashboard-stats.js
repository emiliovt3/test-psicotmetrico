// Production mode configuration - use real database when NODE_ENV=production
let isDevelopment = process.env.NODE_ENV !== 'production';

// Override to development if we don't have Supabase credentials at all
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  isDevelopment = true;
}

console.log('🔍 Environment check:', {
  hasUrl: !!process.env.SUPABASE_URL,
  hasKey: !!process.env.SUPABASE_SERVICE_KEY,
  nodeEnv: process.env.NODE_ENV,
  isDevelopment: isDevelopment,
  url: process.env.SUPABASE_URL?.substring(0, 20) + '...'
});

let supabase = null;
if (!isDevelopment) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    console.log('✅ Supabase client initialized for production');
  } catch (error) {
    console.warn('⚠️ Could not initialize Supabase client, falling back to development mode');
    isDevelopment = true;
  }
}

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Manejar preflight OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'OK' })
    };
  }

  // Solo GET permitido
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        error: 'Método no permitido',
        message: 'Solo GET es permitido para este endpoint'
      })
    };
  }

  try {
    let stats;

    if (isDevelopment) {
      // Modo desarrollo - estadísticas simuladas
      console.log('🚧 [DEV MODE] Generando estadísticas simuladas sin base de datos');
      stats = {
        total_evaluaciones: 15,
        completadas_hoy: 3,
        completadas_semana: 8,
        completadas_mes: 15,
        pendientes: 5,
        en_progreso: 2,
        tasa_aprobacion: 73,
        puntaje_promedio: 76,
        evaluaciones_recientes: [
          {
            id: 1,
            nombre: "María González",
            puesto: "Soldador",
            fecha_creacion: new Date(Date.now() - 2*60*60*1000).toISOString(),
            estado: "completado",
            porcentaje: 85
          },
          {
            id: 2,
            nombre: "Carlos Ruiz",
            puesto: "Electricista",
            fecha_creacion: new Date(Date.now() - 4*60*60*1000).toISOString(),
            estado: "completado",
            porcentaje: 72
          },
          {
            id: 3,
            nombre: "Ana López",
            puesto: "Soldador",
            fecha_creacion: new Date(Date.now() - 6*60*60*1000).toISOString(),
            estado: "en_progreso",
            porcentaje: null
          }
        ],
        distribucion_estados: {
          completado: 8,
          en_progreso: 2,
          pendiente: 5
        },
        distribucion_recomendaciones: {
          contratar: 4,
          contratar_con_reservas: 2,
          segunda_entrevista: 1,
          rechazado: 1
        },
        development: true
      };
    } else {
      // Modo producción - datos reales de Supabase
      console.log('🔄 Obteniendo estadísticas del dashboard...');

      // Obtener estadísticas básicas
      const { data: candidatos, error: candidatosError } = await supabase
        .from('candidatos')
        .select('*');

      if (candidatosError) {
        console.error('❌ Error obteniendo candidatos:', candidatosError);
        throw candidatosError;
      }

      // Obtener resultados
      const { data: resultados, error: resultadosError } = await supabase
        .from('resultados')
        .select('*');

      if (resultadosError) {
        console.error('❌ Error obteniendo resultados:', resultadosError);
        throw resultadosError;
      }

      // Obtener evaluaciones recientes con joins
      const { data: evaluacionesRecientes, error: recientesError } = await supabase
        .from('vista_candidatos_completo')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (recientesError) {
        console.error('❌ Error obteniendo evaluaciones recientes:', recientesError);
        // No es un error crítico, continuar sin datos recientes
      }

      // Calcular estadísticas
      const totalCandidatos = candidatos.length;
      const completados = candidatos.filter(c => c.estado === 'completado').length;
      const enProgreso = candidatos.filter(c => c.estado === 'en_progreso').length;
      const pendientes = candidatos.filter(c => c.estado === 'pendiente').length;

      // Estadísticas por tiempo
      const ahora = new Date();
      const haceUnMes = new Date(ahora.getFullYear(), ahora.getMonth() - 1, ahora.getDate());
      const haceUnaSemana = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
      const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

      const completadosHoy = candidatos.filter(c => {
        const fecha = new Date(c.created_at);
        return c.estado === 'completado' && fecha >= hoy;
      }).length;

      const completadosSemana = candidatos.filter(c => {
        const fecha = new Date(c.created_at);
        return c.estado === 'completado' && fecha >= haceUnaSemana;
      }).length;

      const completadosMes = candidatos.filter(c => {
        const fecha = new Date(c.created_at);
        return c.estado === 'completado' && fecha >= haceUnMes;
      }).length;

      // Calcular tasa de aprobación
      const aprobados = resultados.filter(r =>
        r.recomendacion === 'CONTRATAR' || r.recomendacion === 'CONTRATAR_CON_RESERVAS'
      ).length;

      const tasaAprobacion = resultados.length > 0 ?
        Math.round((aprobados / resultados.length) * 100) : 0;

      // Calcular promedio de puntaje
      const puntajePromedio = resultados.length > 0 ?
        Math.round(resultados.reduce((sum, r) => sum + r.porcentaje, 0) / resultados.length) : 0;

      // Preparar respuesta
      stats = {
        total_evaluaciones: totalCandidatos,
        completadas_hoy: completadosHoy,
        completadas_semana: completadosSemana,
        completadas_mes: completadosMes,
        pendientes: pendientes,
        en_progreso: enProgreso,
        tasa_aprobacion: tasaAprobacion,
        puntaje_promedio: puntajePromedio,
        evaluaciones_recientes: evaluacionesRecientes || [],
        distribucion_estados: {
          completado: completados,
          en_progreso: enProgreso,
          pendiente: pendientes
        },
        distribucion_recomendaciones: {
          contratar: resultados.filter(r => r.recomendacion === 'CONTRATAR').length,
          contratar_con_reservas: resultados.filter(r => r.recomendacion === 'CONTRATAR_CON_RESERVAS').length,
          segunda_entrevista: resultados.filter(r => r.recomendacion === 'SEGUNDA_ENTREVISTA').length,
          rechazado: resultados.filter(r => r.recomendacion === 'RECHAZADO').length
        },
        development: false
      };
    }

    console.log(`✅ Estadísticas calculadas${isDevelopment ? ' (modo desarrollo)' : ''}:`, {
      total: stats.total_evaluaciones,
      completados: stats.distribucion_estados.completado,
      tasa: stats.tasa_aprobacion + '%',
      development: isDevelopment
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(stats)
    };

  } catch (error) {
    console.error('❌ Error en dashboard-stats:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error interno del servidor',
        message: 'Error obteniendo estadísticas del dashboard',
        details: error.message
      })
    };
  }
};