import fs from 'fs';
const ecosystemPath = '/Users/ioi/Documents/TcgMaster/tcgmaster/ecosystem.config.js';
const config = require(ecosystemPath);
console.log('Current Apps:', config.apps.map((a: any) => a.name));
