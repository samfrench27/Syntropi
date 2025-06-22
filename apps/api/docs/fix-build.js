const fs = require('fs');
const path = require('path');

// Read the built HTML file
const htmlPath = path.join(__dirname, 'build', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Fix the spec URL to point to the bundled OpenAPI file
html = html.replace('<redoc spec-url=""></redoc>', 
                    '<redoc spec-url="openapi.yaml"></redoc>');

// Write the fixed HTML file
fs.writeFileSync(htmlPath, html);
console.log('Fixed build/index.html to include proper spec URL');

// Copy the OpenAPI file to the build directory
const apiDocsPath = path.join(__dirname, 'openapi.yaml');
const buildApiDocsPath = path.join(__dirname, 'build', 'openapi.yaml');

if (fs.existsSync(apiDocsPath)) {
  fs.copyFileSync(apiDocsPath, buildApiDocsPath);
  console.log('Copied openapi.yaml to build directory');
} else {
  console.error('Error: openapi.yaml not found in docs directory');
} 