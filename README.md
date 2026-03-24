# Brave New Tab Organizer

Extensión para Chrome/Brave que reemplaza la nueva pestaña por una vista organizada de carpetas y marcadores.

## Qué hace ahora

- Override de `new tab`
- Lectura real de marcadores con `chrome.bookmarks`
- Lista lateral de carpetas
- Búsqueda por título, host o URL con orden por similitud (tolerante a typos simples)
- Área de marcadores fijados con persistencia en `chrome.storage.local`
- Crear carpetas
- Crear marcadores
- Editar marcadores y moverlos entre carpetas
- Borrar marcadores y carpetas
- Modo organizar con drag & drop para:
  - reordenar carpetas
  - reordenar marcadores dentro de la carpeta activa
  - mover marcadores entre carpetas usando la bandeja inferior
- Widget de tiempo con previsión de 3 días y cambio de ciudad persistente
- Widget de calendario mensual
- Wallpapers predefinidos + wallpaper personalizado por subida de imagen
- Persistencia de carpeta activa entre pestañas y ventanas
- Atajos:
  - `/` y `Ctrl/Cmd + K` enfocan la búsqueda,
  - `N` crea marcador, `Shift + N` crea carpeta,
  - `↑` / `↓` navega resultados de búsqueda,
  - `Enter` abre el resultado resaltado al buscar,
  - `Esc` cierra edición/modal/organize mode
- Toast feedback para acciones de usuario
- Fallback de datos mock para desarrollo fuera de la extensión

## Stack

- React 19
- Vite 8
- TypeScript
- Manifest V3
- `@dnd-kit` para drag & drop

## Estructura del repo

```text
src/
  App.tsx          -> orchestración principal de estado y flujo
  components/      -> componentes extraídos para mantener UI limpia
    SearchBar.tsx
    Toast.tsx
    WallpaperPanel.tsx
  lib/             -> utilidades sin efectos laterales
    search.ts      -> normalización + puntuación y ordenado de búsqueda
    storage.ts     -> claves y wrappers de storage/localStorage
    image.ts       -> lectura y redimensionado de imágenes local
    wallpaper.ts   -> presets y lógica de persistencia de wallpaper
  App.css      -> estilos completos de la interfaz
  main.tsx     -> bootstrap de React
  index.css    -> estilos globales base
public/
  manifest.json
  favicon.svg
  icons.svg
dist/          -> build listo para cargar como extensión
```

Más detalle en:

- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/SESSION_NOTES.md`

## Cómo funciona

La app vive casi entera en `src/App.tsx`.

### Fuentes de datos

- `chrome.bookmarks`
  - se usa para leer, crear, editar, borrar y mover marcadores/carpetas
- `chrome.storage.local`
  - persiste wallpaper, nota rápida, ciudad del tiempo y marcadores fijados
  - persiste carpeta activa (`newtab.selectedFolder`)
- Open-Meteo
  - geocoding + previsión meteorológica

### Modo desarrollo fuera de la extensión

Si `chrome.bookmarks` no existe, la app usa `FALLBACK_TREE` para que se pueda iterar visualmente con `npm run dev`.

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

El build sale en `dist/`.

## Cargar en Brave o Chrome

1. Ejecuta `npm run build`
2. Abre `brave://extensions` o `chrome://extensions`
3. Activa **Developer mode**
4. Pulsa **Load unpacked**
5. Selecciona la carpeta `dist/`

## Persistencia actual

Claves guardadas en `chrome.storage.local`:

- `newtab.wallpaper`
- `newtab.wallpaperBlur`
- `newtab.note`
- `newtab.weatherCity`
- `newtab.pinnedBookmarks`
- `newtab.selectedFolder`
- `newtab.widgetShowWallpaperPanel`
- `newtab.widgetShowWeatherWidget`
- `newtab.widgetShowPinnedWidget`
- `newtab.widgetShowNoteWidget`
- El wallpaper personalizado ya no se guarda entero en `chrome.storage.local`: se guarda una marca ligera en storage/localStorage y la imagen real en `IndexedDB`, para evitar que se pierda por límites de cuota al reiniciar Brave o abrir nuevas ventanas.
- Para que una ventana nueva pinte el fondo al instante, también se guarda una preview pequeña en `localStorage`, y `index.html` la aplica antes de que arranque React; luego se reemplaza con la imagen completa desde `IndexedDB` con una transición tipo blur-up para disimular la carga.
- Los wallpapers subidos se redimensionan y comprimen antes de guardarse para reducir tamaño.

## Notas rápidas para futura memoria

- El proyecto todavía está muy centralizado en `App.tsx`.
- La siguiente mejora natural sería extraer widgets y lógica de storage a componentes/hooks.
- Los wallpapers predefinidos son gradientes CSS, así que no dependen de assets externos.
- Los toasts son locales, simples y sin librerías externas.
sual mensual, no integra eventos todavía.
