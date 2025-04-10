# Syntropi API Documentation

This directory contains the OpenAPI specification and API documentation setup for the Syntropi API.

## Overview

The API documentation is built using [Redocly](https://redocly.com/), a powerful tool for creating beautiful API references from OpenAPI specifications.

## Files

- `openapi.yaml` - The main OpenAPI specification file
- `redocly.yaml` - Redocly configuration file
- `templates/` - Custom HTML templates for documentation
- `build/` - Output directory for built documentation
- `dist/` - Output directory for bundled spec files

## Working with the API Documentation

### Prerequisites

Make sure you have Node.js installed and the Redocly CLI:

```bash
npm install -g @redocly/cli
```

### Commands

All these commands can be run from the root API directory:

1. **Preview API documentation**:
   ```bash
   npm run docs:serve
   ```
   This will start a local server at http://localhost:8080 with live reloading.

2. **Build static HTML documentation**:
   ```bash
   npm run docs:build
   ```
   This will generate a static HTML file in the `docs/build` directory.

3. **Lint OpenAPI spec**:
   ```bash
   npm run docs:lint
   ```
   This checks for errors and best practices in your OpenAPI specification.

4. **Bundle OpenAPI spec**:
   ```bash
   npm run docs:bundle
   ```
   This creates a single file from your multi-file spec in the `docs/dist` directory.

## Deployment

To deploy the API documentation, you can:

1. Build the static documentation using `npm run docs:build`
2. Upload the built files to a static web host
3. Or integrate with CI/CD to automatically deploy when changes are pushed

## Updating the API Documentation

1. Make changes to `openapi.yaml`
2. Preview changes with `npm run docs:serve`
3. Lint with `npm run docs:lint` to catch issues
4. Build and deploy

## Customization

- Modify the theme in `redocly.yaml`
- Edit HTML templates in `templates/`
- Add custom CSS and JavaScript in the template

## Best Practices

1. Keep paths and operations organized by function
2. Use consistent naming for schemas and operations
3. Include detailed descriptions for all components
4. Provide example requests and responses
5. Keep security schemes up to date 