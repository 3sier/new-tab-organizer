# Architecture

## Resumen

`brave-newtab-organizer` es una extensión MV3 construida con React + Vite. Reemplaza la nueva pestaña del navegador con una dashboard enfocada en marcadores.

La implementación se reparte entre un componente principal y módulos de soporte:

- `src/App.tsx` (orquestación de estado y layout)
- `src/lib` (utilidades puras y side-effect helpers)
- `src/components` (UI extraída de componentes simples)

Antes de este pack de limpieza, la lógica estaba en:

- acceso a APIs del navegador
- estado de la UI
- transformación de datos
- widgets auxiliares
- render de layout

Esto funcionó para iterar rápido, pero cualquier cambio relevante tocaba demasiado `App.tsx`.

## Flujo principal

1. `src/main.tsx` monta `App`
2. `App` intenta cargar:
   - wallpaper
   - nota rápida
   - ciudad del tiempo
   - marcadores fijados
   - carpeta activa seleccionada
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
- `widgetVisibility` (`wallpaperPanel`, `weatherWidget`, `pinnedWidget`, `noteWidget`)
- `now`: fecha/hora viva para el reloj
- `toast`: feedback temporal en esquina inferior derecha

## Persistencia

Se usa `chrome.storage.local` con estas claves:

- `newtab.wallpaper`
- `newtab.note`
- `newtab.weatherCity`
- `newtab.pinnedBookmarks`
- `newtab.selectedFolder`
- `newtab.widgetShowWallpaperPanel`
- `newtab.widgetShowWeatherWidget`
- `newtab.widgetShowPinnedWidget`
- `newtab.widgetShowNoteWidget`

Para mejorar la recuperación del fondo, además de `chrome.storage.local` se usa `localStorage`
como respaldo al leer/guardar `newtab.wallpaper`, de forma que el wallpaper vuelva a cargar
si la API de Chrome Storage falla de forma puntual al iniciar una ventana.
`newtab.selectedFolder` también se guarda en `localStorage` como fallback y restaurará la vista activa entre pestañas y ventanas.

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
- ranking tolerante/fuzzy para resultados
- navegación por teclado en búsqueda
- pinned section
- modal de creación/edición
- organize mode con dnd-kit

### 2. Wallpapers

Los wallpapers predefinidos no son imágenes físicas del repo. Son gradientes CSS definidos en `WALLPAPER_PRESETS`.

Ventajas:

- cero assets adicionales
- build más ligero
- cero dependencias externas

Además se mantiene la opción de subir una imagen propia, que se redimensiona y comprime antes de guardarse, se serializa a data URL y se guarda en storage.
También existe una acción explícita para quitar wallpaper personalizado y volver al preset inicial.

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

Archivos recomendados:
- `src/components/WallpaperPanel.tsx`
- `src/lib/wallpaper.ts`
- `src/lib/image.ts`

### Si quieres tocar búsqueda

Archivos recomendados:
- `src/lib/search.ts`

### Si quieres tocar toasts

- `src/components/Toast.tsx`
- `src/lib/search.ts` (si hay cambios en texto y ordenado)

### Estado de deuda técnica

- No hay tests
- No hay hooks de dominio dedicados
- El calendario mensual no está activo en la UI y está pendiente de reintegración si se requiere

## Deuda técnica evidente

1. `App.tsx` todavía concentra más comportamiento que de costumbre para una pantalla extensa
2. La separación en hooks aún no está implementada
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
