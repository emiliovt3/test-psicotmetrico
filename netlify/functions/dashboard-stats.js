const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

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
    // Verificar variables de entorno
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variables de entorno faltantes');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Error de configuración',
          message: 'Variables de entorno de Supabase no configuradas'
        })
      };
    }

    // Crear cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const stats = {
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
      }
    };

    console.log('✅ Estadísticas calculadas:', {
      total: totalCandidatos,
      completados: completados,
      tasa: tasaAprobacion + '%'
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