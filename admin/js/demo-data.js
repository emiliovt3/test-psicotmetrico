/**
 * Demo Data Generator - Para pruebas locales sin backend
 * Este archivo simula datos para que puedas ver cómo funcionará el dashboard
 */

// Generar datos demo de candidatos
function generateDemoCandidates() {
    const nombres = ['Juan Pérez', 'María García', 'Carlos López', 'Ana Martínez', 'Pedro Rodríguez'];
    const puestos = ['Soldador', 'Electricista', 'Ayudante General'];
    const estados = ['completado', 'pendiente', 'en_progreso'];
    const candidates = [];

    for (let i = 0; i < 25; i++) {
        const estado = estados[Math.floor(Math.random() * estados.length)];
        const puntaje = estado === 'completado' ? Math.floor(Math.random() * 50) + 50 : null;
        
        candidates.push({
            id: i + 1,
            nombre: nombres[Math.floor(Math.random() * nombres.length)] + ' ' + (i + 1),
            email: `candidato${i + 1}@email.com`,
            puesto: puestos[Math.floor(Math.random() * puestos.length)],
            fecha: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            estado: estado,
            puntaje: puntaje,
            porcentaje: puntaje,
            perfil_disc: puntaje ? generateRandomDISC() : null,
            recomendacion: puntaje ? getRecomendacion(puntaje) : null
        });
    }
    return candidates;
}

// Generar perfil DISC aleatorio
function generateRandomDISC() {
    const valores = {
        D: Math.floor(Math.random() * 10),
        I: Math.floor(Math.random() * 10),
        S: Math.floor(Math.random() * 10),
        C: Math.floor(Math.random() * 10)
    };
    // Determinar tipo dominante
    const max = Math.max(valores.D, valores.I, valores.S, valores.C);
    let tipo = '';
    if (valores.D === max) tipo += 'D';
    if (valores.I === max && !tipo.includes('I')) tipo += 'I';
    if (valores.S === max && !tipo.includes('S')) tipo += 'S';
    if (valores.C === max && !tipo.includes('C')) tipo += 'C';
    
    return { ...valores, tipo: tipo };
}

// Obtener recomendación basada en puntaje
function getRecomendacion(puntaje) {
    if (puntaje >= 80) return 'CONTRATAR';
    if (puntaje >= 65) return 'CONTRATAR_CON_RESERVAS';
    if (puntaje >= 50) return 'SEGUNDA_ENTREVISTA';
    return 'RECHAZADO';
}

// Generar estadísticas demo
function generateDemoStats() {
    return {
        totalCandidatos: 156,
        completados: 124,
        pendientes: 20,
        enProgreso: 12,
        tasaAprobacion: 68,
        puntajePromedio: 72.4,
        porPuesto: {
            'Soldador': 45,
            'Electricista': 38,
            'Ayudante General': 41
        },
        porRecomendacion: {
            'CONTRATAR': 42,
            'CONTRATAR_CON_RESERVAS': 28,
            'SEGUNDA_ENTREVISTA': 35,
            'RECHAZADO': 19
        },
        tendenciaMensual: [
            { mes: 'Ene', evaluaciones: 18 },
            { mes: 'Feb', evaluaciones: 22 },
            { mes: 'Mar', evaluaciones: 25 },
            { mes: 'Abr', evaluaciones: 30 },
            { mes: 'May', evaluaciones: 28 },
            { mes: 'Jun', evaluaciones: 33 }
        ]
    };
}

// Simular carga de datos con delay
function loadDemoData(callback, delay = 500) {
    setTimeout(() => {
        callback();
    }, delay);
}

// Inicializar modo demo
function initDemoMode() {
    // Agregar badge de modo demo
    const navbar = document.querySelector('.navbar-brand');
    if (navbar && !document.querySelector('.demo-badge')) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-warning ms-2 demo-badge';
        badge.textContent = 'MODO DEMO';
        navbar.appendChild(badge);
    }
    
    // Mostrar mensaje
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Modo Demo Activado',
            html: `
                <p>Estás viendo el dashboard con datos de ejemplo.</p>
                <p>Para usar datos reales necesitas:</p>
                <ol class="text-start">
                    <li>Configurar Supabase</li>
                    <li>Configurar Netlify</li>
                    <li>Agregar las credenciales</li>
                </ol>
                <p>Consulta el archivo <code>SETUP.md</code> para más información.</p>
            `,
            icon: 'info',
            confirmButtonText: 'Entendido'
        });
    } else {
        console.log('🎭 MODO DEMO: Usando datos de ejemplo. Configura Supabase para datos reales.');
    }
}

// Exportar para uso global
window.DemoData = {
    generateCandidates: generateDemoCandidates,
    generateStats: generateDemoStats,
    generateDISC: generateRandomDISC,
    loadData: loadDemoData,
    initDemo: initDemoMode
};