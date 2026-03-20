// ===== INICIALIZACIÓN Y SERVICE WORKER =====
document.addEventListener('DOMContentLoaded', () => {
    initDB().then(() => {
        initApp();
    });
    registerServiceWorker();
    setupNavigation();
    setupEventListeners();
});

// En modo standalone TODO es local (offline-first).
// El estado de red solo sirve como información extra.
let isOnline = navigator.onLine;
const syncStatus = document.getElementById('sync-status');
const offlineAlert = document.getElementById('offline-alert');

function updateOnlineStatus() {
    isOnline = navigator.onLine;
    if (isOnline) {
        syncStatus.textContent = '🟢 Online (Modo Local)';
        if(offlineAlert) offlineAlert.style.display = 'none';
    } else {
        syncStatus.textContent = '🔴 Offline (Modo Local)';
        if(offlineAlert) offlineAlert.style.display = 'block';
    }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered', reg))
            .catch(err => console.log('SW Error', err));
    }
}

// ===== NAVEGACIÓN SPA =====
function setupNavigation() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    const sections = document.querySelectorAll('.app-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            
            // Update Active State
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            // Load specific data based on tab
            if (targetId === 'productos') loadProductos();
            if (targetId === 'dashboard') loadDashboard();
            if (targetId === 'clientes') loadClientes();
            if (targetId === 'ventas') initVenta();
            if (targetId === 'reportes') loadHistorial();
        });
    });
}

function initApp() {
    updateOnlineStatus();
    loadDashboard();
}

// ===== INDEXEDDB (OFFLINE STORAGE TOTAL) =====
let db;
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('TiendaRopaStandalone', 1);
        
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('productos')) {
                db.createObjectStore('productos', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('clientes')) {
                db.createObjectStore('clientes', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('ventas')) {
                const ventasStore = db.createObjectStore('ventas', { keyPath: 'id', autoIncrement: true });
                ventasStore.createIndex('fecha', 'fecha', { unique: false });
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        
        request.onerror = (e) => {
            console.error('IndexedDB error:', e);
            reject(e);
        };
    });
}

// Promisificar operaciones de IndexedDB para facilidad
function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbAdd(storeName, item) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.add(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbUpdate(storeName, item) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbDelete(storeName, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ===== DASHBOARD =====
async function loadDashboard() {
    try {
        const productos = await dbGetAll('productos');
        const ventas = await dbGetAll('ventas');
        
        document.getElementById('dash-productos-total').textContent = productos.length;
        document.getElementById('dash-stock-bajo').textContent = productos.filter(p => p.stock <= 5).length;
        
        const hoy = new Date().toISOString().split('T')[0];
        let ventasHoy = ventas.filter(v => v.fecha.startsWith(hoy));
        
        let totalVentas = ventasHoy.reduce((acc, v) => acc + v.total, 0);
        document.getElementById('dash-ventas-hoy').textContent = `$${totalVentas.toFixed(2)}`;
    } catch (e) {
        console.error("Error al cargar dashboard", e);
    }
}

// ===== PRODUCTOS =====
let productosDisponibles = [];
async function loadProductos() {
    const list = document.getElementById('lista-productos');
    list.innerHTML = '<p class="text-center">Cargando...</p>';
    
    try {
        productosDisponibles = await dbGetAll('productos');
        
        list.innerHTML = '';
        if (productosDisponibles.length === 0) {
            list.innerHTML = '<p class="text-center text-muted">No hay productos registrados.</p>';
            return;
        }

        productosDisponibles.forEach(prod => {
            const item = document.createElement('div');
            item.className = 'mobile-list-item';
            item.innerHTML = `
                <div class="mobile-list-info">
                    <h5 class="mobile-list-title">${prod.nombre} <small class="text-muted">#${prod.id}</small></h5>
                    <p class="mobile-list-subtitle">Stock: ${prod.stock}</p>
                </div>
                <div class="mobile-list-value d-flex flex-column align-items-end">
                    <span>$${parseFloat(prod.precio_efectivo).toFixed(2)}</span>
                    <button class="btn btn-sm btn-outline-danger mt-1" onclick="eliminarProducto(${prod.id})">🗑️</button>
                </div>
            `;
            list.appendChild(item);
        });
    } catch (e) {
        console.error("Error al cargar productos", e);
        list.innerHTML = '<p class="text-center text-danger">Error al cargar productos.</p>';
    }
}

function abrirModalProducto() {
    const m = new bootstrap.Modal(document.getElementById('modalProducto'));
    m.show();
}

async function guardarProducto() {
    const nombre = document.getElementById('prod-nombre').value;
    const stock = parseInt(document.getElementById('prod-stock').value || 0);
    const precio = parseFloat(document.getElementById('prod-precio').value || 0);

    if (!nombre) return alert('El nombre es obligatorio');

    const nuevoProducto = {
        nombre: nombre,
        stock: stock,
        precio_efectivo: precio,
        fecha_creacion: new Date().toISOString()
    };

    try {
        await dbAdd('productos', nuevoProducto);
        bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
        document.getElementById('formProducto').reset();
        loadProductos(); // Recargar lista
        alert('Producto guardado localmente');
    } catch (e) {
        console.error(e);
        alert('Error al guardar producto');
    }
}

async function eliminarProducto(id) {
    if(confirm('¿Seguro que quieres eliminar este producto?')) {
        try {
            await dbDelete('productos', id);
            loadProductos();
        } catch (e) {
            console.error(e);
            alert('Error al eliminar');
        }
    }
}

// ===== VENTAS =====
let itemsVentaCorriente = [];

async function initVenta() {
    try {
        productosDisponibles = await dbGetAll('productos');
        const dl = document.getElementById('datalist-productos');
        dl.innerHTML = '';
        productosDisponibles.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.nombre; 
            opt.dataset.id = p.id;
            opt.dataset.precio = p.precio_efectivo;
            opt.dataset.stock = p.stock;
            dl.appendChild(opt);
        });
    } catch (e) {
        console.error("Error al cargar productos para venta", e);
    }
}

function setupEventListeners() {
    const searchInput = document.getElementById('venta-search');
    if(searchInput) {
        searchInput.addEventListener('change', (e) => {
            const val = e.target.value;
            const options = document.getElementById('datalist-productos').options;
            for (let i = 0; i < options.length; i++) {
                if (options[i].value === val) {
                    const id = parseInt(options[i].dataset.id);
                    const stock = parseInt(options[i].dataset.stock);
                    
                    if (stock <= 0) {
                        alert("¡Sin stock para este producto!");
                        document.getElementById('venta-search').value = '';
                        return;
                    }

                    agregarItemVenta(
                        id, 
                        val, 
                        parseFloat(options[i].dataset.precio)
                    );
                    e.target.value = '';
                    break;
                }
            }
        });
    }
}

function agregarItemVenta(id, nombre, precio) {
    const existente = itemsVentaCorriente.find(i => i.producto_id === id);
    if (existente) {
        existente.cantidad += 1;
        existente.subtotal = existente.cantidad * existente.precio_unitario;
    } else {
        itemsVentaCorriente.push({
            producto_id: id,
            producto_nombre: nombre,
            cantidad: 1,
            precio_unitario: precio,
            subtotal: precio
        });
    }
    renderVentaItems();
}

function quitarItemVenta(id) {
    itemsVentaCorriente = itemsVentaCorriente.filter(i => i.producto_id !== id);
    renderVentaItems();
}

function renderVentaItems() {
    const container = document.getElementById('venta-items-container');
    const msg = document.getElementById('empty-venta-msg');
    
    if (itemsVentaCorriente.length === 0) {
        container.innerHTML = '';
        container.appendChild(msg);
        msg.style.display = 'block';
        document.getElementById('venta-total-monto').textContent = '$0.00';
        return;
    }

    msg.style.display = 'none';
    let html = '';
    let total = 0;

    itemsVentaCorriente.forEach(item => {
        html += `
            <div class="venta-item-row">
                <div>
                    <strong>${item.producto_nombre}</strong>
                    <div class="text-muted small">${item.cantidad} x $${item.precio_unitario.toFixed(2)}</div>
                </div>
                <div class="d-flex align-items-center">
                    <span class="me-3 fw-bold">$${item.subtotal.toFixed(2)}</span>
                    <button class="btn btn-sm btn-outline-danger" onclick="quitarItemVenta(${item.producto_id})">🗑️</button>
                </div>
            </div>
        `;
        total += item.subtotal;
    });

    container.innerHTML = html;
    document.getElementById('venta-total-monto').textContent = `$${total.toFixed(2)}`;
}

async function procesarVenta() {
    if (itemsVentaCorriente.length === 0) return alert('No hay productos en la venta.');
    
    const metodo = document.getElementById('venta-metodoPago').value;
    const total = itemsVentaCorriente.reduce((acc, curr) => acc + curr.subtotal, 0);

    const dataVenta = {
        fecha: new Date().toISOString(),
        metodo_pago: metodo,
        subtotal: total,
        total: total,
        items: itemsVentaCorriente
    };

    try {
        // Guardar venta
        await dbAdd('ventas', dataVenta);
        
        // Descontar stock de productos
        const tx = db.transaction(['productos'], 'readwrite');
        const store = tx.objectStore('productos');
        
        for(let item of itemsVentaCorriente) {
            const req = store.get(item.producto_id);
            req.onsuccess = () => {
                const prod = req.result;
                if(prod) {
                    prod.stock = Math.max(0, prod.stock - item.cantidad);
                    store.put(prod);
                }
            };
        }

        alert('¡Venta realizada exitosamente!');
        limpiarVenta();
        loadDashboard();
    } catch (e) {
        console.error("Error al procesar venta", e);
        alert("Hubo un error al procesar la venta.");
    }
}

function limpiarVenta() {
    itemsVentaCorriente = [];
    document.getElementById('venta-search').value = '';
    renderVentaItems();
}

// ===== CLIENTES =====
async function loadClientes() {
    const list = document.getElementById('lista-clientes');
    list.innerHTML = '<p class="text-center">Cargando...</p>';
    
    try {
        const clientes = await dbGetAll('clientes');
        
        list.innerHTML = '';
        if (clientes.length === 0) {
            list.innerHTML = '<p class="text-center text-muted">No hay clientes registrados.</p>';
            return;
        }

        clientes.forEach(c => {
            const item = document.createElement('div');
            item.className = 'mobile-list-item';
            item.innerHTML = `
                <div class="mobile-list-info">
                    <h5 class="mobile-list-title">${c.nombre}</h5>
                    <p class="mobile-list-subtitle">Tel: ${c.telefono || '-'}</p>
                </div>
            `;
            list.appendChild(item);
        });
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p class="text-center text-danger">Error al cargar clientes</p>';
    }
}

function abrirModalCliente() {
    const nombre = prompt('Ingresa el nombre del cliente:');
    if (!nombre) return;
    const tel = prompt('Ingresa el teléfono del cliente (opcional):');
    
    dbAdd('clientes', { nombre: nombre, telefono: tel })
        .then(() => {
            alert('Cliente creado exitosamente');
            loadClientes();
        })
        .catch(e => {
            console.error(e);
            alert('Error al crear cliente');
        });
}

// ===== HISTORIAL (REPORTES) =====
async function loadHistorial() {
    const section = document.getElementById('lista-historial');
    if (!section) return; // if reportes tab not ready yet

    section.innerHTML = '<p class="text-center">Cargando...</p>';
    try {
        const ventas = await dbGetAll('ventas');
        // Ordenar por más recientes
        ventas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        section.innerHTML = '';
        if (ventas.length === 0) {
            section.innerHTML = '<p class="text-center text-muted">No hay historial de ventas.</p>';
            return;
        }

        ventas.forEach(v => {
            const f = new Date(v.fecha);
            const fechaStr = f.toLocaleDateString() + ' ' + f.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const item = document.createElement('div');
            item.className = 'mobile-list-item';
            
            let htmlItems = ``;
            if(v.items && v.items.length) {
                htmlItems = `<ul class="small text-muted mt-2 ps-3 mb-0">`;
                v.items.forEach(i => {
                    htmlItems += `<li>${i.cantidad}x ${i.producto_nombre}</li>`;
                });
                htmlItems += `</ul>`;
            }

            item.innerHTML = `
                <div class="mobile-list-info w-100">
                    <div class="d-flex justify-content-between">
                        <h6 class="mobile-list-title">Venta #${v.id}</h6>
                        <span class="mobile-list-value text-success">$${parseFloat(v.total).toFixed(2)}</span>
                    </div>
                    <p class="mobile-list-subtitle mb-1">${fechaStr} | ${v.metodo_pago}</p>
                    ${htmlItems}
                </div>
            `;
            section.appendChild(item);
        });
    } catch (e) {
        console.error(e);
        section.innerHTML = '<p class="text-danger text-center">Error al cargar historial.</p>';
    }
}
