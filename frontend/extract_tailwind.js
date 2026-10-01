const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/tailwind\.config\s*=\s*(\{.*?\});?<\/script>/s);
if (match) {
  let configStr = match[1];
  let tailwindConfig = `/** @type {import('tailwindcss').Config} */\nmodule.exports = ${configStr};\nmodule.exports.content = ['./**/*.{html,js}'];\n`;
  fs.writeFileSync('tailwind.config.js', tailwindConfig);
  console.log('tailwind.config.js created');
  
  html = html.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*/, '');
  html = html.replace(/<script id="tailwind-config">.*?<\/script>\s*/s, '');
  html = html.replace(/<\/head>/, '  <link rel="stylesheet" href="tailwind.css">\n</head>');
  fs.writeFileSync('index.html', html);
  console.log('index.html updated');
} else {
  console.log('tailwind config not found in index.html');
}
