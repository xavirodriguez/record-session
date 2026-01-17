
import esbuild from 'esbuild';
import fs from 'fs/promises';
import path from 'path';

const outdir = 'dist';

async function build() {
  try {
    // 1. Limpiar directorio de salida
    await fs.rm(outdir, { recursive: true, force: true });
    await fs.mkdir(outdir, { recursive: true });

    // 2. Definir puntos de entrada y archivos estáticos
    const entryPoints = [
      'index.tsx',
      'background/service-worker.js',
      'scripts/content-script.js',
      'options.js',
    ];

    const staticFiles = [
      'manifest.json',
      'index.html',
      'options.html',
      'index.css',
    ];

    // 3. Configurar y ejecutar esbuild
    const isWatchMode = process.argv.includes('--watch');

    const buildOptions = {
      entryPoints,
      bundle: true,
      outdir: outdir,
      format: 'esm',
      loader: { '.tsx': 'tsx' },
      minify: !isWatchMode,
      logLevel: 'info',
    };

    if (isWatchMode) {
      buildOptions.watch = {
        onRebuild(error, result) {
          if (error) console.error('Watch build failed:', error);
          else console.log('Watch build succeeded:', result);
        },
      };
    }

    const result = await esbuild.build(buildOptions);

    // 4. Copiar archivos estáticos
    for (const file of staticFiles) {
      const destPath = path.join(outdir, path.basename(file));
      await fs.copyFile(file, destPath);
    }

    console.log('Build finalizado correctamente.');

  } catch (error) {
    console.error('Error durante el build:', error);
    process.exit(1);
  }
}

build();
