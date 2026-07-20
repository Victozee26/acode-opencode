const { readFileSync, writeFileSync } = require('fs');

const plugin = JSON.parse(readFileSync('plugin.json', 'utf8'));
const version = plugin.version;

const readme = readFileSync('readme.md', 'utf8');
const updated = readme.replace(
  /(https:\/\/img\.shields\.io\/badge\/version-)[\d.]+(-blue\.svg)/,
  `$1${version}$2`,
);

writeFileSync('readme.md', updated);
console.log(`README version badge synced to ${version}`);

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.version = version;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`package.json version synced to ${version}`);
