// usage: node parse-wm-field-menu-names > wm-field-menu-names.json

const fs = require("fs");

function parseWorldMapFieldMenuNames(fileContents) {
  let lines = fileContents.split(/\r?\n/g).filter(line => !line.startsWith("#"));
  let wmFieldMenuNames = {};
  let isNullOrEmpty = function(v) { return (v == null || v == "NULL" || v.length == 0); }
  for (let line of lines) {
    let values = line.split(/\t/g);
    // fromMapId	name	menuText	fieldTableId	wmField	toMapId	name	menuText
    let fieldIdHex = values[0];         if (isNullOrEmpty(fieldIdHex)) { continue; }
    let fieldName = values[1];
    let fieldMenuName = values[2];
    let fieldId = parseInt(fieldIdHex.substring(2), 16);
    if (!isNullOrEmpty(fieldMenuName)) {
      wmFieldMenuNames[fieldId] = fieldMenuName;
    }
  }
  return wmFieldMenuNames;
}

let wmFieldMenuNamesData = parseWorldMapFieldMenuNames(fs.readFileSync('./wm-field-menu-names.txt', 'utf-8'));
console.log(JSON.stringify(wmFieldMenuNamesData, null, 2));
