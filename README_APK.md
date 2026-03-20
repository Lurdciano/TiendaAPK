# Gestión Tienda Ropa - PWA (APK Móvil)

Esta carpeta contiene la versión Progressive Web App (PWA) de tu sistema, 100% responsiva, adaptada para celulares y con soporte Offline (sin internet).

## 🚀 Cómo Probar la PWA

### Opción 1: Servir estáticamente (Recomendado)
Puedes abrir el archivo `index.html` directamente en tu navegador, o usar un servidor estático rápido:
```bash
cd APK
python -m http.server 8000
```
Luego entra desde tu celular a la IP de tu PC en la misma red WiFi: `http://TU_IP_LOCAL:8000`

### Opción 2: Desde el Servidor Flask existente
Puedes configurar en tu `app.py` una nueva ruta para servir la PWA:

```python
@app.route('/apk')
def serve_apk():
    return send_from_directory('APK', 'index.html')

@app.route('/apk/<path:path>')
def serve_apk_static(path):
    return send_from_directory('APK', path)
```
Y abrir `http://localhost:5000/apk`.

## 📱 Cómo Instalar la PWA en el Celular
1. Entra a la URL de la PWA (ej: `http://192.168.0.x:8000/`) desde Chrome en Android o Safari en iOS.
2. Toca el menú de opciones del navegador (los 3 puntitos).
3. Selecciona **"Agregar a la pantalla principal"** o **"Instalar aplicación"**.
4. ¡Listo! Ahora la tendrás como una app nativa en tu celular.

## 🔌 Soporte Offline
- La PWA guarda ventas pendientes (de manera local vía IndexedDB) si te quedas sin conexión.
- Una vez que recuperes internet, las ventas registradas durante el modo offline se sincronizarán solas hacia la base de datos principal (`tienda_ropa.db`), usando los endpoints `/api/*` existentes.

## 📦 Empaquetado PyInstaller
Si vas a crear el ejecutable `.exe` y quieres incluir esta PWA adentro, debes actualizar tu archivo `empaquetar_win7_32bits.py` o los comandos de PyInstaller para asegurar que copie la carpeta `APK`.
Ejemplo:
```bash
pyinstaller --add-data "APK;APK" app.py
```

## 🔄 Cómo actualizar
- Todo el código visual de la PWA vive en `APK/templates/` y `APK/index.html`.
- Los estilos están en `APK/static/css/styles.css`.
- La lógica de negocio está en `APK/static/js/app.js`.
- Modifica estos archivos libremente; la PWA cacheará los estáticos gracias al `sw.js`. 
- Si haces muchos cambios, acurdate de cambiar la versión del `CACHE_NAME` dentro de `APK/sw.js` para forzar la actualización en los celulares.
