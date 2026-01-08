/* =========================================
   1. CLASE MAESTRA DE BASE DE DATOS (INDEXEDDB)
   ========================================= */
class GestorDB {
    constructor() {
        this.nombreDB = 'SistemaGestionDB';
        this.version = 1;
        this.db = null;
    }

    async iniciar() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.nombreDB, this.version);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                // 1. Historial
                if (!db.objectStoreNames.contains('historial')) {
                    db.createObjectStore('historial', { keyPath: 'id_unico' });
                }
                // 2. Configuración (Claves)
                if (!db.objectStoreNames.contains('configuracion')) {
                    db.createObjectStore('configuracion', { keyPath: 'clave' });
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(true);
            };

            request.onerror = (e) => reject("Error DB: " + e.target.error);
        });
    }

    async guardar(tabla, datos) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB no iniciada");
            const tx = this.db.transaction([tabla], 'readwrite');
            const store = tx.objectStore(tabla);
            const req = store.put(datos);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async leerTodo(tabla) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB no iniciada");
            const tx = this.db.transaction([tabla], 'readonly');
            const store = tx.objectStore(tabla);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async leerUno(tabla, clave) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB no iniciada");
            const tx = this.db.transaction([tabla], 'readonly');
            const store = tx.objectStore(tabla);
            const req = store.get(clave);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
}

const baseDatos = new GestorDB();

/* =========================================
   2. CONFIGURACIÓN Y DATOS
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
   3. VARIABLES DE ESTADO
   ========================================= */
let horaInicioLlamada = null; 
let timerRetoma = null;
let retomaStartTime = null;
let primeraAlarmaSonada = false;
let proximaAlarmaSegundos = 45;

let misClaves = {
    'btn_key_elite': 'Elite123*', 
    'btn_key_fenix': 'Fenix2024!',
    'btn_key_pwd': 'AdminPassword'
};

// Elementos DOM Principales
const callIdInput = document.getElementById('call_id');
const techInput = document.getElementById('tech_input');
const prodInput = document.getElementById('prod_input');
const failInput = document.getElementById('fail_input');
const obsTextarea = document.getElementById('observaciones');
const techList = document.getElementById('tech_options');
const prodList = document.getElementById('prod_options');
const failList = document.getElementById('fail_options');

// Elementos B2B
const radiosB2B = document.querySelectorAll('input[name="b2b_option"]');
const panelB2B = document.getElementById('b2b_panel');

// Elementos Timer
const displayTotal = document.getElementById('display_total');
const displayCountdown = document.getElementById('display_countdown');
const timerPanel = document.getElementById('timer_panel');

/* =========================================
   4. FUNCIONES DE UTILIDAD
   ========================================= */
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

function formatearDual(segundos) {
    const totalSeg = Math.round(segundos);
    const m = Math.floor(totalSeg / 60).toString().padStart(2, '0');
    const s = (totalSeg % 60).toString().padStart(2, '0');
    return `${totalSeg}s / ${m}.${s}m`;
}

function formatoMMSS(segundos) {
    const m = Math.floor(segundos / 60).toString().padStart(2, '0');
    const s = Math.floor(segundos % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function sonarAlertaRetoma() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine'; 
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1); 
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 1.5);
    setTimeout(() => audioCtx.close(), 1600);
}

// Auto-expandir Textarea
if (obsTextarea) {
    const ajustarAltura = () => {
        obsTextarea.style.height = 'auto'; 
        obsTextarea.style.height = (obsTextarea.scrollHeight) + 'px'; 
    };
    obsTextarea.addEventListener('input', ajustarAltura);
    obsTextarea.addEventListener('focus', ajustarAltura);
}

/* =========================================
   5. LÓGICA DE CLAVES (DB & MODAL)
   ========================================= */
async function cargarClavesDesdeDB() {
    try {
        const configGuardada = await baseDatos.leerUno('configuracion', 'claves_rapidas');
        if (configGuardada) {
            misClaves = configGuardada.datos;
        } else {
            await baseDatos.guardar('configuracion', { clave: 'claves_rapidas', datos: misClaves });
        }
    } catch (e) { console.error(e); }
}

Object.keys(misClaves).forEach(id => {
    const btn = document.getElementById(id);
    if(btn) {
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(misClaves[id]);
            const original = btn.textContent;
            btn.textContent = "Copiado!";
            setTimeout(() => btn.textContent = original, 800);
        });
    }
});

// Modal Configuración
const btnModificar = document.getElementById('btn_key_mod');
const modalClaves = document.getElementById('modal_claves');
const btnGuardarModal = document.getElementById('btn_guardar_modal');
const btnCancelarModal = document.getElementById('btn_cancelar_modal');

if (btnModificar) {
    btnModificar.addEventListener('click', () => {
        document.getElementById('edit_key_elite').value = misClaves['btn_key_elite'];
        document.getElementById('edit_key_fenix').value = misClaves['btn_key_fenix'];
        document.getElementById('edit_key_pwd').value = misClaves['btn_key_pwd'];
        if(modalClaves) modalClaves.classList.remove('hidden');
    });
}
if (btnCancelarModal) {
    btnCancelarModal.addEventListener('click', () => {
        if(modalClaves) modalClaves.classList.add('hidden');
    });
}
if (btnGuardarModal) {
    btnGuardarModal.addEventListener('click', async () => {
        misClaves['btn_key_elite'] = document.getElementById('edit_key_elite').value;
        misClaves['btn_key_fenix'] = document.getElementById('edit_key_fenix').value;
        misClaves['btn_key_pwd'] = document.getElementById('edit_key_pwd').value;
        try {
            await baseDatos.guardar('configuracion', { clave: 'claves_rapidas', datos: misClaves });
            alert("✅ Claves actualizadas.");
            if(modalClaves) modalClaves.classList.add('hidden');
        } catch (e) { alert(e); }
    });
}

/* =========================================
   6. MÉTRICAS AHT (REALES)
   ========================================= */
async function actualizarMetricasDesdeDB() {
    try {
        const historial = await baseDatos.leerTodo('historial');
        const hoyTexto = new Date().toLocaleDateString();
        const ahora = new Date();
        const mesActual = ahora.getMonth();
        const anioActual = ahora.getFullYear();

        let sumaDia = 0, countDia = 0;
        let sumaMes = 0, countMes = 0;

        historial.forEach(reg => {
            const duracion = Number(reg.duracion) || 0;
            const fechaReg = new Date(reg.id_unico);

            if (fechaReg.getMonth() === mesActual && fechaReg.getFullYear() === anioActual) {
                sumaMes += duracion;
                countMes++;
            }
            if (reg.fecha === hoyTexto) {
                sumaDia += duracion;
                countDia++;
            }
        });

        const ahtDia = countDia > 0 ? sumaDia / countDia : 0;
        const ahtMes = countMes > 0 ? sumaMes / countMes : 0;

        const divDiario = document.getElementById('aht_daily_display');
        const divMensual = document.getElementById('aht_monthly_display');

        if (divDiario) divDiario.textContent = formatearDual(ahtDia);
        if (divMensual) divMensual.textContent = formatearDual(ahtMes);
    } catch (error) { console.error(error); }
}

/* =========================================
   7. GESTIÓN DEL TIMER
   ========================================= */
function gestionarTimerRetoma(esReinicioManual = false) {
    if (timerPanel) timerPanel.classList.remove('hidden');
    if (timerRetoma) clearInterval(timerRetoma);

    retomaStartTime = Date.now();
    if (!horaInicioLlamada) horaInicioLlamada = Date.now();

    if (esReinicioManual) {
        primeraAlarmaSonada = true; proximaAlarmaSegundos = 115;
    } else {
        primeraAlarmaSonada = false; proximaAlarmaSegundos = 45;
    }

    timerRetoma = setInterval(() => {
        const ahora = Date.now();
        const segundosCiclo = Math.floor((ahora - retomaStartTime) / 1000);
        const segundosTotal = Math.floor((ahora - horaInicioLlamada) / 1000);
        
        if (displayTotal) displayTotal.textContent = formatoMMSS(segundosTotal);

        let falta = proximaAlarmaSegundos - segundosCiclo;
        if (falta < 0) falta = 0; 
        
        if (displayCountdown) {
            displayCountdown.textContent = formatoMMSS(falta);
            if (falta <= 10) displayCountdown.classList.add('danger');
            else displayCountdown.classList.remove('danger');
        }

        if (segundosCiclo >= proximaAlarmaSegundos) {
            sonarAlertaRetoma(); 
            if (!primeraAlarmaSonada) {
                primeraAlarmaSonada = true; proximaAlarmaSegundos = segundosCiclo + 115;
            } else {
                proximaAlarmaSegundos += 115;
            }
        }
    }, 1000);
}

const btnRefres = document.getElementById('btn_key_refres');
if (btnRefres) {
    btnRefres.addEventListener('click', () => {
        if (horaInicioLlamada !== null) {
            gestionarTimerRetoma(true);
            const original = btnRefres.textContent;
            btnRefres.textContent = "⏱️";
            btnRefres.style.backgroundColor = "#dcfce7"; 
            setTimeout(() => { btnRefres.textContent = original; btnRefres.style.backgroundColor = ""; }, 800);
        }
    });
}

if (callIdInput) {
    callIdInput.addEventListener('input', () => {
        if (callIdInput.value.length > 0 && horaInicioLlamada === null) {
            horaInicioLlamada = Date.now();
            gestionarTimerRetoma(false); 
        }
    });
}

/* =========================================
   8. INPUTS INTELIGENTES
   ========================================= */
function configurarInputAvanzado(inputElement, dataListId) {
    if (!inputElement) return;
    const label = inputElement.nextElementSibling;

    inputElement.addEventListener('focus', function() {
        this.dataset.oldValue = this.value; 
        if (this.value && label) {
            if (!label.dataset.originalText) label.dataset.originalText = label.innerText; 
            label.innerText = this.value; 
            label.style.color = "#ef4444"; 
        }
        this.value = ''; 
    });

    inputElement.addEventListener('blur', function() {
        if (this.value === '') this.value = this.dataset.oldValue || ''; 
        if (label && label.dataset.originalText) {
            label.innerText = label.dataset.originalText;
            label.style.color = ""; 
        }
    });

    inputElement.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            const val = this.value.toLowerCase();
            const dataList = document.getElementById(dataListId);
            if (val && dataList) {
                const opciones = Array.from(dataList.options);
                const coincidencia = opciones.find(opt => opt.value.toLowerCase().startsWith(val));
                if (coincidencia) {
                    e.preventDefault(); 
                    this.value = coincidencia.value;
                    this.dispatchEvent(new Event('change'));
                    
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

configurarInputAvanzado(techInput, 'tech_options');
configurarInputAvanzado(prodInput, 'prod_options');
configurarInputAvanzado(failInput, 'fail_options');

function actualizarFallas(producto) {
    if (!opcionesNaturaleza[producto]) {
        if(failList) failList.innerHTML = '';
        if(failInput) failInput.value = '';
        return;
    }
    llenarDatalist(failList, opcionesNaturaleza[producto]);
    if(failInput) failInput.value = opcionesNaturaleza[producto][0];
}

if (techInput) techInput.addEventListener('change', (e) => {
    const tec = e.target.value;
    const servicios = opcionesTiposervicio[tec];
    if (servicios && servicios.length > 0) {
        llenarDatalist(prodList, servicios);
        prodInput.value = servicios[0];
        actualizarFallas(servicios[0]);
    }
});
if (prodInput) prodInput.addEventListener('change', (e) => actualizarFallas(e.target.value));

/* =========================================
   9. LÓGICA B2B (MOSTRAR/OCULTAR)
   ========================================= */
if (radiosB2B && radiosB2B.length > 0) {
    radiosB2B.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (panelB2B) {
                if (e.target.value === 'si') {
                    panelB2B.classList.remove('hidden');
                } else {
                    panelB2B.classList.add('hidden');
                }
            }
        });
    });
}

/* =========================================
   10. BOTONES DE ACCIÓN (COPIAR, GUARDAR, EXPORTAR)
   ========================================= */

// --- BOTÓN COPIAR (CORREGIDO CON IDs REALES DEL HTML) ---
const btnCopy = document.getElementById('btn_copy');
if (btnCopy) {
    btnCopy.addEventListener('click', () => {
        const idValor = callIdInput ? callIdInput.value.trim() : '';
        const obsValor = obsTextarea ? obsTextarea.value.trim() : '';
        
        if (!idValor || !obsValor) { alert("⚠️ Faltan datos."); return; }

        const addField = (label, value) => {
            // Si quieres que aparezca incluso vacío, quita el if
            if (value && value.trim() !== "") return `${label}: ${value.trim()}, `;
            return "";
        };

        let plantilla = `Observaciones: ${obsValor}, Id de la llamada: ${idValor}, `;

        // Campos básicos
        plantilla += addField("SMNET", document.getElementById('prueba_smnet')?.value);
        plantilla += addField("Tecnología", techInput?.value);
        plantilla += addField("Tipo de servicio", prodInput?.value);
        plantilla += addField("Naturaleza", failInput?.value);
        plantilla += addField("Documento", document.getElementById('customer_doc')?.value);
        
        // Lógica B2B
        const isB2B = document.querySelector('input[name="b2b_option"]:checked')?.value === 'si';
        
        if (isB2B) {
            plantilla += " Horario B2B activo, ";
            // AQUÍ ESTÁ LA CORRECCIÓN DE LOS IDs:
            plantilla += addField("Atiende", document.getElementById('b2b_contact')?.value);
            plantilla += addField("Días", document.getElementById('b2b_days')?.value);
            plantilla += addField("Horario", document.getElementById('b2b_schedule')?.value);
        }

        plantilla = plantilla.trim().replace(/,$/, "");

        navigator.clipboard.writeText(plantilla).then(() => {
            const original = btnCopy.textContent;
            btnCopy.textContent = "¡Copiado!";
            if(btnReset) btnReset.focus(); 
            setTimeout(() => btnCopy.textContent = original, 1000);
        });
    });
}

// --- BOTÓN REINICIAR / GUARDAR ---
const btnReset = document.getElementById('btn_reset');
if (btnReset) {
    btnReset.addEventListener('click', async () => {
        const idValor = callIdInput.value.trim();
        const obsValor = obsTextarea.value.trim();
        if (!idValor || !obsValor) { alert("⚠️ Faltan datos obligatorios."); return; }

        if (timerRetoma) clearInterval(timerRetoma);
        timerRetoma = null;

        const fin = Date.now();
        const duracionRaw = (fin - (horaInicioLlamada || fin)) / 1000;
        
        const registro = {
            id_unico: Date.now(),
            fecha: new Date().toLocaleDateString(),
            hora: new Date().toLocaleTimeString(),
            id: idValor,
            cliente: document.getElementById('customer_name')?.value || '',
            tec: techInput.value,
            prod: prodInput.value,
            falla: failInput.value,
            obs: obsValor,
            duracion: Number(duracionRaw.toFixed(2))
        };

        try {
            await baseDatos.guardar('historial', registro);
            console.log("💾 Guardado OK");
            await actualizarMetricasDesdeDB();
        } catch (error) { alert("Error DB: " + error); }
        
        // LIMPIEZA
        horaInicioLlamada = null;
        document.querySelectorAll('input:not([type="radio"])').forEach(i => i.value = '');
        document.querySelectorAll('textarea').forEach(t => { 
            t.value = ''; t.style.height = 'auto'; 
        });
        
        if(prodList) prodList.innerHTML = '';
        if(failList) failList.innerHTML = '';
        
        // Resetear B2B
        if(panelB2B) panelB2B.classList.add('hidden');
        const radioNo = document.querySelector('input[name="b2b_option"][value="no"]');
        if(radioNo) radioNo.checked = true;

        if (callIdInput) callIdInput.focus();
        
        if(timerPanel) {
            timerPanel.classList.add('hidden');
            if (displayTotal) displayTotal.textContent = "00:00";
            if (displayCountdown) { displayCountdown.textContent = "00:00"; displayCountdown.classList.remove('danger'); }
        }
    });
}

// --- EXPORTAR ---
const btnExport = document.getElementById('btn_export');
if (btnExport) {
    btnExport.addEventListener('click', async () => {
        const historial = await baseDatos.leerTodo('historial');
        if (historial.length === 0) { alert("⚠️ No hay datos."); return; }

        const fechaHoy = new Date().toLocaleDateString().replace(/\//g, '-');
        let csv = "Fecha,Hora,ID,Cliente,Tecnologia,Servicio,Falla,Duracion,Observaciones\n";
        
        historial.forEach(r => {
            const obsClean = (r.obs || '').replace(/"/g, '""').replace(/(\r\n|\n|\r)/gm, " ");
            const dur = r.duracion ? r.duracion.toString().replace('.', ',') : '0';
            csv += `${r.fecha},${r.hora},${r.id},"${r.cliente}",${r.tec},${r.prod},"${r.falla}",${dur},"${obsClean}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Gestion_Llamadas_${fechaHoy}.csv`;
        link.click();
    });
}

// --- IMPORTAR ---
const btnImport = document.getElementById('btn_import_data');
const fileSelector = document.getElementById('file_selector');

if (btnImport && fileSelector) {
    btnImport.addEventListener('click', () => fileSelector.click());

    fileSelector.addEventListener('change', function(e) {
        const archivo = e.target.files[0];
        if (!archivo) return;
        const lector = new FileReader();
        lector.onload = async function(e) {
            const contenido = e.target.result;
            let datosParaImportar = [];
            try {
                if (archivo.name.endsWith('.json')) {
                    datosParaImportar = JSON.parse(contenido);
                } else if (archivo.name.endsWith('.csv')) {
                    const lineas = contenido.split('\n');
                    for (let i = 1; i < lineas.length; i++) {
                        const linea = lineas[i].trim();
                        if (linea) {
                            const partes = linea.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
                            const cols = partes.map(p => p.replace(/^"|"$/g, '').trim());
                            if (cols.length >= 8) {
                                datosParaImportar.push({
                                    id_unico: Date.now() + i,
                                    fecha: cols[0], hora: cols[1], id: cols[2], cliente: cols[3],
                                    tec: cols[4], prod: cols[5], falla: cols[6],
                                    duracion: parseFloat(cols[7].replace(',', '.')) || 0,
                                    obs: cols[8] || ''
                                });
                            }
                        }
                    }
                }
                
                if (datosParaImportar.length > 0 && confirm(`¿Importar ${datosParaImportar.length} registros?`)) {
                    for (const registro of datosParaImportar) {
                        const existe = (await baseDatos.leerTodo('historial')).find(r => r.id === registro.id && r.fecha === registro.fecha);
                        if (!existe) {
                            if(!registro.id_unico) registro.id_unico = Date.now() + Math.random();
                            await baseDatos.guardar('historial', registro);
                        }
                    }
                    alert("✅ Importación completada.");
                    await actualizarMetricasDesdeDB();
                }
            } catch (err) { alert("❌ Error al importar."); }
        };
        lector.readAsText(archivo);
    });
}

/* =========================================
   11. INICIALIZACIÓN
   ========================================= */
async function init() {
    llenarDatalist(techList, Object.keys(opcionesTiposervicio));
    try {
        await baseDatos.iniciar();
        console.log("✅ DB Conectada");
        await cargarClavesDesdeDB();
        await actualizarMetricasDesdeDB(); 
    } catch (error) { console.error(error); }
}
init();