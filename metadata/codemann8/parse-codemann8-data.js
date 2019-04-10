// usage: node parse-codemann8-data > codemann8-data.json

const fs = require("fs");

function parseCodemannData(fileContents) {
  let lines = fileContents.split(/\r?\n/g).filter(line => !line.startsWith("#"));
  let data = {
    links: [],
    fieldMenuNames: {}
  };
  let isNullOrEmpty = function(v) { return (v == null || v == "NULL" || v.length == 0); }
  for (let line of lines) {
    let values = line.split(/\t/g);
    // fromMapId	name	menuText	fieldTableId	wmField	toMapId	name	menuText
    let sourceFieldId = values[0];         if (isNullOrEmpty(sourceFieldId)) { continue; }
    let sourceFieldName = values[1];
    let sourceFieldMenuName = values[2];
    let wmFieldId = values[3];
    let wmFieldName = values[4];
    let targetFieldId = values[5];
    let targetFieldName = values[6];
    let targetFieldMenuName = values[7];
    // add menuNames for source and target fields
    if (!isNullOrEmpty(sourceFieldMenuName)) { data.fieldMenuNames[sourceFieldId] = sourceFieldMenuName; }
    if (!isNullOrEmpty(targetFieldMenuName)) { data.fieldMenuNames[targetFieldId] = targetFieldMenuName; }
    // add links for sourceField-to-WM and WM-to-targetField
    if (!isNullOrEmpty(wmFieldId)) {
      let wmFieldIdNumber = parseInt(wmFieldId, 16);
      if (!isNullOrEmpty(sourceFieldId)) {
        let sourceFieldIdNumber = parseInt(sourceFieldId);
        data.links.push({"source": sourceFieldIdNumber, "target": wmFieldIdNumber, "type": "codemann"});
      }
      if (!isNullOrEmpty(targetFieldId)) {
        let targetFieldIdNumber = parseInt(targetFieldId);
        data.links.push({"source": wmFieldIdNumber, "target": targetFieldIdNumber, "type": "codemann"});
      }
    }
  }
  return data;
}

let codemannData = parseCodemannData(fs.readFileSync('./codemann8-data.txt', 'utf-8'));
console.log(JSON.stringify(codemannData, null, 2));
