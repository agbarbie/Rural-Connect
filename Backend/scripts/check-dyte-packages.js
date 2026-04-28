// check-dyte-packages.js
// Run: node check-dyte-packages.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking for Dyte npm packages...\n');

// Check package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');

if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  console.log('📦 Checking dependencies...');
  
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  const dytePackages = Object.keys(allDeps).filter(pkg => 
    pkg.includes('dyte') || pkg.includes('@dytesdk')
  );
  
  if (dytePackages.length > 0) {
    console.log('❌ FOUND DYTE NPM PACKAGES (These should be removed!):');
    dytePackages.forEach(pkg => {
      console.log(`   - ${pkg}: ${allDeps[pkg]}`);
    });
    console.log('\n🔧 To remove them, run:');
    console.log(`npm uninstall ${dytePackages.join(' ')}`);
    console.log('\n⚠️  You should use ONLY the CDN version in index.html');
  } else {
    console.log('✅ No Dyte npm packages found - Good!\n');
    console.log('This means you should be using CDN only.');
  }
} else {
  console.log('❌ package.json not found');
  console.log('Make sure you run this from your Frontend directory');
}

console.log('\n==========================================');
console.log('NEXT STEPS:');
console.log('==========================================');
console.log('1. Remove any Dyte npm packages (if found above)');
console.log('2. Ensure index.html has Dyte SDK from CDN');
console.log('3. Delete dist/ and .angular/ folders');
console.log('4. Run: ng build --configuration production');
console.log('5. Hard refresh browser (Ctrl+Shift+R)');
console.log('==========================================\n');