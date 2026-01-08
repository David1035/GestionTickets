/* =========================================
   js/dashboard.js - VERSIÓN FINAL CON BÚSQUEDA INTELIGENTE
   ========================================= */

// --- 1. REFERENCIAS DOM ---
const tbody = document.getElementById('dashboard_body');
const txtSearch = document.getElementById('txt_search');
const numLimit = document.getElementById('num_limit');
const btnRefresh = document.getElementById('btn_refresh');
const msgNoResults = document.getElementById('no_results');
const btnExport = document.getElementById('btn_export_dash');
const btnBackHome = document.getElementById('btn_back_home');
const btnExportJson = document.getElementById('btn_export_json');

// Modal Elements
const modal = document.getElementById('modal_edicion');
const btnCloseX = document.getElementById('btn_close_modal_x');
const btnCancel = document.getElementById('btn_cancel_edit');
const btnSave = document.getElementById('btn_save_edit');
const editObs = document.getElementById('edit_obs');

// Campos de Tiempo (Calculadora)
const editDuracion = document.getElementById('edit_duracion'); // Segundos
const editMinutos = document.getElementById('edit_minutos');   // Minutos

// Datos en memoria
let todosLosRegistros = [];

/* =========================================
   2. INICIALIZACIÓN
   ========================================= */
async function initDash() {
    try {
        await baseDatos.iniciar();
        console.log("DB Dashboard Ready");
        await cargarDatos();
        setupTimeConverters(); // Iniciar escuchas para conversión de tiempo
    } catch (e) { console.error(e); }
}

async function cargarDatos() {
    todosLosRegistros = await baseDatos.leerTodo('historial');
    aplicarFiltros();
}

/* =========================================
   3. FILTRADO INTELIGENTE (TU SOLICITUD AQUÍ)
   ========================================= */
function aplicarFiltros() {
    // 1. Convertimos lo que escribe el usuario a MINÚSCULAS y quitamos espacios
    const term = txtSearch.value.trim().toLowerCase();
    const limit = parseInt(numLimit.value) || 20;

    const filtrados = todosLosRegistros.filter(r => {
        if (!term) return true; // Si no hay búsqueda, mostrar todo

        // 2. Convertimos los datos de la DB a MINÚSCULAS antes de comparar
        // Usamos String() por si el ID es solo números, para que no de error
        const idDB = String(r.id || '').toLowerCase();
        const clienteDB = String(r.cliente || '').toLowerCase();
        const cedulaDB = String(r.cedula || '').toLowerCase();

        // 3. Creamos una sola cadena con todos los datos clave
        const textoCompleto = `${idDB} ${clienteDB} ${cedulaDB}`;
        
        // 4. Verificamos si la búsqueda está dentro de esa cadena
        return textoCompleto.includes(term);
    });

    // Manejo visual si no hay resultados
    if (filtrados.length === 0) {
        tbody.innerHTML = '';
        msgNoResults.style.display = 'block';
        return;
    }
    msgNoResults.style.display = 'none';

    // Recortar según el límite visual y pintar
    const datosFinales = filtrados.slice(0, limit);
    pintarTabla(datosFinales);
}

function pintarTabla(datos) {
    tbody.innerHTML = '';
    
    datos.forEach(reg => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size:0.85rem;">${reg.fecha}<br><span style="color:#94a3b8">${reg.hora}</span></td>
            <td class="col-id">${reg.id}</td>
            <td><b>${reg.cliente || '-'}</b></td>
            <td>${reg.celular || '-'}</td>
            <td>${reg.tec || '-'}</td>
            <td>${reg.falla || '-'}</td>
            <td class="col-duracion">${reg.duracion}s</td>
            <td class="col-obs" title="${reg.obs}">${reg.obs}</td>
            <td style="text-align: center;">
                <div class="action-btn-group">
                    <button class="btn-action btn-edit" onclick="abrirEdicion(${reg.id_unico})" title="Modificar">✏️</button>
                    <button class="btn-action btn-del" onclick="borrarRegistro(${reg.id_unico})" title="Eliminar">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/* =========================================
   4. CONVERSORES DE TIEMPO (MIN <-> SEG)
   ========================================= */
function setupTimeConverters() {
    // Si escribo en MINUTOS -> Calcula SEGUNDOS
    if (editMinutos) {
        editMinutos.addEventListener('input', () => {
            const mins = parseFloat(editMinutos.value) || 0;
            editDuracion.value = (mins * 60).toFixed(2);
        });
    }

    // Si escribo en SEGUNDOS -> Calcula MINUTOS
    if (editDuracion) {
        editDuracion.addEventListener('input', () => {
            const secs = parseFloat(editDuracion.value) || 0;
            editMinutos.value = (secs / 60).toFixed(2);
        });
    }
}

/* =========================================
   5. SISTEMA DE EDICIÓN (MODAL)
   ========================================= */
window.abrirEdicion = (idUnico) => {
    const registro = todosLosRegistros.find(r => r.id_unico === idUnico);
    if (!registro) return;

    // Llenar campos
    document.getElementById('edit_id_unico').value = registro.id_unico;
    document.getElementById('edit_call_id').value = registro.id || '';
    document.getElementById('edit_cliente').value = registro.cliente || '';
    document.getElementById('edit_celular').value = registro.celular || '';
    document.getElementById('edit_cedula').value = registro.cedula || '';
    document.getElementById('edit_tec').value = registro.tec || '';
    document.getElementById('edit_falla').value = registro.falla || '';
    
    // TIEMPO: Cargar segundos y calcular minutos para mostrar
    const segundos = registro.duracion || 0;
    editDuracion.value = segundos;
    editMinutos.value = (segundos / 60).toFixed(2);

    // Observaciones
    editObs.value = registro.obs || '';
    ajustarAlturaModal();

    modal.classList.add('active');
};

function cerrarModal() { modal.classList.remove('active'); }

function ajustarAlturaModal() {
    editObs.style.height = 'auto';
    editObs.style.height = (editObs.scrollHeight) + 'px';
}
editObs.addEventListener('input', ajustarAlturaModal);

// GUARDAR CAMBIOS
btnSave.addEventListener('click', async () => {
    const idUnico = parseFloat(document.getElementById('edit_id_unico').value);
    const registroOriginal = todosLosRegistros.find(r => r.id_unico === idUnico);
    if (!registroOriginal) return;

    const registroActualizado = {
        ...registroOriginal,
        id: document.getElementById('edit_call_id').value,
        cliente: document.getElementById('edit_cliente').value,
        celular: document.getElementById('edit_celular').value,
        cedula: document.getElementById('edit_cedula').value,
        tec: document.getElementById('edit_tec').value,
        falla: document.getElementById('edit_falla').value,
        // Guardamos los segundos (que es lo que importa para el AHT)
        duracion: parseFloat(editDuracion.value) || 0,
        obs: editObs.value
    };

    try {
        await baseDatos.guardar('historial', registroActualizado);
        cerrarModal();
        await cargarDatos(); 
        alert("✅ Registro actualizado (AHT Recalculado)");
    } catch (e) { alert("Error: " + e); }
});

// Cerrar Modal
btnCloseX.addEventListener('click', cerrarModal);
btnCancel.addEventListener('click', cerrarModal);
modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });

/* =========================================
   6. EVENTOS GLOBALES
   ========================================= */
if (btnBackHome) {
    btnBackHome.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

// Eliminar
window.borrarRegistro = async (idUnico) => {
    if (confirm("¿Estás seguro de eliminar este registro?")) {
        await baseDatos.eliminar('historial', idUnico);
        await cargarDatos();
    }
};

// Listeners de búsqueda y exportación
txtSearch.addEventListener('input', aplicarFiltros);
numLimit.addEventListener('change', aplicarFiltros);
btnRefresh.addEventListener('click', cargarDatos);


//exportar a json
if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
        // 1. Verificamos si hay datos cargados en la variable global
        if (!todosLosRegistros || todosLosRegistros.length === 0) {
            alert("⚠️ No hay datos en el historial para exportar.");
            return;
        }

        try {
            // 2. Convertimos el array de objetos a una cadena JSON con sangría (2 espacios)
            const dataStr = JSON.stringify(todosLosRegistros, null, 2);
            
            // 3. Creamos un Blob (Binary Large Object) tipo JSON
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            // 4. Creamos el link de descarga
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            
            // Nombre del archivo con fecha actual
            const fecha = new Date().toLocaleDateString().replace(/\//g, '-');
            link.download = `Backup_Historial_${fecha}.json`;
            link.href = url;
            
            // 5. Forzamos la descarga y limpiamos
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            console.log("✅ Backup JSON generado con éxito");
        } catch (error) {
            console.error("Error al exportar JSON:", error);
            alert("❌ Hubo un error al generar el archivo JSON.");
        }
    });
}

// Exportar filtrado
btnExport.addEventListener('click', () => {
    const term = txtSearch.value.trim().toLowerCase();
    const exportar = todosLosRegistros.filter(r => {
        if (!term) return true;
        // Misma lógica de búsqueda para la exportación
        const texto = `${r.id} ${r.cliente} ${r.cedula || ''}`.toLowerCase();
        return texto.includes(term);
    });

    if (!exportar.length) return alert("Nada que exportar");

    let csv = "Fecha,Hora,ID,Cliente,Celular,Tec,Falla,Duracion,Obs\n";
    exportar.forEach(r => {
        const o = (r.obs || '').replace(/"/g, '""').replace(/(\r\n|\n|\r)/gm, " ");
        csv += `${r.fecha},${r.hora},${r.id},"${r.cliente}","${r.celular}",${r.tec},"${r.falla}",${r.duracion},"${o}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`;
    link.click();
});

// Iniciar
initDash();