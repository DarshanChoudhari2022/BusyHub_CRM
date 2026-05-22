const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const srcPath = path.join(__dirname, 'src');

walkDir(srcPath, (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.css') || filePath.endsWith('.js') || filePath.endsWith('.cjs')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Replace all red-XXX with blue-XXX (Tailwind classes)
    content = content.replace(/\bred-(\d{2,3}(?:\/\d+)?)\b/g, 'blue-$1');
    
    // Replace hex colors if any known red ones
    // #ef4444 is red-500, #dc2626 is red-600
    // Let's just do the tailwind classes first.
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
});
console.log('Done!');
