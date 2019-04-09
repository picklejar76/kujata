const fs = require("fs");
const stringUtil = require("./string-util.js");
const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js");

module.exports = class MapListLoader {

  loadMapList(config) {

    var mapList = [];
    var buffer = fs.readFileSync(config.inputFLevelDirectory + '/maplist');
    let fileSizeBytes = buffer.length;

    var r = new FF7BinaryDataReader(buffer);

    let numMaps = r.readUShort();

    for (let i=0; i<numMaps; i++) {
      let mapName = r.readString(32);
      mapList.push(mapName);
    }

    return mapList;

  }

};
