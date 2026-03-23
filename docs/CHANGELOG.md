# Changelog

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
