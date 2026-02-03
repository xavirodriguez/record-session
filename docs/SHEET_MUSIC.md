# Renderizado de Partituras: OSMD e Integración

Violin Mentor utiliza **OpenSheetMusicDisplay (OSMD)** para renderizar partituras dinámicas a partir de archivos MusicXML.

## 🎨 Integración con OSMD
El renderizado se gestiona mediante el componente `SheetMusic` y el hook `useOSMDSafe`.

### Ciclo de Vida
1. **Load**: Se carga el archivo MusicXML (o string) en la instancia de OSMD.
2. **Render**: Se ajusta el zoom y se dibuja en un contenedor `div`.
3. **Sync**: El cursor se sincroniza con los eventos del `PracticeEngine`.

## 🎼 Generación de MusicXML (`generateMusicXML`)
Para ejercicios dinámicos (ej. escalas, arpegios generados proceduralmente), el proyecto cuenta con un sistema de generación:
```typescript
import { generateMusicXML } from 'lib/domain/musicxml';

const exercise = generateMusicXML({
  scale: 'G Major',
  pattern: 'thirds',
  range: ['G3', 'D5']
});
```
- **Best Practices**: Siempre valida el XML generado contra el esquema XSD de MusicXML antes de pasarlo a OSMD.

## 📍 Sistema de Annotations Overlay
Encima del canvas de OSMD, renderizamos una capa de anotaciones (SVG o Canvas) para mostrar feedback inmediato:
- **Architecture**: Usamos las coordenadas de las notas proporcionadas por `osmd.GraphicSheet` para posicionar los elementos de UI.
- **Sincronización**: Al cambiar el cursor de índice, las anotaciones se limpian y se reposicionan.

## 💅 Estilos y CSS
Clases CSS clave para la personalización:
- `.osmd-cursor`: Estilo del cursor de reproducción.
- `.note-highlight-success`: Clase aplicada a notas tocadas correctamente.
- `.note-highlight-error`: Clase para notas con afinación incorrecta.
- **Dark Mode**: Ajustamos los colores de los stems y cabezas de nota vía configuración de OSMD (`osmd.setOptions({ drawingParameters: ... })`).

## ⚠️ Pitfalls y Soluciones
- **Performance**: Renderizar partituras muy largas (ej. conciertos completos) puede bloquear el main thread. Solución: Fragmentar la partitura o usar lazy rendering.
- **Re-renders**: Evita recrear la instancia de OSMD en cada render de React. Usa `useMemo` o `useRef`.
