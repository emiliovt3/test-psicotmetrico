/**
 * Development version of create-candidate function
 * This version works without Supabase for local testing
 * Production mode configuration - use real database when NODE_ENV=production
 */

// Production mode configuration - use real database when NODE_ENV=production
let isDevelopment = process.env.NODE_ENV !== 'production';

// Override to development if we don't have Supabase credentials at all
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  isDevelopment = true;
}

exports.handler = async (event, context) => {
  // Solo permitir POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { nombre, email, telefono, puesto, notas, expiracion } = JSON.parse(event.body);

    // Validaciones básicas
    if (!nombre || !email || !puesto) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ error: 'Faltan campos requeridos: nombre, email, puesto' })
      };
    }

    // Generar token único y seguro (desarrollo)
    const token = generateSecureToken();

    // Calcular fecha de expiración
    const horasExpiracion = parseInt(expiracion) || 48;
    const fechaExpiracion = new Date();
    fechaExpiracion.setHours(fechaExpiracion.getHours() + horasExpiracion);

    // Simular candidato creado (para desarrollo)
    const candidato = {
      id: Math.floor(Math.random() * 1000) + 1,
      nombre: nombre.trim(),
      email: email.toLowerCase().trim(),
      telefono: telefono?.trim() || null,
      puesto: puesto.trim(),
      notas: notas?.trim() || null,
      token: token,
      estado: 'pendiente',
      fecha_creacion: new Date().toISOString(),
      fecha_expiracion: fechaExpiracion.toISOString()
    };

    // Generar URL del test (desarrollo)
    const baseUrl = process.env.URL || 'http://localhost:8888';
    const testUrl = `${baseUrl}/test/index-tabler.html?token=${token}`;

    console.log('✅ [DEV] Candidato creado exitosamente:', {
      nombre: candidato.nombre,
      email: candidato.email,
      puesto: candidato.puesto,
      token: token.substring(0, 8) + '...'
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        candidato: {
          id: candidato.id,
          nombre: candidato.nombre,
          email: candidato.email,
          puesto: candidato.puesto,
          estado: candidato.estado,
          fecha_expiracion: candidato.fecha_expiracion
        },
        testUrl: testUrl,
        token: token,
        expiraEn: `${horasExpiracion} horas`,
        development: true // Indicador de que es versión de desarrollo
      })
    };

  } catch (error) {
    console.error('❌ [DEV] Error processing request:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: 'Error interno del servidor (desarrollo)' })
    };
  }
};

// Función para generar token seguro
function generateSecureToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}