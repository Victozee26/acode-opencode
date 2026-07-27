const { readFileSync, writeFileSync } = require('fs');

const plugin = JSON.parse(readFileSync('plugin.json', 'utf8'));
const name = plugin.name.toLowerCase().replace(/\s+/g, '-');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.name = name;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`package.json name synced to ${name}`);
