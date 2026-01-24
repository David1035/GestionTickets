/* ==========================================================================
   ARCHIVO: js/data.js - GESTIÓN TOTAL
   ========================================================================== */

let todosLosRegistros = [];

document.addEventListener('DOMContentLoaded', async () => {
    await baseDatos.iniciar();
    cargarTabla();
});

// 1. CARGAR DATOS
async function cargarTabla() {
    try {
        todosLosRegistros = await baseDatos.leerTodo('historial');
        todosLosRegistros.sort((a, b) => b.id_unico - a.id_unico); // Recientes primero
        renderizar(todosLosRegistros);
    } catch (e) { console.error(e); }
}

// 2. RENDERIZAR (Botones a la Izquierda)
function renderizar(datos) {
    const tbody = document.getElementById('tabla_body');
    tbody.innerHTML = '';

    datos.forEach(reg => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <button class="btn-action btn-edit" onclick="abrirModal(${reg.id_unico})" title="Modificar Completo">✏️</button>
                <button class="btn-action btn-del" onclick="borrar(${reg.id_unico})" title="Eliminar">🗑️</button>
            </td>
            <td>${reg.fecha}<br><small>${reg.hora}</small></td>
            <td style="font-weight:bold; color:#2563eb;">${reg.id}</td>
            <td>${reg.cliente}</td>
            <td>${reg.cedula}</td>
            <td>${reg.celular}</td>
            <td>${reg.tec || '-'}</td>
            <td class="col-obs" title="${reg.obs}">${reg.obs}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. BUSCADOR
document.getElementById('buscador').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtrados = todosLosRegistros.filter(r => 
        (r.id && r.id.toLowerCase().includes(term)) || 
        (r.cliente && r.cliente.toLowerCase().includes(term)) ||
        (r.cedula && r.cedula.toString().includes(term))
    );
    renderizar(filtrados);
});

// 4. ABRIR MODAL (Todos los campos)
async function abrirModal(idUnico) {
    const reg = todosLosRegistros.find(r => r.id_unico === idUnico);
    if (!reg) return;

    // IDs
    document.getElementById('edit_id_unico').value = reg.id_unico;
    document.getElementById('edit_id').value = reg.id || '';
    
    // Cliente
    document.getElementById('edit_cliente').value = reg.cliente || '';
    document.getElementById('edit_fecha_hora').value = `${reg.fecha} - ${reg.hora}`;
    document.getElementById('edit_cedula').value = reg.cedula || '';
    document.getElementById('edit_celular').value = reg.celular || '';

    // SMNET (Integrada y Unitaria - Nota: en app.js se guardan como prueba_smnet y smnet_unitaria pero el objeto guardado keys pueden variar si no se mapearon. Asumo mapeo de app.js)
    // Revisando app.js: el objeto no guardaba explícitamente smnetInt y smnetUnit, solo los campos del DOM se usaban para copiar. 
    // CORRECCIÓN: Para que esto funcione bien, el app.js DEBE haber guardado estos campos. 
    // Si tu app.js actual NO los guarda en el objeto 'reg', aquí saldrán vacíos.
    // Asumiendo que agregaremos esos campos al guardado en el futuro o si ya existen:
    document.getElementById('edit_smnet_int').value = reg.smnet_integrada || ''; // Necesita ajuste en app.js si no se guarda
    document.getElementById('edit_smnet_unit').value = reg.smnet_unitaria || '';

    // Técnico
    document.getElementById('edit_tec').value = reg.tec || '';
    document.getElementById('edit_prod').value = reg.prod || '';
    document.getElementById('edit_falla').value = reg.falla || '';
    document.getElementById('edit_tv_data').value = reg.tv_data || '';
    document.getElementById('edit_obs').value = reg.obs || '';

    // Checks
    document.getElementById('edit_notif').checked = !!reg.notif_confirmada;
    document.getElementById('edit_venta').checked = !!reg.venta_ofrecida;

    // Tiempo (Segundos a Minutos)
    const minutos = ((reg.duracion || 0) / 60).toFixed(2);
    document.getElementById('edit_duracion_min').value = minutos;

    document.getElementById('modal_edit').classList.add('active');
}

function cerrarModal() {
    document.getElementById('modal_edit').classList.remove('active');
}

// 5. GUARDAR EDICIÓN
async function guardarEdicion() {
    const idUnico = parseInt(document.getElementById('edit_id_unico').value);
    const regOriginal = todosLosRegistros.find(r => r.id_unico === idUnico) || {};

    // Tiempo (Minutos a Segundos)
    const min = parseFloat(document.getElementById('edit_duracion_min').value) || 0;
    
    const regEditado = {
        ...regOriginal,
        id: document.getElementById('edit_id').value,
        cliente: document.getElementById('edit_cliente').value,
        cedula: document.getElementById('edit_cedula').value,
        celular: document.getElementById('edit_celular').value,
        
        // Guardamos los nuevos campos explícitamente
        smnet_integrada: document.getElementById('edit_smnet_int').value,
        smnet_unitaria: document.getElementById('edit_smnet_unit').value,
        
        tec: document.getElementById('edit_tec').value,
        prod: document.getElementById('edit_prod').value,
        falla: document.getElementById('edit_falla').value,
        tv_data: document.getElementById('edit_tv_data').value,
        obs: document.getElementById('edit_obs').value,
        
        notif_confirmada: document.getElementById('edit_notif').checked,
        venta_ofrecida: document.getElementById('edit_venta').checked,
        
        duracion: (min * 60)
    };

    try {
        await baseDatos.guardar('historial', regEditado);
        cerrarModal();
        cargarTabla();
        alert("✅ Actualizado");
    } catch (e) { alert("Error: " + e); }
}

// 6. BORRAR
async function borrar(id) {
    if(confirm("¿Eliminar registro permanentemente?")) {
        await baseDatos.eliminar('historial', id);
        cargarTabla();
    }
}

// 7. EXPORTAR JSON
function exportarJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(todosLosRegistros, null, 2));
    const a = document.createElement('a');
    a.href = dataStr; a.download = `backup_tickets_${new Date().toLocaleDateString().replace(/\//g,'-')}.json`;
    a.click(); a.remove();
}

// 8. EXPORTAR EXCEL (CSV)
function exportarExcel() {
    if(todosLosRegistros.length === 0) return alert("No hay datos para exportar");

    // Definir cabeceras
    const headers = [
        "Fecha", "Hora", "ID Llamada", "Cliente", "Documento", "Celular", 
        "Tecnología", "Producto", "Falla", "SMNET Int", "SMNET Unit", 
        "Obs", "Notif. Enviada", "Venta", "Duración (min)", "TV Data"
    ];

    // Convertir datos a CSV
    const csvRows = [];
    csvRows.push(headers.join(",")); // Fila cabecera

    todosLosRegistros.forEach(r => {
        const row = [
            `"${r.fecha}"`,
            `"${r.hora}"`,
            `"${r.id || ''}"`,
            `"${r.cliente || ''}"`,
            `"${r.cedula || ''}"`,
            `"${r.celular || ''}"`,
            `"${r.tec || ''}"`,
            `"${r.prod || ''}"`,
            `"${r.falla || ''}"`,
            `"${r.smnet_integrada || ''}"`, // Asegurarse que estos existan en el objeto
            `"${r.smnet_unitaria || ''}"`,
            `"${(r.obs || '').replace(/"/g, '""')}"`, // Escapar comillas en obs
            r.notif_confirmada ? "SI" : "NO",
            r.venta_ofrecida ? "SI" : "NO",
            ((r.duracion || 0) / 60).toFixed(2),
            `"${r.tv_data || ''}"`
        ];
        csvRows.push(row.join(","));
    });

    const csvString = csvRows.join("\n");
    // BOM para que Excel reconozca tildes y caracteres especiales (UTF-8)
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Tickets_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`;
    a.click();
    a.remove();
}