SIMUPLC LAB - PAQUETE PWA PARA GITHUB

Sube todos estos archivos a la raíz de tu repositorio GitHub Pages:

- index.html
- ladder_mobile_compact.html
- manifest.json
- service-worker.js
- carpeta icons/
- .nojekyll

IMPORTANTE:
1. En GitHub, activa Pages desde Settings > Pages.
2. Source: Deploy from a branch.
3. Branch: main / root.
4. Abre la URL publicada con HTTPS.
5. La instalación PWA solo funciona correctamente con HTTPS o localhost.

Si actualizas HTML/CSS/JS y no ves cambios, cambia la versión CACHE_NAME dentro de service-worker.js, por ejemplo:
simuplc-lab-pwa-v2
