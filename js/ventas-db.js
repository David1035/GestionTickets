/* =========================================
   ARCHIVO: js/ventas-db.js
   ========================================= */
class GestorVentasDB {
    constructor() {
        this.nombreDB = 'CRM_VentasTigo';
        this.version = 1;
        this.db = null;
    }

    async iniciar() {
        if (this.db) return true; // Ya está abierta
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.nombreDB, this.version);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('ventas')) {
                    db.createObjectStore('ventas', { keyPath: 'id_unico' });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(true);
            };
            request.onerror = (e) => reject("Error DB Ventas: " + e.target.error);
        });
    }

    async guardarVenta(datos) {
        await this.iniciar(); // Asegura conexión
        const tx = this.db.transaction(['ventas'], 'readwrite');
        const store = tx.objectStore('ventas');
        return new Promise((resolve, reject) => {
            const req = store.put(datos);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    async obtenerTodas() {
        await this.iniciar();
        const tx = this.db.transaction(['ventas'], 'readonly');
        const store = tx.objectStore('ventas');
        return new Promise((resolve) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
        });
    }

    async eliminarVenta(id) {
        await this.iniciar();
        const tx = this.db.transaction(['ventas'], 'readwrite');
        const store = tx.objectStore('ventas');
        return new Promise((resolve) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve(true);
        });
    }
}

const dbVentas = new GestorVentasDB();