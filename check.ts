import * as fs from 'fs';

const text = fs.readFileSync('src/components/Settings.tsx', 'utf8');
const lines = text.split('\n');
let opens = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\/\/.*/, '');
    const numOpen = (line.match(/<div[\s>]/g) || []).length + (line.match(/<motion\.div[\s>]/g) || []).length;
    const numClose = (line.match(/<\/div[\s>]/g) || []).length + (line.match(/<\/motion\.div>/g) || []).length;
    opens += (numOpen - numClose);
    console.log(`${i+1} : ${opens} ( +${numOpen} -${numClose} ) : ${lines[i].trim().substring(0, 40)}`);
}
