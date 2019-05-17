const fs = require("fs");

var hrcLoader = require("./hrc-loader.js");
var rsdLoader = require("./rsd-loader.js");
var pLoader = require("./p-loader.js");
var aLoader = require("./a-loader.js");

let config = JSON.parse(fs.readFileSync('../config.json', 'utf-8'));

// let skeleton = hrcLoader.loadHrc(config, "AAAA"); // AAAA.HRC = Cloud
// console.log('skeleton=' + JSON.stringify(skeleton, null, 2));

// let resource = rsdLoader.loadRsd(config, "AAAF"); // AAAF.RSD = Cloud's head
// console.log('resource=' + JSON.stringify(resource, null, 2));

// let model = pLoader.loadP(config, "AABA"); // AABA.P = Cloud's head
// console.log(JSON.stringify(model, null, 2));

let animation = aLoader.loadA(config, "AAGA"); // AAFE.A = Cloud standing, AAGA.A = Cloud running
console.log(JSON.stringify(animation, null, 2));
