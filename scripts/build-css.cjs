const tailwindcss = require('@tailwindcss/postcss');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const fs = require('fs');

async function buildCss() {
  const css = fs.readFileSync('index.css', 'utf8');
  const result = await postcss([
    tailwindcss,
    autoprefixer,
  ]).process(css, { from: 'index.css', to: 'dist/index.css' });

  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
  }
  fs.writeFileSync('dist/index.css', result.css);
}

buildCss().catch(err => {
  console.error(err);
  process.exit(1);
});
