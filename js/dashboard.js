/* =========================================
   js/dashboard.js - LÓGICA DEL CENTRO DE DATOS
   ========================================= */

// Elementos del DOM
const tbody = document.getElementById('dashboard_body');
const txtSearch = document.getElementById('txt_search');
const numLimit = document.getElementById('num_limit');
const btnRefresh = document.getElementById('btn_refresh');
const msgNoResults = document.getElementById('no_results');
const btnExport = document.getElementById('btn_export_dash');

// Variable global para guardar los datos crudos y filtrar sobre ellos
let todosLosRegistros = [];

// 1. FUNCIÓN PRINCIPAL DE CARGA
async function cargarDatos() {
    try {
        // Leemos todo de la DB usando la clase compartida
        todosLosRegistros = await baseDatos.leerTodo('historial');
        aplicarFiltros(); // Aplicamos búsqueda y límite
    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

// 2. FILTRADO Y RENDERIZADO
function aplicarFiltros() {
    const busqueda = txtSearch.value.trim().toLowerCase();
    const limite = parseInt(numLimit.value) || 20;

    // A. Filtrar por ID (o cliente si quisieras agregarlo)
    let filtrados = todosLosRegistros.filter(reg => {
        if (!busqueda) return true; // Si no hay búsqueda, pasan todos
        return reg.id.toLowerCase().includes(busqueda);
    });

    // B. Limitar cantidad
    const totalEncontrados = filtrados.length;
    const datosFinales = filtrados.slice(0, limite);

    // C. Pintar Tabla
    pintarTabla(datosFinales);

    // Feedback visual
    if (totalEncontrados === 0) {
        msgNoResults.style.display = 'block';
        tbody.innerHTML = '';
    } else {
        msgNoResults.style.display = 'none';
    }
}

// 3. GENERAR HTML DE LA TABLA
function pintarTabla(datos) {
    tbody.innerHTML = '';
    
    datos.forEach(reg => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size:0.75rem;">
                ${reg.fecha}<br><span style="color:#64748b">${reg.hora}</span>
            </td>
            <td><b>${reg.id}</b></td>
            <td>${reg.cliente || '-'}</td>
            <td>${reg.cedula || '-'}</td>
            <td>${reg.celular || '-'}</td>
            <td>${reg.duracion}s</td>
            <td class="obs-cell" title="${reg.obs}">${reg.obs}</td>
            <td>
                <button class="btn-mini btn-del-row" onclick="borrarDesdeDash(${reg.id_unico})">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 4. ELIMINAR REGISTRO
window.borrarDesdeDash = async (idUnico) => {
    if(confirm("¿Eliminar este registro permanentemente?")) {
        await baseDatos.eliminar('historial', idUnico);
        await cargarDatos(); // Recargar la tabla
    }
};

// 5. EVENT LISTENERS (REACTIVIDAD)

// Buscar al escribir (con un pequeño delay opcional, aquí directo)
txtSearch.addEventListener('input', () => {
    aplicarFiltros();
});

// Cambiar límite
numLimit.addEventListener('change', () => {
    aplicarFiltros();
});

// Botón Recargar
btnRefresh.addEventListener('click', cargarDatos);

// Botón Exportar lo que se ve en pantalla
btnExport.addEventListener('click', () => {
    const busqueda = txtSearch.value.trim().toLowerCase();
    // Filtramos de nuevo para exportar todo lo que coincida con la búsqueda (sin el límite visual)
    const datosParaExportar = todosLosRegistros.filter(reg => {
        if (!busqueda) return true;
        return reg.id.toLowerCase().includes(busqueda);
    });

    if (datosParaExportar.length === 0) return alert("No hay datos para exportar");

    let csv = "Fecha,Hora,ID,Cliente,Cedula,Celular,Duracion,Observaciones\n";
    datosParaExportar.forEach(r => {
        const obs = (r.obs || '').replace(/"/g, '""').replace(/(\r\n|\n|\r)/gm, " ");
        csv += `${r.fecha},${r.hora},${r.id},"${r.cliente}","${r.cedula}","${r.celular}",${r.duracion},"${obs}"\n`;
    });

    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Data_Filtrada_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`;
    link.click();
});

// 6. INICIALIZAR
async function initDash() {
    try {
        await baseDatos.iniciar();
        console.log("DB Conectada en Dashboard");
        cargarDatos();
    } catch (e) {
        console.error(e);
        alert("Error conectando DB");
    }
}

initDash();