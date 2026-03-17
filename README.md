# Brave New Tab Organizer

Extensión para Chrome/Brave que reemplaza la nueva pestaña por una vista organizada de carpetas y marcadores.

## MVP incluido

- Override de `new tab`
- Lectura real de marcadores con `chrome.bookmarks`
- Lista lateral de carpetas
- Búsqueda por título o URL
- Área de marcadores fijados/favoritos con acción de fijar y desfijar
- Crear carpetas
- Crear marcadores
- Borrar marcadores
- Modo organizar con reorder en la cuadrícula y bandeja separada para mover marcadores entre carpetas
- Widget de tiempo con previsión de 3 días y cambio de ciudad persistente
- Fallback de datos mock para desarrollo fuera de la extensión

## Stack

- React
- Vite
- TypeScript
- Manifest V3

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

## Comportamiento nuevo

- Los marcadores fijados aparecen en una zona superior dedicada y se guardan en `chrome.storage.local`.
- El widget de tiempo permite cambiar de ciudad con una edición inline más amable y recuerda la ciudad elegida.
