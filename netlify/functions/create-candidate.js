// Production mode configuration - use real database when NODE_ENV=production
let isDevelopment = process.env.NODE_ENV !== 'production';

// Override to development if we don't have Supabase credentials at all
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  isDevelopment = true;
}

let supabase = null;
if (!isDevelopment) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  } catch (error) {
    console.warn('⚠️ Could not initialize Supabase client, falling back to development mode');
    isDevelopment = true;
  }
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

    // Generar token único y seguro
    const token = generateSecureToken();

    // Calcular fecha de expiración
    const horasExpiracion = parseInt(expiracion) || 48;
    const fechaExpiracion = new Date();
    fechaExpiracion.setHours(fechaExpiracion.getHours() + horasExpiracion);

    let candidato;

    if (isDevelopment) {
      // Modo desarrollo - sin base de datos
      console.log('🚧 [DEV MODE] Simulando creación de candidato sin base de datos');
      candidato = {
        id: Math.floor(Math.random() * 1000) + 1,
        nombre: nombre.trim(),
        email: email.toLowerCase().trim(),
        telefono: telefono?.trim() || null,
        puesto: puesto.trim(),
        token: token,
        estado: 'pendiente',
        fecha_creacion: new Date().toISOString(),
        fecha_expiracion: fechaExpiracion.toISOString()
      };
    } else {
      // Modo producción - con Supabase
      // Verificar si ya existe un candidato con este email
      const { data: existingCandidate } = await supabase
        .from('candidatos')
        .select('id, estado, fecha_creacion')
        .eq('email', email)
        .single();

      if (existingCandidate) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type'
          },
          body: JSON.stringify({
            error: 'Ya existe un candidato con este email',
            existing: existingCandidate
          })
        };
      }

      // Crear candidato en la base de datos
      const { data, error } = await supabase
        .from('candidatos')
        .insert({
          nombre: nombre.trim(),
          email: email.toLowerCase().trim(),
          telefono: telefono?.trim() || null,
          puesto: puesto.trim(),
          token: token,
          estado: 'pendiente',
          fecha_creacion: new Date().toISOString(),
          fecha_expiracion: fechaExpiracion.toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating candidate:', error);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type'
          },
          body: JSON.stringify({ error: 'Error al crear candidato en la base de datos' })
        };
      }

      candidato = data;
    }

    // Generar URL del test
    const baseUrl = process.env.URL || (isDevelopment ? 'http://localhost:8888' : 'https://tu-sitio.netlify.app');
    const testUrl = `${baseUrl}/test/index-tabler.html?token=${token}`;

    console.log(`✅ Candidato creado${isDevelopment ? ' (modo desarrollo)' : ''}:`, {
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
        development: isDevelopment
      })
    };

  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: 'Error interno del servidor' })
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