const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const encryptionKey = process.env.SETTINGS_ENCRYPTION_KEY || 'default-key-change-in-production';

// Crear cliente Supabase
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // Headers CORS estándar
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Manejar preflight OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS OK' })
    };
  }

  try {
    // Verificar variables de entorno
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variables de entorno de Supabase faltantes');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Error de configuración del servidor',
          message: 'Variables de entorno no configuradas'
        })
      };
    }

    const { httpMethod, path, body: requestBody } = event;
    const queryParams = event.queryStringParameters || {};

    // Parsear body si existe
    let parsedBody = {};
    if (requestBody) {
      try {
        parsedBody = JSON.parse(requestBody);
      } catch (e) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'JSON inválido en el cuerpo de la petición' })
        };
      }
    }

    // Routing basado en método HTTP y parámetros
    switch (httpMethod) {
      case 'GET':
        return await handleGetSettings(queryParams);

      case 'POST':
        return await handleCreateOrUpdateSettings(parsedBody, 'create');

      case 'PUT':
        return await handleCreateOrUpdateSettings(parsedBody, 'update');

      case 'DELETE':
        return await handleDeleteSettings(queryParams);

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Método HTTP no permitido' })
        };
    }

  } catch (error) {
    console.error('❌ Error en settings-manager:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error interno del servidor',
        message: error.message
      })
    };
  }
};

// =============================================
// FUNCIONES DE MANEJO
// =============================================

/**
 * Manejar peticiones GET - Obtener configuraciones
 * Query params:
 * - seccion: filtrar por sección
 * - clave: obtener configuración específica
 * - incluir_sensibles: incluir configuraciones sensibles (solo admin)
 * - incluir_historial: incluir historial de cambios
 */
async function handleGetSettings(queryParams) {
  try {
    const { seccion, clave, incluir_sensibles, incluir_historial, formato } = queryParams;

    let query = supabase.from('configuracion').select('*');

    // Filtros
    if (seccion) {
      query = query.eq('seccion', seccion);
    }

    if (clave) {
      query = query.eq('clave', clave);
    }

    // Excluir configuraciones sensibles por defecto
    if (!incluir_sensibles || incluir_sensibles !== 'true') {
      query = query.eq('es_sensible', false);
    }

    // Ordenar por sección y clave
    query = query.order('seccion').order('clave');

    const { data: configuraciones, error } = await query;

    if (error) {
      console.error('❌ Error obteniendo configuraciones:', error);
      throw error;
    }

    // Desencriptar valores sensibles si se incluyen
    if (incluir_sensibles === 'true') {
      configuraciones.forEach(config => {
        if (config.valor_encriptado && config.es_sensible) {
          try {
            config.valor = decryptValue(config.valor);
          } catch (e) {
            console.error('❌ Error desencriptando valor:', config.clave);
            config.valor = ''; // Valor vacío si no se puede desencriptar
          }
        }
      });
    }

    // Obtener historial si se solicita
    let historial = null;
    if (incluir_historial === 'true' && clave && seccion) {
      const configId = configuraciones.find(c => c.seccion === seccion && c.clave === clave)?.id;
      if (configId) {
        const { data: historialData } = await supabase
          .from('configuracion_historial')
          .select('*')
          .eq('configuracion_id', configId)
          .order('created_at', { ascending: false })
          .limit(10);

        historial = historialData || [];
      }
    }

    // Formatear respuesta según el formato solicitado
    let responseData;
    if (formato === 'grouped') {
      // Agrupar por sección
      responseData = groupBySection(configuraciones);
    } else if (formato === 'flat') {
      // Formato plano: seccion.clave -> valor
      responseData = flattenSettings(configuraciones);
    } else {
      // Formato completo (default)
      responseData = configuraciones;
    }

    const response = {
      success: true,
      data: responseData,
      total: configuraciones.length,
      filtros: { seccion, clave, incluir_sensibles, incluir_historial },
      timestamp: new Date().toISOString()
    };

    if (historial) {
      response.historial = historial;
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('❌ Error en handleGetSettings:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Error obteniendo configuraciones',
        message: error.message
      })
    };
  }
}

/**
 * Manejar peticiones POST/PUT - Crear o actualizar configuraciones
 */
async function handleCreateOrUpdateSettings(body, operation) {
  try {
    const { configuraciones, usuario, razon_cambio, validar_esquema } = body;

    if (!configuraciones || !Array.isArray(configuraciones)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Se requiere un array de configuraciones',
          ejemplo: {
            configuraciones: [
              {
                seccion: 'empresa',
                clave: 'nombre',
                valor: 'Mi Empresa',
                descripcion: 'Nombre de la empresa'
              }
            ],
            usuario: 'admin@empresa.com',
            razon_cambio: 'Actualización inicial'
          }
        })
      };
    }

    const resultados = [];
    const errores = [];

    for (const config of configuraciones) {
      try {
        // Validar configuración
        const validationResult = validateConfigurationItem(config);
        if (!validationResult.isValid) {
          errores.push({
            seccion: config.seccion,
            clave: config.clave,
            error: validationResult.errors
          });
          continue;
        }

        // Procesar valor (encriptar si es necesario)
        let valorProcesado = config.valor;
        let esEncriptado = false;

        if (config.es_sensible && config.tipo_dato === 'encrypted') {
          valorProcesado = encryptValue(config.valor);
          esEncriptado = true;
        }

        // Preparar datos para inserción/actualización
        const configData = {
          seccion: config.seccion,
          clave: config.clave,
          valor: valorProcesado,
          valor_encriptado: esEncriptado,
          tipo_dato: config.tipo_dato || 'json',
          descripcion: config.descripcion || '',
          es_sistema: config.es_sistema || false,
          es_sensible: config.es_sensible || false,
          version: config.version || 1,
          actualizado_por: usuario || 'sistema',
          updated_at: new Date().toISOString()
        };

        let result;
        if (operation === 'create') {
          // Crear nueva configuración
          const { data, error } = await supabase
            .from('configuracion')
            .insert(configData)
            .select()
            .single();

          result = { data, error };
        } else {
          // Actualizar configuración existente
          const { data, error } = await supabase
            .from('configuracion')
            .update(configData)
            .eq('seccion', config.seccion)
            .eq('clave', config.clave)
            .select()
            .single();

          result = { data, error };
        }

        if (result.error) {
          errores.push({
            seccion: config.seccion,
            clave: config.clave,
            error: result.error.message
          });
        } else {
          resultados.push({
            seccion: config.seccion,
            clave: config.clave,
            id: result.data.id,
            status: operation === 'create' ? 'creado' : 'actualizado'
          });
        }

      } catch (error) {
        errores.push({
          seccion: config.seccion,
          clave: config.clave,
          error: error.message
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        operation,
        procesados: resultados.length,
        errores: errores.length,
        resultados,
        errores: errores.length > 0 ? errores : undefined,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Error en handleCreateOrUpdateSettings:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Error procesando configuraciones',
        message: error.message
      })
    };
  }
}

/**
 * Manejar peticiones DELETE - Eliminar configuraciones
 */
async function handleDeleteSettings(queryParams) {
  try {
    const { seccion, clave } = queryParams;

    if (!seccion || !clave) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Se requieren parámetros: seccion y clave'
        })
      };
    }

    // Verificar que no sea configuración del sistema
    const { data: configCheck } = await supabase
      .from('configuracion')
      .select('es_sistema')
      .eq('seccion', seccion)
      .eq('clave', clave)
      .single();

    if (configCheck?.es_sistema) {
      return {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'No se puede eliminar configuración del sistema'
        })
      };
    }

    // Eliminar configuración
    const { error } = await supabase
      .from('configuracion')
      .delete()
      .eq('seccion', seccion)
      .eq('clave', clave);

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: `Configuración ${seccion}.${clave} eliminada`,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Error en handleDeleteSettings:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Error eliminando configuración',
        message: error.message
      })
    };
  }
}

// =============================================
// FUNCIONES UTILITARIAS
// =============================================

/**
 * Validar item de configuración
 */
function validateConfigurationItem(config) {
  const errors = [];

  if (!config.seccion) errors.push('seccion es requerida');
  if (!config.clave) errors.push('clave es requerida');
  if (config.valor === undefined || config.valor === null) errors.push('valor es requerido');

  // Validar tipo de dato
  const tiposValidos = ['string', 'number', 'boolean', 'json', 'encrypted'];
  if (config.tipo_dato && !tiposValidos.includes(config.tipo_dato)) {
    errors.push(`tipo_dato debe ser uno de: ${tiposValidos.join(', ')}`);
  }

  // Validar valor según tipo
  if (config.tipo_dato === 'number' && isNaN(Number(config.valor))) {
    errors.push('valor debe ser un número válido');
  }

  if (config.tipo_dato === 'boolean' && typeof config.valor !== 'boolean') {
    errors.push('valor debe ser true o false');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Agrupar configuraciones por sección
 */
function groupBySection(configuraciones) {
  const grouped = {};

  configuraciones.forEach(config => {
    if (!grouped[config.seccion]) {
      grouped[config.seccion] = {};
    }
    grouped[config.seccion][config.clave] = {
      valor: config.valor,
      descripcion: config.descripcion,
      tipo_dato: config.tipo_dato,
      es_sistema: config.es_sistema,
      es_sensible: config.es_sensible,
      updated_at: config.updated_at
    };
  });

  return grouped;
}

/**
 * Aplanar configuraciones a formato clave-valor simple
 */
function flattenSettings(configuraciones) {
  const flattened = {};

  configuraciones.forEach(config => {
    const key = `${config.seccion}.${config.clave}`;
    flattened[key] = config.valor;
  });

  return flattened;
}

/**
 * Encriptar valor sensible
 */
function encryptValue(value) {
  try {
    const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
    let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('❌ Error encriptando valor:', error);
    throw new Error('Error en encriptación');
  }
}

/**
 * Desencriptar valor sensible
 */
function decryptValue(encryptedValue) {
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
    let decrypted = decipher.update(encryptedValue, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('❌ Error desencriptando valor:', error);
    throw new Error('Error en desencriptación');
  }
}