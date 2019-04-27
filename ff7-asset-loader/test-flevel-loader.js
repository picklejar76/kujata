const fs = require("fs");
const LzsDecompressor = require("../lzs/lzs-decompressor.js");
const FLevelLoader = require("./flevel-loader.js");

let config = JSON.parse(fs.readFileSync('../config.json', 'utf-8'));

// Pre-requisite: Must run test-map-list-loader.json first to generate maplist.json
// TODO: Make flevel-loader smarter so that it can do this automatically.

let mapList = JSON.parse(fs.readFileSync(config.outputFieldFLevelDirectory + '/maplist.json', 'utf-8'));
let lzsDecompressor = new LzsDecompressor();
let flevelLoader = new FLevelLoader(lzsDecompressor, mapList);

var replacer = function(k, v) {
  ////if (k == "entitySections") { return undefined; }
  return v;
};

// translate just 1 map
/*
let fieldName = "md8_2"; // md1stin, md1_1, md1_2, nrthmk, junon
let flevel = flevelLoader.loadFLevel(config, fieldName);
let outputFilename = config.outputFieldFLevelDirectory + '/' + fieldName + '.json';
fs.writeFileSync(outputFilename, JSON.stringify(flevel, replacer, 2));
console.log("Wrote: " + outputFilename);
*/

// translate all maps and create index
let opCodeUsages = {};
for (let fieldName of mapList) {
  if (fieldName && !fieldName.startsWith("wm")) {
    try {
      let flevel = flevelLoader.loadFLevel(config, fieldName);
      let outputFilename = config.outputFieldFLevelDirectory + '/' + fieldName + '.json';
      fs.writeFileSync(outputFilename, JSON.stringify(flevel, replacer, 2));
      console.log("Wrote: " + fieldName + '.json');
      for (let entity of flevel.script.entities) {
        for (let script of entity.scripts) {
          for (let i=0; i<script.ops.length; i++) {
            let op = script.ops[i];
            if (op && op.raw) {
              let opHex = op.raw.substring(0, 2);
              let usage = {
                fieldName: fieldName,
                entityName: entity.entityName,
                scriptIndex: script.index,
                opIndex: i
              };
              for (let opProperty of Object.keys(op)) {
                usage[opProperty] = op[opProperty];
              }
              if (!opCodeUsages[opHex]) {
                opCodeUsages[opHex] = [];
              }
              opCodeUsages[opHex].push(usage);
            }
          }
        }
      }
    } catch(e) {
      let errorMessage = "" + e;
      if (errorMessage.includes("no such file or directory")) {
        console.log("Warning: " + errorMessage);
      } else {
        console.error("Error while loading: " + fieldName, e);
        process.exit();
      }
    }
  }
}
for (let opHex of Object.keys(opCodeUsages)) {
  let usages = opCodeUsages[opHex];
  let filename = config.metadataDirectory + '/op-code-usages/' + opHex + '.json';
  fs.writeFileSync(filename, JSON.stringify(usages, null, 2));
  console.log("Wrote: " + filename);
}
