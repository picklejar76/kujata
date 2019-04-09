const fs = require("fs");
const LzsDecompressor = require("../lzs/lzs-decompressor.js");

let config = { "inputFLevelDirectory": "/opt/ff7/unpacked/field/flevel.lgp" };

let lzsDecompressor = new LzsDecompressor();

let compressedBuffer = fs.readFileSync(config.inputFLevelDirectory + '/md1stin');
let decompressedBuffer = lzsDecompressor.decompress(compressedBuffer);

console.log("compressedBuffer.length=" + compressedBuffer.length);
console.log("decompressedBuffer.length=" + decompressedBuffer.length);
