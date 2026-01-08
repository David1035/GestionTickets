/* =========================================
   ARCHIVO: js/db.js
   PROPÓSITO: Motor de Base de Datos Compartido
   NOTA: Este script debe cargarse ANTES que app.js o dashboard.js
   ========================================= */

class GestorDB {
    constructor() {
        this.nombreDB = 'SistemaGestionDB';
        this.version = 1;
        this.db = null;
    }

    // Abre la conexión y crea las "tablas" si no existen
    async iniciar() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.nombreDB, this.version);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                // 1. Almacén de Historial de Llamadas
                if (!db.objectStoreNames.contains('historial')) {
                    db.createObjectStore('historial', { keyPath: 'id_unico' });
                }
                // 2. Almacén de Configuración (Claves Rápidas)
                if (!db.objectStoreNames.contains('configuracion')) {
                    db.createObjectStore('configuracion', { keyPath: 'clave' });
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                // console.log("DB: Conexión establecida");
                resolve(true);
            };

            request.onerror = (e) => reject("Error DB: " + e.target.error);
        });
    }

    // Guardar o Actualizar un registro
    async guardar(tabla, datos) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("La base de datos no está iniciada");
            const tx = this.db.transaction([tabla], 'readwrite');
            const store = tx.objectStore(tabla);
            const req = store.put(datos);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // Leer todos los registros de una tabla
    async leerTodo(tabla) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("La base de datos no está iniciada");
            const tx = this.db.transaction([tabla], 'readonly');
            const store = tx.objectStore(tabla);
            const req = store.getAll();
            req.onsuccess = () => {
                // Ordenamos por defecto del más nuevo al más viejo si tienen id_unico (timestamp)
                const resultados = req.result || [];
                resultados.sort((a, b) => b.id_unico - a.id_unico);
                resolve(resultados);
            };
            req.onerror = () => reject(req.error);
        });
    }

    // Leer un solo registro por su clave
    async leerUno(tabla, clave) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("La base de datos no está iniciada");
            const tx = this.db.transaction([tabla], 'readonly');
            const store = tx.objectStore(tabla);
            const req = store.get(clave);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // Eliminar un registro
    async eliminar(tabla, id) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("La base de datos no está iniciada");
            const tx = this.db.transaction([tabla], 'readwrite');
            const store = tx.objectStore(tabla);
            const req = store.delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }
}

// === INSTANCIA GLOBAL ===
// Al crear esto aquí, la variable "baseDatos" estará disponible en cualquier script 
// que se cargue DESPUÉS de este archivo.
const baseDatos = new GestorDB();