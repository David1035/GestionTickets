/* =========================================
   9. CLAVES RÁPIDAS
   ========================================= */
const claves = { 'btn_key_elite': 'D24lj8Klo3l&/$l', 'btn_key_fenix': 'CRWS8T3JPICEZ8', 'btn_key_pwd': 'A22Aguamari$$++' };
Object.keys(claves).forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.addEventListener('click', () => navigator.clipboard.writeText(claves[id]));
});

/* =========================================
   1. CONFIGURACIÓN DE BASE DE DATOS
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
   2. VARIABLES DE ESTADO Y ELEMENTOS
   ========================================= */
let horaInicioLlamada = null; 

// Variables del Temporizador
let timerRetoma = null;
let retomaStartTime = null;
let primeraAlarmaSonada = false;
let proximaAlarmaSegundos = 45;


// Métricas y Persistencia
let ahtDiario = JSON.parse(localStorage.getItem('aht_diario')) || { segundos: 0, llamadas: 0, fecha: new Date().toLocaleDateString() };
let ahtMensual = JSON.parse(localStorage.getItem('aht_mensual')) || { segundos: 0, llamadas: 0 };
let historialLlamadas = JSON.parse(localStorage.getItem('historial_llamadas')) || [];
let mesGuardado = localStorage.getItem('mes_actual') || new Date().toISOString().slice(0, 7);

// Elementos del DOM
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


const displayTotal = document.getElementById('display_total');
const displayCountdown = document.getElementById('display_countdown');
const timerPanel = document.getElementById('timer_panel');
/* =========================================
   3. FUNCIONES DE UTILIDAD (SONIDO Y UI)
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

// Formato de tiempo "120s / 02:00m"
function formatearDual(segundos) {
    const totalSeg = Math.round(segundos);
    const m = Math.floor(totalSeg / 60).toString().padStart(2, '0');
    const s = (totalSeg % 60).toString().padStart(2, '0');
    return `${totalSeg}s / ${m}.${s}m`;
}

// --- SONIDO SUAVE (ZEN) ---
function sonarAlertaRetoma() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine'; 
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // Nota Do (C5)

    // Efecto Fade-In y Fade-Out para no asustar
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
   4. LÓGICA DEL TEMPORIZADOR (MOTOR)
   ========================================= */
function gestionarTimerRetoma(esReinicioManual = false) {
    // 1. Limpiar timer anterior
    if (timerRetoma) clearInterval(timerRetoma);

    retomaStartTime = Date.now();
    
    if (esReinicioManual) {
        // Reinicio manual (Botón Modificar): Vamos directo al ciclo de 115s
        primeraAlarmaSonada = true; 
        proximaAlarmaSegundos = 115;
        console.log("🔄 Reinicio manual: Alarma en 1:55 min");
    } else {
        // Inicio automático (Al escribir ID): Primero 45s
        primeraAlarmaSonada = false;
        proximaAlarmaSegundos = 45;
        console.log("⏱️ Inicio automático: Alarma en 45s");
    }

    timerRetoma = setInterval(() => {
        const segundosTranscurridos = Math.floor((Date.now() - retomaStartTime) / 1000);

        if (segundosTranscurridos >= proximaAlarmaSegundos) {
            sonarAlertaRetoma(); // ¡Sonido!

            if (!primeraAlarmaSonada) {
                // De 45s pasamos a 115s
                primeraAlarmaSonada = true;
                proximaAlarmaSegundos = segundosTranscurridos + 115;
            } else {
                // Sumamos 115s cíclicamente
                proximaAlarmaSegundos += 115;
            }
        }
    }, 1000);
}

/* =========================================
   5. INPUTS AVANZADOS (GHOST VALUE + AUTOCOMPLETE + NAV)
   ========================================= */
function configurarInputAvanzado(inputElement, dataListId) {
    if (!inputElement) return;

    // Buscamos la etiqueta (label) hermana para el efecto visual
    const label = inputElement.nextElementSibling;

    // A. ENTRADA (FOCUS): Mover valor actual al label ("Ghost Value")
    inputElement.addEventListener('focus', function() {
        this.dataset.oldValue = this.value; // Guardar valor real
        
        // Si hay un valor, lo subimos a la etiqueta para que no se pierda de vista
        if (this.value && label) {
            if (!label.dataset.originalText) {
                label.dataset.originalText = label.innerText; 
            }
            label.innerText = this.value; 
            label.style.color = "#ef4444"; 
        }

        this.value = ''; // Limpiamos el input para permitir búsqueda fresca
    });

    // B. SALIDA (BLUR): Restaurar si no se eligió nada
    inputElement.addEventListener('blur', function() {
        if (this.value === '') {
            this.value = this.dataset.oldValue || ''; // Restaurar valor anterior
        }

        // Devolver el label a su estado original
        if (label && label.dataset.originalText) {
            label.innerText = label.dataset.originalText;
            label.style.color = ""; 
        }
    });

    // C. AUTOCOMPLETADO CON TABULADOR (CORREGIDO: SALTA AL SIGUIENTE)
    inputElement.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            const val = this.value.toLowerCase();
            const dataList = document.getElementById(dataListId);
            
            if (val && dataList) {
                const opciones = Array.from(dataList.options);
                // Buscar coincidencia que empiece por lo escrito
                const coincidencia = opciones.find(opt => opt.value.toLowerCase().startsWith(val));

                if (coincidencia) {
                    // 1. Evitar comportamiento por defecto
                    e.preventDefault(); 
                    
                    // 2. Rellenar valor
                    this.value = coincidencia.value;
                    
                    // 3. Disparar eventos de cambio
                    this.dispatchEvent(new Event('change'));
                    
                    // 4. SOLUCIÓN: BUSCAR Y ENFOCAR EL SIGUIENTE CAMPO
                    const formElements = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, button'));
                    const currentIndex = formElements.indexOf(this);
                    
                    if (currentIndex > -1 && currentIndex < formElements.length - 1) {
                        formElements[currentIndex + 1].focus();
                    }
                }
            }
        }
    });
}

// Configuración de los 3 campos principales
configurarInputAvanzado(techInput, 'tech_options');
configurarInputAvanzado(prodInput, 'prod_options');
configurarInputAvanzado(failInput, 'fail_options');

// Función auxiliar para actualizar Fallas (Cascada)
function actualizarFallas(producto) {
    if (!opcionesNaturaleza[producto]) {
        if(failList) failList.innerHTML = '';
        if(failInput) failInput.value = '';
        return;
    }
    llenarDatalist(failList, opcionesNaturaleza[producto]);
    // Pre-seleccionar el primero
    if(failInput) failInput.value = opcionesNaturaleza[producto][0];
}

/* =========================================
   6. MÉTRICAS Y CONTROL DE MES
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
        alert(`📅 Nuevo Mes Detectado. Reiniciando métricas.`);
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
   7. EVENTOS Y LÓGICA DE NEGOCIO
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

// --- INICIO AUTOMÁTICO TIMER (ID LLAMADA) ---
if (callIdInput) {
    callIdInput.addEventListener('input', () => {
        if (callIdInput.value.length > 0 && horaInicioLlamada === null) {
            horaInicioLlamada = Date.now();
            // Inicia: 45s -> luego 115s
            gestionarTimerRetoma(false); 
        }
    });
}

// --- BOTÓN "MODIFICAR" (REINICIO MANUAL) ---
const btnModificar = document.getElementById('btn_key_mod');
if (btnModificar) {
    btnModificar.addEventListener('click', () => {
        if (horaInicioLlamada !== null) {
            gestionarTimerRetoma(true); // Reinicia ciclo a 115s
            
            // Efecto visual en el botón
            const original = btnModificar.textContent;
            btnModificar.textContent = "⏱️ Reiniciado";
            btnModificar.style.backgroundColor = "#dcfce7"; 

            if(obsTextarea) obsTextarea.focus()

            setTimeout(() => {
                btnModificar.textContent = original;
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

        

        if(btnReset) btnReset.focus();
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

        // 1. Detener Timer
        if (timerRetoma) clearInterval(timerRetoma);
        timerRetoma = null;

        // 2. Guardar y Métricas
        const fin = Date.now();
        const duracion = (fin - (horaInicioLlamada || fin)) / 1000;
        
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
        
        ahtDiario.segundos += duracion; ahtDiario.llamadas++;
        ahtMensual.segundos += duracion; ahtMensual.llamadas++;
        localStorage.setItem('aht_diario', JSON.stringify(ahtDiario));
        localStorage.setItem('aht_mensual', JSON.stringify(ahtMensual));

        // 3. Reset UI
        actualizarMetricasUI();
        horaInicioLlamada = null;
        
        document.querySelectorAll('input:not([type="radio"])').forEach(i => i.value = '');
        document.querySelectorAll('textarea').forEach(t => {
            t.value = '';
            t.style.height = 'auto';
        });
        
        if(prodList) prodList.innerHTML = '';
        if(failList) failList.innerHTML = '';
        
        if(panelB2B) panelB2B.classList.add('hidden');
        const radioNo = document.querySelector('input[name="b2b_option"][value="no"]');
        if(radioNo) radioNo.checked = true;

        // 4. FOCO AL ID (PARA LA SIGUIENTE LLAMADA - SOLUCIÓN)
        if (callIdInput) callIdInput.focus();
        
        if(timerPanel) {
            timerPanel.classList.add('hidden')
        }
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

/* =========================================
   8. EXPORTACIÓN, IMPORTACIÓN Y LIMPIEZA
   ========================================= */

// --- BOTÓN EXPORTAR (Excel y JSON) ---
const btnExport = document.getElementById('btn_export');
if (btnExport) {
    btnExport.addEventListener('click', () => {
        if (historialLlamadas.length === 0) {
            alert("⚠️ No hay datos para exportar.");
            return;
        }

        const fechaHoy = new Date().toLocaleDateString().replace(/\//g, '-');

        // A. GENERAR CSV
        let csv = "data:text/csv;charset=utf-8,Fecha,Hora,ID,Cliente,Tec,Prod,Falla,Duracion,Obs\n";
        historialLlamadas.forEach(r => {
            const obsClean = (r.obs || '').replace(/,/g, ';').replace(/\n/g, ' ');
            csv += `${r.fecha},${r.hora},${r.id},"${r.cliente}",${r.tec},${r.prod},"${r.falla}","${obsClean}"\n`;
        });
        
        const linkExcel = document.createElement("a");
        linkExcel.href = encodeURI(csv);
        linkExcel.download = `Reporte_${fechaHoy}.csv`;
        linkExcel.click();

        // B. GENERAR JSON (BACKUP)
        const backupData = {
            historial: historialLlamadas,
            diario: ahtDiario,
            mensual: ahtMensual
        };
        const blobJson = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const linkJson = document.createElement("a");
        linkJson.href = URL.createObjectURL(blobJson);
        linkJson.download = `Backup_Data_${fechaHoy}.json`;
        
        setTimeout(() => linkJson.click(), 500);
    });
}

// --- IMPORTAR DATOS (FUSIÓN INTELIGENTE) ---
const btnImport = document.getElementById('btn_import_data');
const fileSelector = document.getElementById('file_selector');

if (btnImport && fileSelector) {
    btnImport.addEventListener('click', () => fileSelector.click());

    fileSelector.addEventListener('change', function(e) {
        const archivo = e.target.files[0];
        if (!archivo) return;

        const lector = new FileReader();
        lector.onload = function(e) {
            try {
                const datosImportados = JSON.parse(e.target.result);
                
                if (confirm("¿Fusionar datos? (Se agregarán sin borrar lo actual)")) {
                    // 1. Fusionar Historial
                    const nuevos = datosImportados.historial || [];
                    nuevos.forEach(nuevo => {
                        const existe = historialLlamadas.some(reg => reg.id === nuevo.id && reg.fecha === nuevo.fecha);
                        if (!existe) historialLlamadas.push(nuevo);
                    });

                    // 2. Fusionar Métricas
                    ahtDiario.segundos += (datosImportados.diario?.segundos || 0);
                    ahtDiario.llamadas += (datosImportados.diario?.llamadas || 0);
                    ahtMensual.segundos += (datosImportados.mensual?.segundos || 0);
                    ahtMensual.llamadas += (datosImportados.mensual?.llamadas || 0);

                    // 3. Guardar
                    localStorage.setItem('historial_llamadas', JSON.stringify(historialLlamadas));
                    localStorage.setItem('aht_diario', JSON.stringify(ahtDiario));
                    localStorage.setItem('aht_mensual', JSON.stringify(ahtMensual));
                    
                    alert("✅ Datos importados correctamente.");
                    location.reload();
                }
            } catch (err) {
                alert("❌ Archivo inválido.");
            }
        };
        lector.readAsText(archivo);
    });
}

// --- BORRAR TODO ---
const btnClear = document.getElementById('btn_clear_data');
if (btnClear) {
    btnClear.addEventListener('click', () => {
        if(confirm("⚠️ ¿Estás seguro? Se borrará TODO.")) {
            localStorage.clear();
            location.reload();
        }
    });
}

/* =========================================
   3.5 FUNCIÓN AUXILIAR DE TIEMPO
   ========================================= */
function formatoMMSS(segundos) {
    const m = Math.floor(segundos / 60).toString().padStart(2, '0');
    const s = Math.floor(segundos % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

/* =========================================
   4. LÓGICA DEL TEMPORIZADOR (MOTOR CON UI)
   ========================================= */
function gestionarTimerRetoma(esReinicioManual = false) {
    // 1. Mostrar el panel si estaba oculto
    if (timerPanel) timerPanel.classList.remove('hidden');

    // 2. Limpiar timer anterior
    if (timerRetoma) clearInterval(timerRetoma);

    retomaStartTime = Date.now();
    
    // Asegurarnos de tener hora de inicio global
    if (!horaInicioLlamada) horaInicioLlamada = Date.now();

    if (esReinicioManual) {
        primeraAlarmaSonada = true; 
        proximaAlarmaSegundos = 115;
        console.log("🔄 Reinicio: Cuenta regresiva de 1:55 min");
    } else {
        primeraAlarmaSonada = false;
        proximaAlarmaSegundos = 45;
        console.log("⏱️ Inicio: Cuenta regresiva de 45s");
    }

    // 3. Iniciar el intervalo (Se ejecuta cada segundo)
    timerRetoma = setInterval(() => {
        const ahora = Date.now();
        
        // A. Calcular tiempo transcurrido en este ciclo de retoma
        const segundosCiclo = Math.floor((ahora - retomaStartTime) / 1000);
        
        // B. Calcular Duración Total de la llamada
        const segundosTotal = Math.floor((ahora - horaInicioLlamada) / 1000);
        if (displayTotal) displayTotal.textContent = formatoMMSS(segundosTotal);

        // C. Calcular Cuenta Regresiva (Lo que falta para la alarma)
        let falta = proximaAlarmaSegundos - segundosCiclo;
        
        // Evitar números negativos visuales un momento antes del reset
        if (falta < 0) falta = 0; 
        
        if (displayCountdown) {
            displayCountdown.textContent = formatoMMSS(falta);
            
            // Efecto visual: Rojo si faltan menos de 10 segundos
            if (falta <= 10) {
                displayCountdown.classList.add('danger');
            } else {
                displayCountdown.classList.remove('danger');
            }
        }

        // D. Lógica de la Alarma
        if (segundosCiclo >= proximaAlarmaSegundos) {
            sonarAlertaRetoma(); // ¡Sonido!

            if (!primeraAlarmaSonada) {
                // Pasamos de 45s a 115s
                primeraAlarmaSonada = true;
                proximaAlarmaSegundos = segundosCiclo + 115;
            } else {
                // Sumamos 115s al objetivo actual
                proximaAlarmaSegundos += 115;
            }
        }
    }, 1000);
}


// INICIO AUTOMÁTICO
function init() {
    llenarDatalist(techList, Object.keys(opcionesTiposervicio));
    verificarCambioMes();
    actualizarMetricasUI();
}
init();