import fs from 'fs';
import path from 'path';

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    if (file === 'decode.js' || file === 'node_modules' || file.startsWith('.')) continue;
    
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (stat.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.startsWith('{"data":"')) {
          const json = JSON.parse(content);
          if (json.data) {
            const decoded = Buffer.from(json.data, 'base64');
            fs.writeFileSync(fullPath, decoded);
            console.log(`Decoded: ${fullPath}`);
          }
        }
      } catch (e) {
        // Not a JSON file or JSON parse error, ignore
      }
    }
  }
}

processDirectory(process.cwd());
console.log('All files decoded!');