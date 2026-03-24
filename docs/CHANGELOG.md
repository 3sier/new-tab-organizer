# Changelog

## 2026-03-24 (Pack 5 Settings polish)

### Añadido

- Cierre del panel de ajustes al pulsar fuera del popover.
- Cierre del panel de ajustes con `Esc` desde el atajo global existente.
- Reemplazo del icono de ajustes por un SVG inline con estado visual pulido (hover/activo).
- Ajustes de anchura y posición del popover para mejorar la presentación en anchos estrechos.

### Validado

- `npm run build` OK

## 2026-03-24 (Pack 4 Config)

### Añadido

- Exportación e importación de configuración de usuario mediante archivo JSON:
  - fondo/papel pintado (preset o personalización),
  - blur de fondo,
  - nota rápida,
  - ciudad del tiempo,
  - lista de bookmarks fijados,
  - carpeta activa,
  - visibilidad de widgets.
- Controles para mostrar/ocultar widgets laterales (wallpaper al organizar, tiempo, fijados, nota).
- Persistencia nueva para preferencias de visibilidad en `chrome.storage.local` (`widgetShow*`).

### Validado

- `npm run build` OK

## 2026-03-24 (Pack 3 Technical Cleanup)

### Añadido

- Extracción a `src/lib` de utilidades puras:
  - búsqueda (`search.ts`)
  - persistencia (`storage.ts`)
  - imagen y redimensionado (`image.ts`)
  - wallpaper (`wallpaper.ts`)
- Extracción de componentes leves de UI:
  - `SearchBar`
  - `Toast`
  - `WallpaperPanel`
- Documentación actualizada para reflejar la nueva estructura (`README.md`, `docs/ARCHITECTURE.md`)

### Validado

- `npm run build` OK

## 2026-03-24 (Pack 2 UX)

### Añadido

- Búsqueda más tolerante y con ranking:
  - normalización diacrítica y por tokens,
  - coincidencias aproximadas con distancia de edición limitada,
  - orden de resultados por relevancia en título, host y URL.
- Atajos de teclado nuevos:
  - `Ctrl/Cmd + K` centra en la búsqueda,
  - `N` crea marcador y `Shift + N` crea carpeta (en contexto no editable),
  - flechas `↑`/`↓` para navegar resultados cuando hay búsqueda activa,
  - `Enter` abre el resultado resaltado en búsqueda.
- Modo organizar mejorado visualmente:
  - estado explícito de modo activo,
  - resalte de tarjetas/filtros para acciones de reordenar/editar más visibles.

### Validado

- `npm run build` OK

## 2026-03-24

### Añadido

- Persistencia de la carpeta activa entre aperturas de pestaña/ventana
- Acción para eliminar wallpaper personalizado y restaurar preset por defecto
- Atajos de teclado: `/` para enfocar búsqueda, `Esc` para salir de edición/modal/organize mode
- Compresión y redimensionado básico de imágenes de wallpaper antes de guardar

### Validado

- `npm run build` OK

## 2026-03-18

### Añadido

- Wallpapers predefinidos basados en gradientes CSS
- Posibilidad de seguir usando wallpaper personalizado subiendo imagen
- Slider de blur persistido para difuminar el wallpaper personalizado o predefinido
- Sistema de toast feedback para acciones importantes
- Documentación de arquitectura y notas de sesión

### Cambiado

- `README.md` ampliado para que explique mejor el repo, la estructura y la persistencia
- La personalización del fondo ahora soporta presets además del upload manual
- Varias acciones de bookmarks y carpetas ahora muestran feedback visual inmediato

### Validado

- `npm run build` OK

### Notas

- El widget de calendario se descartó tras probarlo porque no convencía visualmente
- Los wallpapers predefinidos no requieren assets en `public/` porque se renderizan con CSS
