# Guía de Contribución

¡Gracias por querer mejorar **Violin Mentor**! Sigue estas guías para asegurar que el proyecto se mantenga robusto y escalable.

## 🎨 Style Guide
- **TypeScript**: Estricto. Evita `any` a toda costa. Usa tipos específicos o genéricos.
- **Componentes**: Prefiere componentes funcionales con hooks.
- **Estilos**: Usamos Tailwind CSS. Sigue las convenciones de diseño del proyecto (ver `styles/`).
- **Nomenclatura**:
  - Archivos: `kebab-case`.
  - Componentes: `PascalCase`.
  - Funciones/Variables: `camelCase`.

## 📐 Estándares de Arquitectura
- Respeta los límites de la **Arquitectura Hexagonal**. No importes lógica de adaptadores en el dominio.
- Define interfaces (Ports) antes de implementar nuevas integraciones externas.

## 📝 Documentación TSDoc
Todas las funciones públicas en el dominio y puertos deben estar documentadas con TSDoc:
```typescript
/**
 * Calcula la desviación en cents respecto a una frecuencia objetivo.
 * @param freq - Frecuencia detectada en Hz.
 * @param target - Frecuencia objetivo de la nota.
 * @returns Desviación en cents.
 */
export function calculateCents(freq: number, target: number): number { ... }
```

## ✅ Checklist de PR
Antes de abrir un Pull Request, asegúrate de:
1. [ ] Ejecutar `npm run lint`.
2. [ ] Ejecutar todos los tests (`npm test`).
3. [ ] Haber documentado las nuevas APIs o cambios arquitectónicos.
4. [ ] Verificar que no hay regresiones en el renderizado de OSMD.

## 🚀 Checklist de Release
Para realizar una nueva versión:
1. [ ] Incrementar la versión en `package.json`.
2. [ ] Actualizar el `MIGRATION_GUIDE.md` si hay cambios en el estado.
3. [ ] Ejecutar los tests E2E en todos los navegadores soportados.
4. [ ] Generar el reporte de build y verificar el tamaño del bundle.
