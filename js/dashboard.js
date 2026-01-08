/* ==========================================================================
   js/dashboard.js - VERSIÓN FINAL PRO
   Funciones: Búsqueda inteligente, Conversor tiempo, Exportación JSON/CSV,
              Acciones al inicio y Doble clic para copiar.
   ========================================================================== */

// --- 1. REFERENCIAS DOM ---
const tbody = document.getElementById('dashboard_body');
const txtSearch = document.getElementById('txt_search');
const numLimit = document.getElementById('num_limit');
const btnRefresh = document.getElementById('btn_refresh');
const msgNoResults = document.getElementById('no_results');
const btnExport = document.getElementById('btn_export_dash');
const btnBackHome = document.getElementById('btn_back_home');
const btnExportJson = document.getElementById('btn_export_json');
const toast = document.getElementById('toast');

// Elementos del Modal
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
        console.log("✅ DB Dashboard Ready");
        await cargarDatos();
        setupTimeConverters(); 
    } catch (e) { console.error("Error al iniciar dashboard:", e); }
}

async function cargarDatos() {
    todosLosRegistros = await baseDatos.leerTodo('historial');
    aplicarFiltros();
}

/* =========================================
   3. FUNCIONES DE UTILIDAD (COPIAR)
   ========================================= */
function copiarRapido(texto) {
    if (!texto || texto === '-') return;
    navigator.clipboard.writeText(texto).then(() => {
        if (toast) {
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
        }
    });
}

/* =========================================
   4. FILTRADO Y TABLA (ACCIONES AL INICIO)
   ========================================= */
function aplicarFiltros() {
    const term = txtSearch.value.trim().toLowerCase();
    const limit = parseInt(numLimit.value) || 20;

    const filtrados = todosLosRegistros.filter(r => {
        if (!term) return true;
        const idDB = String(r.id || '').toLowerCase();
        const clienteDB = String(r.cliente || '').toLowerCase();
        const cedulaDB = String(r.cedula || '').toLowerCase();
        const textoCompleto = `${idDB} ${clienteDB} ${cedulaDB}`;
        return textoCompleto.includes(term);
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = '';
        msgNoResults.style.display = 'block';
        return;
    }
    msgNoResults.style.display = 'none';
    pintarTabla(filtrados.slice(0, limit));
}

function pintarTabla(datos) {
    tbody.innerHTML = '';
    
    datos.forEach(reg => {
        const tr = document.createElement('tr');
        
        // El orden ahora es: Acciones, Fecha, ID, Observaciones, Cliente, Celular...
        tr.innerHTML = `
            <td style="text-align: center;">
                <div class="action-btn-group">
                    <button class="btn-action btn-edit" onclick="abrirEdicion(${reg.id_unico})" title="Modificar">✏️</button>
                    <button class="btn-action btn-del" onclick="borrarRegistro(${reg.id_unico})" title="Eliminar">🗑️</button>
                </div>
            </td>
            <td style="font-size:0.85rem;">${reg.fecha}<br><span style="color:#94a3b8">${reg.hora}</span></td>
            <td class="col-id" ondblclick="copiarRapido('${reg.id}')" title="Doble clic para copiar">${reg.id}</td>
            
            <td class="col-obs" ondblclick="copiarRapido('${reg.obs.replace(/'/g, "\\'")}')" title="Doble clic para copiar">${reg.obs}</td>
            
            <td><b>${reg.cliente || '-'}</b></td>
            <td>${reg.celular || '-'}</td>
            <td>${reg.tec || '-'}</td>
            <td>${reg.falla || '-'}</td>
            <td class="col-duracion">${reg.duracion}s</td>
        `;
        tbody.appendChild(tr);
    });
}

/* =========================================
   5. CONVERSORES DE TIEMPO
   ========================================= */
function setupTimeConverters() {
    if (editMinutos) {
        editMinutos.addEventListener('input', () => {
            const mins = parseFloat(editMinutos.value) || 0;
            editDuracion.value = (mins * 60).toFixed(2);
        });
    }
    if (editDuracion) {
        editDuracion.addEventListener('input', () => {
            const secs = parseFloat(editDuracion.value) || 0;
            editMinutos.value = (secs / 60).toFixed(2);
        });
    }
}

/* =========================================
   6. SISTEMA DE EDICIÓN (MODAL)
   ========================================= */
window.abrirEdicion = (idUnico) => {
    const registro = todosLosRegistros.find(r => r.id_unico === idUnico);
    if (!registro) return;

    document.getElementById('edit_id_unico').value = registro.id_unico;
    document.getElementById('edit_call_id').value = registro.id || '';
    document.getElementById('edit_cliente').value = registro.cliente || '';
    document.getElementById('edit_celular').value = registro.celular || '';
    document.getElementById('edit_cedula').value = registro.cedula || '';
    document.getElementById('edit_tec').value = registro.tec || '';
    document.getElementById('edit_falla').value = registro.falla || '';
    
    const segundos = registro.duracion || 0;
    editDuracion.value = segundos;
    editMinutos.value = (segundos / 60).toFixed(2);

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
        duracion: parseFloat(editDuracion.value) || 0,
        obs: editObs.value
    };

    try {
        await baseDatos.guardar('historial', registroActualizado);
        cerrarModal();
        await cargarDatos(); 
        alert("✅ Registro actualizado correctamente.");
    } catch (e) { alert("Error al guardar: " + e); }
});

btnCloseX.addEventListener('click', cerrarModal);
btnCancel.addEventListener('click', cerrarModal);
modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });

/* =========================================
   7. EVENTOS GLOBALES Y EXPORTACIÓN
   ========================================= */

// Redirección Volver
if (btnBackHome) {
    btnBackHome.addEventListener('click', () => { window.location.href = 'index.html'; });
}

// Eliminar Registro
window.borrarRegistro = async (idUnico) => {
    if (confirm("¿Estás seguro de eliminar este registro permanentemente?")) {
        await baseDatos.eliminar('historial', idUnico);
        await cargarDatos();
    }
};

txtSearch.addEventListener('input', aplicarFiltros);
numLimit.addEventListener('change', aplicarFiltros);
btnRefresh.addEventListener('click', cargarDatos);

// Exportar a JSON
if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
        if (!todosLosRegistros.length) return alert("⚠️ No hay datos para exportar.");
        try {
            const dataStr = JSON.stringify(todosLosRegistros, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            const fecha = new Date().toLocaleDateString().replace(/\//g, '-');
            link.download = `Backup_Historial_${fecha}.json`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) { alert("❌ Error al generar JSON"); }
    });
}

// Exportar a CSV (Filtrado)
btnExport.addEventListener('click', () => {
    const term = txtSearch.value.trim().toLowerCase();
    const exportar = todosLosRegistros.filter(r => {
        if (!term) return true;
        const texto = `${r.id} ${r.cliente} ${r.cedula || ''}`.toLowerCase();
        return texto.includes(term);
    });

    if (!exportar.length) return alert("Nada que exportar");

    let csv = "Fecha,Hora,ID,Cliente,Celular,Tec,Servicio,Falla,Duracion,Obs\n";
    exportar.forEach(r => {
        const o = (r.obs || '').replace(/"/g, '""').replace(/(\r\n|\n|\r)/gm, " ");
        csv += `${r.fecha},${r.hora},${r.id},"${r.cliente}","${r.celular}",${r.tec},${r.prod || '-'},"${r.falla}",${r.duracion},"${o}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Filtrado_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`;
    link.click();
});

// Iniciar aplicación
initDash();