const fs = require("fs");
const LzsDecompressor = require("../../lzs/lzs-decompressor.js");
const FLevelLoader = require("../../ff7-asset-loader/flevel-loader.js");

let config = JSON.parse(fs.readFileSync('../../config.json', 'utf-8'));
let mapList = JSON.parse(fs.readFileSync(config.outputFieldFLevelDirectory + '/maplist.json', 'utf-8'));
let lzsDecompressor = new LzsDecompressor();
let flevelLoader = new FLevelLoader(lzsDecompressor, mapList);

let nodes = [];
let links = [];

for (let fieldId = 0; fieldId < mapList.length; fieldId++) {
  let fieldName = mapList[fieldId];
  if (fieldName) {
    let node = {
      id: fieldId,
      fieldName: fieldName,
      mapNames: [],
    };
    if (fieldName.startsWith("wm")) {
      node.type = "wm";
    } else {
      node.type = "field";
      try {
        let flevel = flevelLoader.loadFLevel(config, fieldName);
        for (let entity of flevel.script.entities) {
          for (let script of entity.scripts) {
            for (let op of script.ops) {
              if (op.op == "MPNAM") {
                let mapName = flevel.script.dialogStrings[op.dialogId];
                if (mapName) {
                  node.mapNames.push(mapName);
                }
              }
              if (op.op == "MAPJUMP" || op.op == "PMJMP") {
                if (op.i) {
                  let link = {
                    source: fieldId,
                    target: op.i,
                    type: op.op
                  };
                  links.push(link);
                }
              }
            }
          }
        }
        for (let gateway of flevel.triggers.gateways) {
          let link = {
            source: fieldId,
            target: gateway.fieldId,
            type: "gateway"
          };
          links.push(link);
        }
        //fs.writeFileSync("./output/scene." + fieldName + '.json', JSON.stringify(flevel, replacer, 2));
      } catch(e) {
        console.error("Error while loading: " + fieldName, "" + e);
        node.type = "error";
      }
    }
    nodes.push(node); // if error occurred while processing a node, go ahead and create node without links
  }
}

let graph = {
  nodes: nodes,
  links: links
};

console.log(JSON.stringify(graph, null, 2));
