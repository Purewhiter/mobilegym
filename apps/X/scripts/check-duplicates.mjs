import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '../data/importedData.json');

function checkDuplicates() {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const posts = data.importedPosts;
    
    const ids = new Set();
    const duplicates = [];
    
    posts.forEach(p => {
        if (ids.has(p.id)) {
            duplicates.push(p.id);
        }
        ids.add(p.id);
    });
    
    console.log(`Checked ${posts.length} posts.`);
    console.log(`Found ${duplicates.length} duplicate IDs.`);
    if (duplicates.length > 0) {
        console.log('Duplicates (first 10):', duplicates.slice(0, 10));
    }
}

checkDuplicates();
