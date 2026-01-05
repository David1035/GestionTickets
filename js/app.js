/* =========================================
   1. BASE DE DATOS (CONFIGURACIÓN)
   ========================================= */
const opcionesTiposervicio = {
    'HFC': ['Internet', 'Telefonía', 'TV_Digital', 'One_TV_2.0'],
    'GPON': ['Internet', 'IPTV', 'Telefonía', 'One_TV_2.0'],
    'REDCO': ['Internet', 'Telefonía', 'TV_Digital'],
    'ADSL': ['Internet', 'IPTV', 'Telefonía', 'One_TV_2.0']
};

const opcionesNaturaleza = {
    'Internet': ['No navega', 'Navegación Lenta', 'Servicio Intermitente', 'Problemas WiFi', 'Configuracion WIFI', 'Cambio de Clave'],
    'Telefonía': ['No funciona línea', 'Servicio Intermitente', 'Mala Calidad Voz', 'Entrecortada', 'No salen/entran llamadas'],
    'TV_Digital': ['Sin señal', 'Pixelada', 'Error código', 'Fallas audio', 'Control remoto', 'Paquetes adicionales'],
    'IPTV': ['Sin señal', 'Pantalla Negra', 'Error de carga', 'Fallas audio', 'Control remoto'],
    'One_TV_2.0': ['Sin señal', 'DRM falló', 'Imagen congelada', 'Error de descarga', 'Comando de voz', 'App One TV falla']
};

/* =========================================
   2. VARIABLES Y ESTADO
   ========================================= */
let horaInicioLlamada = null; 

// Variables del Temporizador
let timerRetoma = null;
let retomaStartTime = null;
let primeraAlarmaSonada = false;
let proximaAlarmaSegundos = 5;

// Métricas y Persistencia
let ahtDiario = JSON.parse(localStorage.getItem('aht_diario')) || { segundos: 0, llamadas: 0, fecha: new Date().toLocaleDateString() };
let ahtMensual = JSON.parse(localStorage.getItem('aht_mensual')) || { segundos: 0, llamadas: 0 };
let historialLlamadas = JSON.parse(localStorage.getItem('historial_llamadas')) || [];
let mesGuardado = localStorage.getItem('mes_actual') || new Date().toISOString().slice(0, 7);

// DOM Elements (Selectores principales)
const callIdInput = document.getElementById('call_id');
const techInput = document.getElementById('tech_input');
const prodInput = document.getElementById('prod_input');
const failInput = document.getElementById('fail_input');
const obsTextarea = document.getElementById('observaciones');

const techList = document.getElementById('tech_options');
const prodList = document.getElementById('prod_options');
const failList = document.getElementById('fail_options');

const radiosB2B = document.querySelectorAll('input[name="b2b_option"]');
const panelB2B = document.getElementById('b2b_panel');

/* =========================================
   3. FUNCIONES DE UTILIDAD Y SONIDO
   ========================================= */

// Llenar listas desplegables
function llenarDatalist(datalistElement, arrayOpciones) {
    if (!datalistElement) return;
    datalistElement.innerHTML = ''; 
    if (!arrayOpciones) return;
    arrayOpciones.forEach(opcion => {
        const optionTag = document.createElement('option');
        optionTag.value = opcion;
        datalistElement.appendChild(optionTag);
    });
}

// Formato de tiempo visual
function formatearDual(segundos) {
    const totalSeg = Math.round(segundos);
    const m = Math.floor(totalSeg / 60).toString().padStart(2, '0');
    const s = (totalSeg % 60).toString().padStart(2, '0');
    return `${totalSeg}s / ${m}.${s}m`;
}

// --- SONIDO MEJORADO (SUAVE/ZEN) ---
function sonarAlertaRetoma() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine'; 
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // Nota Do (C5) - Agradable

    // Efecto Fade-In y Fade-Out para que no golpee el oído
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1); 
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 1.5);
    setTimeout(() => audioCtx.close(), 1600);
}

/* =========================================
   4. LÓGICA DEL TEMPORIZADOR (MOTOR DE TIEMPO)
   ========================================= */
function gestionarTimerRetoma(esReinicioManual = false) {
    // 1. Limpiar cualquier conteo previo
    if (timerRetoma) clearInterval(timerRetoma);

    retomaStartTime = Date.now();
    
    if (esReinicioManual) {
        // Si presionamos "Modificar", saltamos directo al ciclo de 115s
        primeraAlarmaSonada = true; 
        proximaAlarmaSegundos = 115;
        console.log("🔄 Reinicio manual (Modificar): Alarma programada en 1:55 min");
    } else {
        // Inicio automático por llamada: Primero 45s
        primeraAlarmaSonada = false;
        proximaAlarmaSegundos = 45;
        console.log("⏱️ Inicio automático: Primera alarma en 45s");
    }

    // 2. Iniciar el intervalo
    timerRetoma = setInterval(() => {
        const segundosTranscurridos = Math.floor((Date.now() - retomaStartTime) / 1000);

        if (segundosTranscurridos >= proximaAlarmaSegundos) {
            sonarAlertaRetoma(); // ¡Sonido Suave!

            if (!primeraAlarmaSonada) {
                // Transición: De los 45s pasamos a los 115s
                primeraAlarmaSonada = true;
                proximaAlarmaSegundos = segundosTranscurridos + 115;
            } else {
                // Ciclo Infinito: Sumamos 115s cada vez
                proximaAlarmaSegundos += 115;
            }
        }
    }, 1000);
}

/* =========================================
   5. INPUTS INTELIGENTES (AUTOCOMPLETE CON TAB)
   ========================================= */
function configurarInputInteligente(inputElement, dataListId) {
    if (!inputElement) return;

    // A. Comportamiento visual (Ver lista al hacer clic)
    inputElement.addEventListener('focus', function() {
        this.dataset.oldValue = this.value; 
        this.value = ''; // Limpia para mostrar opciones
    });

    inputElement.addEventListener('blur', function() {
        if (this.value === '') {
            this.value = this.dataset.oldValue || ''; // Restaura si no eligió nada
        }
    });

    // B. Autocompletado con TECLA TABulador
    inputElement.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            const val = this.value.toLowerCase();
            const dataList = document.getElementById(dataListId);
            
            if (val && dataList) {
                // Buscar coincidencia en la lista
                const opciones = Array.from(dataList.options);
                const coincidencia = opciones.find(opt => opt.value.toLowerCase().startsWith(val));

                if (coincidencia) {
                    // Rellenar el input con el valor correcto
                    this.value = coincidencia.value;
                    // Disparar evento 'change' para que se activen las cascadas (Tecnología -> Producto)
                    this.dispatchEvent(new Event('change'));
                }
            }
        }
    });
}

// Aplicar la inteligencia a los inputs
configurarInputInteligente(techInput, 'tech_options');
configurarInputInteligente(prodInput, 'prod_options');
configurarInputInteligente(failInput, 'fail_options');

// Función auxiliar para actualizar la lista de Fallas
function actualizarFallas(producto) {
    if (!opcionesNaturaleza[producto]) {
        if(failList) failList.innerHTML = '';
        if(failInput) failInput.value = '';
        return;
    }
    llenarDatalist(failList, opcionesNaturaleza[producto]);
    // Seleccionar el primero por defecto para agilizar
    if(failInput) failInput.value = opcionesNaturaleza[producto][0];
}

/* =========================================
   6. GESTIÓN DE MÉTRICAS Y MES
   ========================================= */
function actualizarMetricasUI() {
    const hoy = new Date().toLocaleDateString();
    
    if (ahtDiario.fecha !== hoy) {
        ahtDiario = { segundos: 0, llamadas: 0, fecha: hoy };
        localStorage.setItem('aht_diario', JSON.stringify(ahtDiario));
    }

    const promDiarioSeg = ahtDiario.llamadas > 0 ? ahtDiario.segundos / ahtDiario.llamadas : 0;
    const promMensualSeg = ahtMensual.llamadas > 0 ? ahtMensual.segundos / ahtMensual.llamadas : 0;

    const divDiario = document.getElementById('aht_daily_display');
    const divMensual = document.getElementById('aht_monthly_display');

    if (divDiario) divDiario.textContent = formatearDual(promDiarioSeg);
    if (divMensual) divMensual.textContent = formatearDual(promMensualSeg);
}

function verificarCambioMes() {
    const mesActualReal = new Date().toISOString().slice(0, 7);
    if (mesGuardado !== mesActualReal) {
        alert(`📅 Nuevo Mes Detectado. Se reiniciarán las métricas.`);
        ahtMensual = { segundos: 0, llamadas: 0 };
        historialLlamadas = [];
        mesGuardado = mesActualReal;
        
        localStorage.setItem('mes_actual', mesGuardado);
        localStorage.setItem('aht_mensual', JSON.stringify(ahtMensual));
        localStorage.setItem('historial_llamadas', JSON.stringify(historialLlamadas));
        actualizarMetricasUI();
    }
}

/* =========================================
   7. EVENTOS PRINCIPALES (PROTEGIDOS)
   ========================================= */

// --- CASCADA TECNOLOGÍA -> PRODUCTO ---
if (techInput) {
    techInput.addEventListener('change', (e) => {
        const tec = e.target.value;
        const servicios = opcionesTiposervicio[tec];
        if (servicios && servicios.length > 0) {
            llenarDatalist(prodList, servicios);
            prodInput.value = servicios[0];
            actualizarFallas(servicios[0]);
        } else {
            if(prodList) prodList.innerHTML = '';
            if(prodInput) prodInput.value = '';
        }
    });
}

// --- CASCADA PRODUCTO -> FALLA ---
if (prodInput) {
    prodInput.addEventListener('change', (e) => actualizarFallas(e.target.value));
}

// --- INICIO AUTOMÁTICO DEL TIMER (ID LLAMADA) ---
if (callIdInput) {
    callIdInput.addEventListener('input', () => {
        if (callIdInput.value.length > 0 && horaInicioLlamada === null) {
            horaInicioLlamada = Date.now();
            // Inicia timer automático (45s -> 115s)
            gestionarTimerRetoma(false); 
        }
    });
}

// --- BOTÓN "MODIFICAR" (REINICIO MANUAL DEL TIMER) ---
const btnModificar = document.getElementById('btn_key_mod');
if (btnModificar) {
    btnModificar.addEventListener('click', () => {
        // Solo funciona si ya hay una llamada en curso
        if (horaInicioLlamada !== null) {
            gestionarTimerRetoma(true); // Reinicia a ciclo de 115s directo
            
            // Feedback Visual en el botón
            const textoOriginal = btnModificar.textContent;
            btnModificar.textContent = "⏱️ Reiniciado";
            btnModificar.style.backgroundColor = "#dcfce7"; // Verde suave
            setTimeout(() => {
                btnModificar.textContent = textoOriginal;
                btnModificar.style.backgroundColor = ""; 
            }, 1000);
        }
    });
}

// --- AUTO-ALTURA OBSERVACIONES ---
if (obsTextarea) {
    obsTextarea.addEventListener('input', function() {
        this.style.height = 'auto'; 
        this.style.height = (this.scrollHeight) + 'px'; 
    });
}

// --- BOTÓN COPIAR ---
const btnCopy = document.getElementById('btn_copy');
if (btnCopy) {
    btnCopy.addEventListener('click', () => {
        const idValor = callIdInput.value.trim();
        const obsValor = obsTextarea.value.trim();

        if (!idValor || !obsValor) {
            alert("⚠️ Faltan datos (ID u Observaciones).");
            return;
        }

        const isB2B = document.querySelector('input[name="b2b_option"]:checked')?.value === 'si';
        const validar = (lbl, v) => (v && v.trim() !== "") ? `${lbl}${v.trim()}, ` : "";

        let plantilla = `Observaciones: ${obsValor}, Id de la llamada: ${idValor}, `;
        plantilla += validar("SMNET: ", document.getElementById('prueba_smnet').value);
        plantilla += validar("Tecnología: ", techInput.value);
        plantilla += validar("Tipo de servicio: ", prodInput.value);
        plantilla += validar("Naturaleza: ", failInput.value);
        plantilla += validar("Documento: ", document.getElementById('customer_doc').value);
        
        if (isB2B) plantilla += " Horario B2B activo.";

        plantilla = plantilla.trim().replace(/,$/, "");
        navigator.clipboard.writeText(plantilla).then(() => {
            const original = btnCopy.textContent;
            btnCopy.textContent = "¡Copiado!";
            setTimeout(() => btnCopy.textContent = original, 1000);
        });
    });
}

// --- BOTÓN REINICIAR / GUARDAR ---
const btnReset = document.getElementById('btn_reset');
if (btnReset) {
    btnReset.addEventListener('click', () => {
        const idValor = callIdInput.value.trim();
        const obsValor = obsTextarea.value.trim();

        if (!idValor || !obsValor) {
            alert("⚠️ Faltan datos obligatorios.");
            return;
        }

        // 1. Detener Timer y Sonidos
        if (timerRetoma) clearInterval(timerRetoma);
        timerRetoma = null;

        // 2. Calcular Duración
        const fin = Date.now();
        const duracion = (fin - (horaInicioLlamada || fin)) / 1000;
        
        // 3. Guardar en Historial
        const registro = {
            fecha: new Date().toLocaleDateString(),
            hora: new Date().toLocaleTimeString(),
            id: idValor,
            cliente: document.getElementById('customer_name').value,
            tec: techInput.value,
            prod: prodInput.value,
            falla: failInput.value,
            obs: obsValor,
            duracion: duracion.toFixed(2)
        };

        historialLlamadas.push(registro);
        localStorage.setItem('historial_llamadas', JSON.stringify(historialLlamadas));
        
        // 4. Actualizar Métricas
        ahtDiario.segundos += duracion; ahtDiario.llamadas++;
        ahtMensual.segundos += duracion; ahtMensual.llamadas++;
        localStorage.setItem('aht_diario', JSON.stringify(ahtDiario));
        localStorage.setItem('aht_mensual', JSON.stringify(ahtMensual));

        // 5. Limpieza de Interfaz
        actualizarMetricasUI();
        horaInicioLlamada = null; // Reset variable inicio
        
        document.querySelectorAll('input:not([type="radio"])').forEach(i => i.value = '');
        document.querySelectorAll('textarea').forEach(t => {
            t.value = '';
            t.style.height = 'auto';
        });
        
        if(prodList) prodList.innerHTML = '';
        if(failList) failList.innerHTML = '';
        
        // Reset B2B
        if(panelB2B) panelB2B.classList.add('hidden');
        const radioNo = document.querySelector('input[name="b2b_option"][value="no"]');
        if(radioNo) radioNo.checked = true;
    });
}

// --- RADIOS B2B ---
if (radiosB2B && radiosB2B.length > 0) {
    radiosB2B.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (panelB2B) panelB2B.classList.toggle('hidden', e.target.value === 'no');
        });
    });
}

// --- BOTÓN EXPORTAR CSV ---
const btnExport = document.getElementById('btn_export');
if (btnExport) {
    btnExport.addEventListener('click', () => {
        if (historialLlamadas.length === 0) {
            alert("⚠️ No hay datos."); return;
        }
        // ... (Lógica de exportación simplificada)
        let csv = "data:text/csv;charset=utf-8,Fecha,Hora,ID,Cliente,Tec,Prod,Falla,Obs\n";
        historialLlamadas.forEach(r => {
            const obsClean = (r.obs || '').replace(/,/g, ';').replace(/\n/g, ' ');
            csv += `${r.fecha},${r.hora},${r.id},"${r.cliente}",${r.tec},${r.prod},"${r.falla}","${obsClean}"\n`;
        });
        const link = document.createElement("a");
        link.href = encodeURI(csv);
        link.download = `Reporte_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`;
        link.click();
    });
}

/* =========================================
   8. IMPORTACIÓN (OPCIONAL)
   ========================================= */
const btnImport = document.getElementById('btn_import_data');
const fileSelector = document.getElementById('file_selector');
if (btnImport && fileSelector) {
    btnImport.addEventListener('click', () => fileSelector.click());
    fileSelector.addEventListener('change', (e) => {
        // Lógica de importación estándar
        // ...
    });
}

// BOTÓN BORRAR DATOS
const btnClear = document.getElementById('btn_clear_data');
if (btnClear) {
    btnClear.addEventListener('click', () => {
        if(confirm("¿Borrar todo?")) {
            localStorage.clear();
            location.reload();
        }
    });
}

/* =========================================
   9. CLAVES RÁPIDAS
   ========================================= */
const claves = { 'btn_key_elite': 'Elite123*', 'btn_key_fenix': 'Fenix2024!', 'btn_key_pwd': 'AdminPassword' };
Object.keys(claves).forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.addEventListener('click', () => navigator.clipboard.writeText(claves[id]));
});

// INICIO
function init() {
    llenarDatalist(techList, Object.keys(opcionesTiposervicio));
    verificarCambioMes();
    actualizarMetricasUI();
}
init();