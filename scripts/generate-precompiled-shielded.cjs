const fs = require('fs');
const path = require('path');

const artifactPath = path.join(__dirname, '../artifacts/contracts/ShieldedToken.sol/ShieldedToken.json');
const outputPath = path.join(__dirname, '../src/lib/precompiledShieldedToken.ts');

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

const content = `export const precompiledShieldedToken = {
  abi: ${JSON.stringify(artifact.abi, null, 2)},
  bytecode: "${artifact.bytecode}"
};
`;

fs.writeFileSync(outputPath, content);
console.log(`Generated ${outputPath}`);
