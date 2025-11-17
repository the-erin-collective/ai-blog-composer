import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SRC_DIR = path.join(__dirname, 'src');

function updateImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(path.dirname(filePath), SRC_DIR).replace(/\\/g, '/');
    
    // Replace @/ imports with relative paths
    const updatedContent = content.replace(
      /from ["']@\/([^"']+)["']/g, 
      (match, importPath) => {
        const relativeImportPath = path.relative(
          path.dirname(filePath),
          path.join(SRC_DIR, importPath)
        ).replace(/\\/g, '/');
        
        // Handle going up directories
        const finalPath = relativeImportPath.startsWith('..') 
          ? relativeImportPath 
          : './' + relativeImportPath;
          
        return `from '${finalPath}'`;
      }
    );
    
    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`Updated imports in ${path.relative(process.cwd(), filePath)}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

function processDirectory(directory) {
  const files = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(directory, file.name);
    
    if (file.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.name.endsWith('.tsx') || file.name.endsWith('.ts')) {
      updateImports(fullPath);
    }
  }
}

// Start processing from the src directory
processDirectory(SRC_DIR);
console.log('Finished updating imports!');
