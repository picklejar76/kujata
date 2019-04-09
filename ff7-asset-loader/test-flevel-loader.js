const fs = require("fs");
const LzsDecompressor = require("../lzs/lzs-decompressor.js");
const FLevelLoader = require("./flevel-loader.js");

let config = {
  "inputFLevelDirectory": "/opt/ff7/unpacked/field/flevel.lgp",
  "outputFLevelDirectory": "../../kujata-data/data/field/flevel.lgp"
};

// Pre-requisite: Must run test-map-list-loader.json first to generate maplist.json
// TODO: Make flevel-loader smarter so that it can do this automatically.

let mapList = JSON.parse(fs.readFileSync(config.outputFLevelDirectory + '/maplist.json', 'utf-8'));
let lzsDecompressor = new LzsDecompressor();
let flevelLoader = new FLevelLoader(lzsDecompressor, mapList);

var replacer = function(k, v) {
  if (k == "entitySections") { return undefined; }
  return v;
};

// translate just 1 map
let flevelName = "md1stin"; // md1stin, md1_1, md1_2, nrthmk, junon
let flevel = flevelLoader.loadFLevel(config, flevelName);
fs.writeFileSync(config.outputFLevelDirectory + '/' + flevelName + '.json', JSON.stringify(flevel, replacer, 2));

// translate all maps
for (let fieldName of mapList) {
  if (fieldName && !fieldName.startsWith("wm")) {
    try {
      let flevel = flevelLoader.loadFLevel(config, fieldName);
      fs.writeFileSync(config.outputFLevelDirectory + '/' + fieldName + '.json', JSON.stringify(flevel, replacer, 2));
    } catch(e) {
      console.error("Error while loading: " + fieldName, "" + e);
    }
  }
}
