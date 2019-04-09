const MapListLoader = require("./map-list-loader.js");

let config = {
  "inputFLevelDirectory": "/opt/ff7/unpacked/field/flevel.lgp",
  "outputFLevelDirectory": "../../kujata-data/data/field/flevel.lgp"
};

var mapListLoader = new MapListLoader();

let mapList = mapListLoader.loadMapList(config);

for (let i=0; i<mapList.length; i++) {
  console.log(i + "=" + mapList[i]);
}

fs.writeFileSync(config.outputFLevelDirectory + '/maplist.json', JSON.stringify(flevel, null, 2));
