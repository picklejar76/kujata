const fs = require("fs");
const FF7JsonTranslator = require("./ff7-json/ff7-to-json.js");

var config = JSON.parse(require("fs").readFileSync("config.json"));
let jsonTranslator = new FF7JsonTranslator(config);

let filenames = fs.readdirSync(config.inputFieldCharDirectory)
console.log(filenames);

//let hrcFileIds = ["AAAA"];
let hrcFileIds = filenames
  .filter(filename => filename.endsWith(".hrc"))
  .map(filename => filename.substring(0, filename.length - 4));
jsonTranslator.translateHrcs(hrcFileIds);

//let rsdFileIds = ['AAAB', 'AAAD'];
let rsdFileIds = filenames
  .filter(filename => filename.endsWith(".rsd"))
  .map(filename => filename.substring(0, filename.length - 4));
jsonTranslator.translateRsds(rsdFileIds);

//let pFileIds = ['AAAC', 'AAAE'];
let pFileIds = filenames
  .filter(filename => filename.endsWith(".p"))
  .map(filename => filename.substring(0, filename.length - 2));
jsonTranslator.translatePs(pFileIds);

//let animFileIds = ["AAFE"];
let animFileIds = filenames
  .filter(filename => filename.endsWith(".a"))
  .map(filename => filename.substring(0, filename.length - 2));
jsonTranslator.translateAnims(animFileIds);
