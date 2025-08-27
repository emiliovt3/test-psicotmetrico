/**
 * Motor de Calificación Automática - Sistema de Evaluación Psicométrica
 * Detecta dishonestidad, evalúa competencias y genera recomendaciones
 * @version 2.0
 */

class ScoringEngine {
    constructor(respuestas) {
        this.respuestas = respuestas;
        this.resultado = {
            puntajes: {},
            perfilDISC: {},
            banderasRojas: [],
            puntajeTotal: 0,
            porcentaje: 0,
            recomendacion: '',
            detalles: {}
        };
    }

    // Mapeo CLEAVER a DISC según la documentación
    static CLEAVER_TO_DISC = {
        'A': { 0: 'S', 1: 'S', 2: 'S', 3: 'C', 4: 'C', 5: 'S', 6: 'C', 7: 'C', 8: 'C', 9: 'S' },
        'B': { 0: 'D', 1: 'D', 2: 'I', 3: 'I', 4: 'I', 5: 'I', 6: 'I', 7: 'S', 8: 'I', 9: 'C' },
        'C': { 0: 'I', 1: 'S', 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'I', 8: 'D', 9: 'D' },
        'D': { 0: 'C', 1: 'C', 2: 'C', 3: 'C', 4: 'S', 5: 'S', 6: 'S', 7: 'D', 8: 'S', 9: 'I' }
    };

    // Respuestas críticas que generan banderas rojas
    static BANDERAS_ROJAS = {
        situaciones: {
            1: 'A', // Acepta trabajo sin factura (evasión fiscal)
            4: 'A'  // Toma material sobrante (robo)
        },
        kostick: {
            5: ['TD', 'D'],  // Desacuerdo con normas de seguridad
            11: ['TD', 'D'], // No ayudaría a compañero lesionado
            13: ['TD', 'D']  // No devolvería material extra
        }
    };

    // Puntajes máximos por sección
    static PUNTAJES_MAXIMOS = {
        cleaver: 40,    // Perfil DISC ideal
        kostick: 30,    // Preferencias laborales
        situaciones: 25, // Ética y honestidad
        aptitudes: 27    // Conocimientos técnicos
    };

    /**
     * Ejecuta el proceso completo de calificación
     */
    calcular() {
        // 1. Verificar descalificadores automáticos
        if (this.detectarDescalificadores()) {
            this.resultado.recomendacion = 'RECHAZADO';
            this.resultado.razon = 'Descalificado por banderas rojas críticas';
            return this.resultado;
        }

        // 2. Calcular cada sección
        this.calcularCLEAVER();
        this.calcularKOSTICK();
        this.calcularSituaciones();
        this.calcularAptitudes();

        // 3. Calcular puntaje total
        this.calcularPuntajeTotal();

        // 4. Generar recomendación final
        this.generarRecomendacion();

        return this.resultado;
    }

    /**
     * Detecta descalificadores automáticos
     */
    detectarDescalificadores() {
        let descalificado = false;

        // Verificar situaciones críticas
        const situaciones = this.respuestas.situaciones || {};
        if (situaciones[1] === 'A') {
            this.resultado.banderasRojas.push({
                tipo: 'CRITICA',
                seccion: 'situaciones',
                pregunta: 1,
                descripcion: 'Acepta trabajo sin factura - Evasión fiscal'
            });
            descalificado = true;
        }
        if (situaciones[4] === 'A') {
            this.resultado.banderasRojas.push({
                tipo: 'CRITICA',
                seccion: 'situaciones',
                pregunta: 4,
                descripcion: 'Toma material sobrante sin permiso - Robo'
            });
            descalificado = true;
        }

        // Verificar Kostick críticas
        const kostick = this.respuestas.kostick || {};
        const preguntasCriticas = [5, 11, 13];
        
        preguntasCriticas.forEach(pregunta => {
            if (kostick[pregunta] === 'TD' || kostick[pregunta] === 'D') {
                const descripciones = {
                    5: 'No seguiría normas de seguridad',
                    11: 'No ayudaría a compañero lesionado',
                    13: 'No devolvería material extra'
                };
                this.resultado.banderasRojas.push({
                    tipo: 'CRITICA',
                    seccion: 'kostick',
                    pregunta: pregunta,
                    descripcion: descripciones[pregunta]
                });
                descalificado = true;
            }
        });

        return descalificado;
    }

    /**
     * Calcula perfil DISC desde CLEAVER
     */
    calcularCLEAVER() {
        const cleaver = this.respuestas.cleaver || {};
        const perfilDISC = { D: 0, I: 0, S: 0, C: 0 };
        
        // Contar selecciones MÁS
        Object.entries(cleaver).forEach(([pregunta, respuestas]) => {
            if (respuestas.mas && ScoringEngine.CLEAVER_TO_DISC[respuestas.mas]) {
                const indice = parseInt(pregunta) - 1;
                const letra = ScoringEngine.CLEAVER_TO_DISC[respuestas.mas][indice];
                if (letra) perfilDISC[letra]++;
            }
        });

        // Normalizar perfil (escala 0-10)
        Object.keys(perfilDISC).forEach(letra => {
            perfilDISC[letra] = Math.round((perfilDISC[letra] / 10) * 10);
        });

        this.resultado.perfilDISC = perfilDISC;

        // Calcular puntaje basado en perfil ideal (Alto S y C, Bajo D)
        const idealS = 8, idealC = 7, idealD = 3, idealI = 5;
        const diferenciaS = Math.abs(perfilDISC.S - idealS);
        const diferenciaC = Math.abs(perfilDISC.C - idealC);
        const diferenciaD = Math.abs(perfilDISC.D - idealD);
        const diferenciaI = Math.abs(perfilDISC.I - idealI);
        
        // Menor diferencia = mayor puntaje
        const puntajeDISC = ScoringEngine.PUNTAJES_MAXIMOS.cleaver - 
            (diferenciaS * 2 + diferenciaC * 2 + diferenciaD * 3 + diferenciaI * 1);
        
        this.resultado.puntajes.cleaver = Math.max(0, puntajeDISC);
        
        // Detectar problemas en el perfil
        if (perfilDISC.D > 6) {
            this.resultado.banderasRojas.push({
                tipo: 'ADVERTENCIA',
                seccion: 'cleaver',
                descripcion: 'Perfil muy dominante, puede tener problemas con autoridad'
            });
        }
        if (perfilDISC.S < 4) {
            this.resultado.banderasRojas.push({
                tipo: 'ADVERTENCIA',
                seccion: 'cleaver',
                descripcion: 'Baja estabilidad, puede tener problemas con rutinas'
            });
        }
    }

    /**
     * Calcula puntaje KOSTICK
     */
    calcularKOSTICK() {
        const kostick = this.respuestas.kostick || {};
        let puntaje = ScoringEngine.PUNTAJES_MAXIMOS.kostick;
        
        // Valor de cada respuesta
        const valores = {
            'TA': 2,  // Totalmente de Acuerdo
            'A': 1,   // De Acuerdo
            'N': 0,   // Neutral
            'D': -1,  // En Desacuerdo
            'TD': -2  // Totalmente en Desacuerdo
        };

        // Preguntas positivas (acuerdo es bueno)
        const preguntasPositivas = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15];
        
        // Pregunta 7 es negativa (desacuerdo es bueno)
        const preguntasNegativas = [7];

        preguntasPositivas.forEach(num => {
            const respuesta = kostick[num];
            if (respuesta === 'D' || respuesta === 'TD') {
                puntaje -= 2;
            }
        });

        preguntasNegativas.forEach(num => {
            const respuesta = kostick[num];
            if (respuesta === 'A' || respuesta === 'TA') {
                puntaje -= 2;
                this.resultado.banderasRojas.push({
                    tipo: 'ADVERTENCIA',
                    seccion: 'kostick',
                    pregunta: num,
                    descripcion: 'Prefiere trabajar solo, puede afectar trabajo en equipo'
                });
            }
        });

        this.resultado.puntajes.kostick = Math.max(0, puntaje);
    }

    /**
     * Calcula puntaje de situaciones laborales
     */
    calcularSituaciones() {
        const situaciones = this.respuestas.situaciones || {};
        let puntaje = ScoringEngine.PUNTAJES_MAXIMOS.situaciones;
        
        // Respuestas correctas/éticas
        const respuestasCorrectas = {
            1: 'B', // Rechazar trabajo sin factura
            2: 'B', // Reportar herramienta dañada
            3: 'B', // Rechazar préstamo personal de cliente
            4: 'B', // No tomar material sobrante
            5: 'A'  // Reportar accidente inmediatamente
        };

        Object.entries(respuestasCorrectas).forEach(([pregunta, correcta]) => {
            if (situaciones[pregunta] !== correcta) {
                puntaje -= 5;
                
                // Advertencias adicionales para respuestas incorrectas no críticas
                if (pregunta !== '1' && pregunta !== '4') {
                    this.resultado.banderasRojas.push({
                        tipo: 'ADVERTENCIA',
                        seccion: 'situaciones',
                        pregunta: parseInt(pregunta),
                        descripcion: `Respuesta no ética en situación ${pregunta}`
                    });
                }
            }
        });

        this.resultado.puntajes.situaciones = Math.max(0, puntaje);
    }

    /**
     * Calcula puntaje de aptitudes técnicas
     */
    calcularAptitudes() {
        const aptitudes = this.respuestas.aptitudes || {};
        let puntajeTotal = 0;
        
        // Cada pregunta vale hasta 2.25 puntos (27 total / 12 preguntas)
        const puntajePorPregunta = ScoringEngine.PUNTAJES_MAXIMOS.aptitudes / 12;
        
        Object.entries(aptitudes).forEach(([pregunta, nivel]) => {
            const nivelNum = parseInt(nivel) || 0;
            // Escala: 0=0%, 1=25%, 2=50%, 3=75%, 4=100% del puntaje
            const porcentaje = nivelNum / 4;
            puntajeTotal += puntajePorPregunta * porcentaje;
            
            // Detectar deficiencias técnicas
            if (nivelNum < 2) {
                this.resultado.banderasRojas.push({
                    tipo: 'INFORMATIVA',
                    seccion: 'aptitudes',
                    pregunta: parseInt(pregunta),
                    descripcion: `Conocimiento técnico bajo en pregunta ${pregunta}`
                });
            }
        });

        this.resultado.puntajes.aptitudes = Math.round(puntajeTotal * 10) / 10;
    }

    /**
     * Calcula el puntaje total y porcentaje
     */
    calcularPuntajeTotal() {
        const puntajes = this.resultado.puntajes;
        
        // Sumar todos los puntajes
        this.resultado.puntajeTotal = 
            (puntajes.cleaver || 0) +
            (puntajes.kostick || 0) +
            (puntajes.situaciones || 0) +
            (puntajes.aptitudes || 0);
        
        // Calcular porcentaje del total posible (122 puntos)
        const totalMaximo = Object.values(ScoringEngine.PUNTAJES_MAXIMOS).reduce((a, b) => a + b, 0);
        this.resultado.porcentaje = Math.round((this.resultado.puntajeTotal / totalMaximo) * 100);
        
        // Agregar detalles de cálculo
        this.resultado.detalles = {
            maximosPorSeccion: ScoringEngine.PUNTAJES_MAXIMOS,
            puntajeMaximoTotal: totalMaximo,
            puntajesObtenidos: puntajes,
            totalBanderasRojas: this.resultado.banderasRojas.length,
            banderasCriticas: this.resultado.banderasRojas.filter(b => b.tipo === 'CRITICA').length
        };
    }

    /**
     * Genera la recomendación final basada en el puntaje
     */
    generarRecomendacion() {
        const porcentaje = this.resultado.porcentaje;
        const banderasCriticas = this.resultado.banderasRojas.filter(b => b.tipo === 'CRITICA').length;
        
        // Si hay banderas críticas, rechazar automáticamente
        if (banderasCriticas > 0) {
            this.resultado.recomendacion = 'RECHAZADO';
            this.resultado.nivelRiesgo = 'ALTO';
            this.resultado.mensaje = 'Candidato presenta comportamientos no éticos críticos';
            return;
        }
        
        // Recomendación basada en porcentaje
        if (porcentaje >= 80) {
            this.resultado.recomendacion = 'CONTRATAR';
            this.resultado.nivelRiesgo = 'BAJO';
            this.resultado.mensaje = 'Excelente candidato, cumple todos los criterios';
        } else if (porcentaje >= 65) {
            this.resultado.recomendacion = 'CONTRATAR_CON_RESERVAS';
            this.resultado.nivelRiesgo = 'MEDIO-BAJO';
            this.resultado.mensaje = 'Buen candidato, considerar periodo de prueba extendido';
        } else if (porcentaje >= 50) {
            this.resultado.recomendacion = 'SEGUNDA_ENTREVISTA';
            this.resultado.nivelRiesgo = 'MEDIO';
            this.resultado.mensaje = 'Candidato requiere evaluación adicional';
        } else {
            this.resultado.recomendacion = 'RECHAZADO';
            this.resultado.nivelRiesgo = 'ALTO';
            this.resultado.mensaje = 'Candidato no cumple con los requisitos mínimos';
        }
        
        // Agregar interpretación del perfil DISC
        this.interpretarPerfilDISC();
    }

    /**
     * Interpreta el perfil DISC y agrega insights
     */
    interpretarPerfilDISC() {
        const perfil = this.resultado.perfilDISC;
        const insights = [];
        
        // Determinar el tipo dominante
        const tiposDominantes = Object.entries(perfil)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([tipo, valor]) => tipo);
        
        this.resultado.tipoDISC = tiposDominantes.join('');
        
        // Interpretaciones por tipo
        if (perfil.D > 6) insights.push('Tendencia a ser dominante y directo');
        if (perfil.I > 6) insights.push('Buenas habilidades sociales y comunicación');
        if (perfil.S > 6) insights.push('Estable, confiable y orientado al equipo');
        if (perfil.C > 6) insights.push('Detallista, preciso y sigue normas');
        
        if (perfil.D < 4) insights.push('Puede tener dificultad tomando decisiones rápidas');
        if (perfil.I < 4) insights.push('Prefiere trabajar de forma independiente');
        if (perfil.S < 4) insights.push('Puede tener problemas con tareas rutinarias');
        if (perfil.C < 4) insights.push('Puede ser menos detallista o descuidado');
        
        this.resultado.insightsDISC = insights;
    }

    /**
     * Genera un resumen ejecutivo del candidato
     */
    generarResumenEjecutivo() {
        return {
            recomendacion: this.resultado.recomendacion,
            puntajeTotal: `${this.resultado.puntajeTotal}/122`,
            porcentaje: `${this.resultado.porcentaje}%`,
            perfilDISC: this.resultado.tipoDISC,
            banderasRojas: this.resultado.banderasRojas.length,
            fortalezas: this.identificarFortalezas(),
            debilidades: this.identificarDebilidades(),
            riesgoContratacion: this.resultado.nivelRiesgo
        };
    }

    /**
     * Identifica las fortalezas del candidato
     */
    identificarFortalezas() {
        const fortalezas = [];
        const puntajes = this.resultado.puntajes;
        const maximos = ScoringEngine.PUNTAJES_MAXIMOS;
        
        // Evaluar cada sección
        if (puntajes.cleaver / maximos.cleaver > 0.8) {
            fortalezas.push('Perfil comportamental ideal para el puesto');
        }
        if (puntajes.kostick / maximos.kostick > 0.8) {
            fortalezas.push('Excelentes actitudes laborales');
        }
        if (puntajes.situaciones / maximos.situaciones > 0.9) {
            fortalezas.push('Alta integridad y ética laboral');
        }
        if (puntajes.aptitudes / maximos.aptitudes > 0.7) {
            fortalezas.push('Buenos conocimientos técnicos');
        }
        
        // Fortalezas por perfil DISC
        const perfil = this.resultado.perfilDISC;
        if (perfil.S > 7) fortalezas.push('Alta estabilidad y confiabilidad');
        if (perfil.C > 7) fortalezas.push('Orientado a calidad y normas');
        
        return fortalezas;
    }

    /**
     * Identifica las debilidades del candidato
     */
    identificarDebilidades() {
        const debilidades = [];
        const puntajes = this.resultado.puntajes;
        const maximos = ScoringEngine.PUNTAJES_MAXIMOS;
        
        // Evaluar cada sección
        if (puntajes.cleaver / maximos.cleaver < 0.5) {
            debilidades.push('Perfil comportamental no alineado');
        }
        if (puntajes.kostick / maximos.kostick < 0.5) {
            debilidades.push('Actitudes laborales cuestionables');
        }
        if (puntajes.situaciones / maximos.situaciones < 0.6) {
            debilidades.push('Posibles problemas éticos');
        }
        if (puntajes.aptitudes / maximos.aptitudes < 0.5) {
            debilidades.push('Conocimientos técnicos insuficientes');
        }
        
        // Debilidades por perfil DISC
        const perfil = this.resultado.perfilDISC;
        if (perfil.D > 7) debilidades.push('Puede tener conflictos con autoridad');
        if (perfil.S < 4) debilidades.push('Baja tolerancia a rutinas');
        
        // Agregar banderas rojas como debilidades
        const banderasCriticas = this.resultado.banderasRojas
            .filter(b => b.tipo === 'CRITICA')
            .map(b => b.descripcion);
        
        debilidades.push(...banderasCriticas);
        
        return debilidades;
    }
}

// Exportar para uso en Node.js o browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScoringEngine;
}