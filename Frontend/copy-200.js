const fs = require('fs');
const path = require('path');

// Angular 19 outputs to browser subfolder
const possiblePaths = [
  path.join(__dirname, 'dist', 'ruralconnect', 'browser', 'index.html'),
  path.join(__dirname, 'dist', 'ruralconnect', 'index.html')
];

let indexPath = null;

// Find which path exists
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    indexPath = p;
    break;
  }
}

if (!indexPath) {
  console.error('❌ Could not find index.html in expected locations');
  console.error('Checked:', possiblePaths);
  process.exit(1);
}

const outputDir = path.dirname(indexPath);

// Create 200.html
const fallbackPath = path.join(outputDir, '200.html');
fs.copyFileSync(indexPath, fallbackPath);
console.log('✅ Created 200.html at:', fallbackPath);

// Copy _redirects file
const redirectsSource = path.join(__dirname, 'public', '_redirects');
const redirectsDest = path.join(outputDir, '_redirects');

if (fs.existsSync(redirectsSource)) {
  fs.copyFileSync(redirectsSource, redirectsDest);
  console.log('✅ Copied _redirects to:', redirectsDest);
} else {
  console.warn('⚠️  _redirects file not found in public folder');
}