const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'dist', 'ruralconnect', 'index.html');
const fallbackPath = path.join(__dirname, 'dist', 'ruralconnect', '200.html');

fs.copyFileSync(indexPath, fallbackPath);
console.log('✅ Created 200.html');