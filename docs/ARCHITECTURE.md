# Architecture

## Resumen

`brave-newtab-organizer` es una extensión MV3 construida con React + Vite. Reemplaza la nueva pestaña del navegador con una dashboard enfocada en marcadores.

La implementación actual está concentrada en un único componente grande (`src/App.tsx`) que mezcla:

- acceso a APIs del navegador
- estado de la UI
- transformación de datos
- widgets auxiliares
- render de layout

Esto funciona para iterar rápido, pero conviene saberlo porque cualquier cambio relevante probablemente toque ese archivo.

## Flujo principal

1. `src/main.tsx` monta `App`
2. `App` intenta cargar:
   - wallpaper
   - nota rápida
   - ciudad del tiempo
   - marcadores fijados
3. `App` carga el árbol de marcadores:
   - si existe `chrome.bookmarks.getTree`, usa datos reales
   - si no, usa `FALLBACK_TREE`
4. A partir del árbol se derivan:
   - carpetas visibles
   - todos los marcadores
   - carpeta seleccionada
   - marcadores fijados
   - resultados de búsqueda
5. La UI reacciona a acciones CRUD, drag & drop, personalización y widgets laterales

## Estado importante

### Datos de marcadores

- `tree`: árbol completo de bookmarks
- `selectedFolderId`: carpeta activa
- `search`: filtro global
- `pinnedBookmarkIds`: lista persistida de favoritos
- `editingBookmark`, `editingFolderId`, `editingFolderTitle`: estados de edición
- `organizeMode`: activa affordances de gestión y drag & drop

### Personalización

- `wallpaper`: puede ser:
  - un id de preset (`midnight-default`, `violet-glow`, etc.)
  - un data URL generado al subir una imagen
- `note`: quick note persistida

### Widgets

- `weatherCity`, `weatherDraft`, `weather`, `weatherLoading`, `weatherError`
- `now`: fecha/hora viva para el reloj
- `toast`: feedback temporal en esquina inferior derecha

## Persistencia

Se usa `chrome.storage.local` con estas claves:

- `newtab.wallpaper`
- `newtab.note`
- `newtab.weatherCity`
- `newtab.pinnedBookmarks`

Para mejorar la recuperación del fondo, además de `chrome.storage.local` se usa `localStorage`
como respaldo al leer/guardar `newtab.wallpaper`, de forma que el wallpaper vuelva a cargar
si la API de Chrome Storage falla de forma puntual al iniciar una ventana.

No hay backend.

## APIs externas y del navegador

### Chrome/Brave extension APIs

- `chrome.bookmarks.getTree`
- `chrome.bookmarks.create`
- `chrome.bookmarks.update`
- `chrome.bookmarks.move`
- `chrome.bookmarks.remove`
- `chrome.bookmarks.removeTree`
- `chrome.storage.local.get`
- `chrome.storage.local.set`

### APIs públicas

- Open-Meteo Geocoding
- Open-Meteo Forecast
- Google S2 favicon service para iconos de sitios

## Widgets actuales

### 1. Bookmarks dashboard

Es el núcleo del producto.

- fila horizontal de carpetas
- grid principal de marcadores
- búsqueda global
- pinned section
- modal de creación/edición
- organize mode con dnd-kit

### 2. Wallpapers

Los wallpapers predefinidos no son imágenes físicas del repo. Son gradientes CSS definidos en `WALLPAPER_PRESETS`.

Ventajas:

- cero assets adicionales
- build más ligero
- cero dependencias externas

Además se mantiene la opción de subir una imagen propia, que se serializa a data URL y se guarda en storage.

También hay un control de blur persistido con slider, aplicado solo al fondo para no difuminar el contenido de la interfaz.

### 3. Calendar widget

Es un calendario mensual visual generado en cliente a partir de `now`.

- semana empieza en lunes
- resalta el día actual
- no tiene navegación de meses todavía
- no integra eventos ni calendario externo

### 4. Toast feedback

Sistema simple con estado local:

- `pushToast(message, tone)` crea un toast
- un `useEffect` lo autooculta en ~2.8s
- tonos disponibles: `success`, `error`, `info`

Se usa para feedback de:

- crear/editar/borrar marcador
- crear/renombrar/borrar carpeta
- fijar/desfijar marcador
- cambiar wallpaper
- mover/reordenar items
- errores de validación de URL

## Dónde tocar cada cosa

### Si quieres cambiar la lógica de bookmarks

Archivo principal:
- `src/App.tsx`

Buscar funciones:
- `loadBookmarks`
- `handleCreateBookmark`
- `handleDeleteBookmark`
- `handleSaveBookmark`
- `reorderVisibleBookmarks`
- `moveBookmarkToFolder`
- `reorderFolders`

### Si quieres tocar wallpapers

Buscar:
- `WALLPAPER_PRESETS`
- `getWallpaperStyle`
- `handleWallpaperPreset`
- `handleWallpaperChange`

### Si quieres tocar el calendario

Buscar:
- `buildCalendarDays`
- bloque JSX `calendar-widget`
- estilos `.calendar-*` en `src/App.css`

### Si quieres tocar toasts

Buscar:
- tipo `ToastState`
- `pushToast`
- bloque JSX `.toast`
- estilos `.toast*` en `src/App.css`

## Deuda técnica evidente

1. `App.tsx` está demasiado cargado
2. No hay separación entre hooks, utilidades y componentes
3. No hay tests
4. No hay tipado explícito para almacenamiento persistido más allá de helpers simples
5. El calendario no tiene navegación ni eventos
6. El reordenado del grid actúa sobre `quickLinks` (máximo 12 visibles), no sobre una lista expandida/paginada

## Refactor recomendado cuando toque escalar

Orden sensato:

1. Extraer `src/lib/` con utilidades puras
2. Extraer `src/hooks/`:
   - `useBookmarks`
   - `usePersistentState`
   - `useWeather`
   - `useToast`
3. Extraer `src/components/`:
   - `BookmarksGrid`
   - `FolderRow`
   - `WeatherWidget`
   - `CalendarWidget`
   - `WallpaperWidget`
   - `Toast`
4. Añadir tests a utilidades puras (`normalizeUrl`, filtros)

## Estado conocido tras esta sesión

Implementado y compilando:

- wallpapers predefinidos
- calendario mensual
- toast feedback
- documentación interna del repo
