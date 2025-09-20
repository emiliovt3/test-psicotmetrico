const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Netlify Function: delete-candidate.js
 * Elimina un candidato y todos sus datos relacionados de la base de datos
 *
 * Method: DELETE
 * Path: /.netlify/functions/delete-candidate
 *
 * Body: {
 *   candidateId: string (UUID del candidato)
 * }
 *
 * Response: {
 *   success: boolean,
 *   message: string,
 *   deletedData?: object
 * }
 */

exports.handler = async (event, context) => {
  console.log('🗑️ Delete Candidate - Inicio de función');

  // Configurar headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Manejar preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight' })
    };
  }

  // Validar método HTTP
  if (event.httpMethod !== 'DELETE') {
    console.log('❌ Método no permitido:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Método no permitido. Use DELETE.'
      })
    };
  }

  try {
    // Parsear body de la request
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.log('❌ Error parseando JSON:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'JSON inválido en el cuerpo de la petición'
        })
      };
    }

    // Validar parámetros requeridos
    const { candidateId } = requestBody;

    if (!candidateId) {
      console.log('❌ Falta candidateId');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Se requiere candidateId'
        })
      };
    }

    // Validar formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(candidateId)) {
      console.log('❌ Formato de UUID inválido:', candidateId);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Formato de candidateId inválido'
        })
      };
    }

    console.log('🔍 Buscando candidato:', candidateId);

    // 1. Verificar que el candidato existe
    const { data: candidato, error: candidatoError } = await supabase
      .from('candidatos')
      .select('id, nombre, email, puesto, estado')
      .eq('id', candidateId)
      .single();

    if (candidatoError) {
      console.log('❌ Error buscando candidato:', candidatoError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Candidato no encontrado'
        })
      };
    }

    if (!candidato) {
      console.log('❌ Candidato no existe:', candidateId);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Candidato no encontrado'
        })
      };
    }

    console.log('✅ Candidato encontrado:', candidato.nombre);

    // 2. Eliminar datos relacionados en el orden correcto
    // (Las foreign keys con CASCADE deberían manejar esto automáticamente,
    // pero lo hacemos explícitamente para mayor control)

    let deletedData = {
      candidato: candidato,
      respuestas: null,
      resultados: null
    };

    // Eliminar respuestas
    const { data: respuestasEliminadas, error: respuestasError } = await supabase
      .from('respuestas')
      .delete()
      .eq('candidato_id', candidateId)
      .select();

    if (respuestasError) {
      console.log('⚠️ Error eliminando respuestas (puede no existir):', respuestasError);
    } else {
      deletedData.respuestas = respuestasEliminadas;
      console.log('✅ Respuestas eliminadas:', respuestasEliminadas?.length || 0);
    }

    // Eliminar resultados
    const { data: resultadosEliminados, error: resultadosError } = await supabase
      .from('resultados')
      .delete()
      .eq('candidato_id', candidateId)
      .select();

    if (resultadosError) {
      console.log('⚠️ Error eliminando resultados (puede no existir):', resultadosError);
    } else {
      deletedData.resultados = resultadosEliminados;
      console.log('✅ Resultados eliminados:', resultadosEliminados?.length || 0);
    }

    // 3. Finalmente eliminar el candidato
    const { error: candidatoDeleteError } = await supabase
      .from('candidatos')
      .delete()
      .eq('id', candidateId);

    if (candidatoDeleteError) {
      console.log('❌ Error eliminando candidato:', candidatoDeleteError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Error eliminando candidato de la base de datos'
        })
      };
    }

    console.log('✅ Candidato eliminado exitosamente:', candidato.nombre);

    // Registrar actividad de auditoría
    try {
      await supabase
        .from('configuracion')
        .upsert({
          seccion: 'audit_log',
          clave: `delete_candidate_${Date.now()}`,
          valor: {
            action: 'delete_candidate',
            candidateId: candidateId,
            candidateName: candidato.nombre,
            candidateEmail: candidato.email,
            deletedAt: new Date().toISOString(),
            deletedData: {
              respuestas: deletedData.respuestas?.length || 0,
              resultados: deletedData.resultados?.length || 0
            }
          },
          es_sistema: true,
          descripcion: `Candidato ${candidato.nombre} eliminado del sistema`
        });
    } catch (auditError) {
      console.log('⚠️ Error guardando log de auditoría:', auditError);
      // No fallar la operación por esto
    }

    // Respuesta exitosa
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Candidato "${candidato.nombre}" eliminado exitosamente`,
        deletedData: {
          candidato: candidato,
          respuestasEliminadas: deletedData.respuestas?.length || 0,
          resultadosEliminados: deletedData.resultados?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('❌ Error inesperado en delete-candidate:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};