const fs = require("fs");
const stringUtil = require("../ff7-asset-loader/string-util.js");
const { FF7BinaryDataReader } = require("../ff7-asset-loader/ff7-binary-data-reader.js");

// input buffer = LZS compressed data
// output buffer = LZS uncompressed data

module.exports = class LzsDecompressor {

  constructor() {
  }

  decompress(buffer) {

    var toHex2 = stringUtil.toHex2;
    var toBits8 = stringUtil.toBits8;
    var r = new FF7BinaryDataReader(buffer);

    let fileSize = buffer.length;

    let declaredLength = r.readUInt(); // data.readUInt32LE(0); // length of file, minus the 4-byte "length"
    buffer = buffer.slice(4);
    if (buffer.length != declaredLength) {
      throw new Error("declaredLength=" + declaredLength + " but actualLength=" + buffer.length);
    }

    let output = [];
    let observe=false;
    let done=false;
    while (!done) {
      let controlByte = r.readUByte();
      if (observe) { console.log("controlByte = 0x" + toHex2(controlByte) + " = 0b" + toBits8(controlByte)); }
      if (r.offset >= r.buffer.length) {
        done = true;
        break;
      } else {
        for (let bit=0; bit<8 && !done; bit++) {
          let isLiteral = (controlByte) & (1 << bit) ? 1 : 0;
          if (isLiteral) {
            let literal = r.readUByte();     if (observe) { console.log("read literal: 0x" + toHex2(literal)); }
            output.push(literal);
            if (observe) { console.log("\t\t\t\t\t\t\t\t\t\toutput[" + output.length + "] = 0x" + toHex2(literal)); }
          } else {
            let byte1 = r.readUByte();
            let byte2 = r.readUByte();
            if (observe) { console.log("reading reference: 0x" + toHex2(byte1) + " 0x" + toHex2(byte2)); }
            let rawOffset = ((byte2 >> 4) << 8) | byte1;
            let rawLength = (byte2 & 0x0f);
            let actualLength = rawLength + 3;
            let tail = output.length;
            let actualOffset = tail - ((tail - 18 - rawOffset + 4096) % 4096);
            if (observe) { console.log("  rawLength=" + rawLength + ", actualLength=" + actualLength + ", rawOffset=" + rawOffset + ", actualOffset=" + actualOffset); }
            for (let i=0; i<actualLength; i++) {
              let pos = actualOffset + i;
              if (pos < 0) {
                output.push(0);                 if (observe) { console.log("\t\t\t\t\t\t\t\t\t\toutput[" + output.length + "] = 0x00 (pre-beginning)"); }
              } else if (pos > tail) {
                let repeatLength = (tail - actualOffset);
                pos = actualOffset + (i % repeatLength);
                let value = output[pos];
                output.push(value);             if (observe) { console.log("\t\t\t\t\t\t\t\t\t\toutput[" + output.length + "] = 0x" + toHex2(value) + " (repeated)"); }
              } else {
                let value = output[pos];
                output.push(value);             if (observe) { console.log("\t\t\t\t\t\t\t\t\t\toutput[" + output.length + "] = 0x" + toHex2(value)); }
              }
            }
          }
          if (r.offset >= r.buffer.length) {
            done = true;
            break;
          }
        } // end bit loop
      }
    }

    let actualOutputBuffer = Buffer.from(output);
    /*
    let actualOutputReader = new FF7BinaryDataReader(actualOutputBuffer);
    let expectedOutputBuffer = fs.readFileSync(config.inputFLevelDirectory + '/md1_1.DEC');
    var expectedOutputReader = new FF7BinaryDataReader(expectedOutputBuffer);
    //console.log("ACTUAL OUTPUT:");   actualOutputReader.printNextBufferDataAsHex();
    //console.log("EXPECTED OUTPUT:"); expectedOutputReader.printNextBufferDataAsHex();
    let numMatches = 0, numMismatches = 0;
    for (let i=0; i<output.length; i++) {
      let actualByte = output[i];
      let expectedByte = expectedOutputBuffer.readUInt8(i);
      if (actualByte == expectedByte) {
        numMatches++;
      } else {
        numMismatches++;
        console.log("mismatch at i=" + i + ", expectedByte=" + toHex2(expectedByte) + ", actualByte=" + toHex2(actualByte));
      }
    }
    console.log("numMatches=" + numMatches + ", numMismatches=" + numMismatches);
    */

    return actualOutputBuffer;

  }

};

/*
let config = { "inputFLevelDirectory": "/opt/ff7/unpacked/field/flevel.lgp" };
let buffer = fs.readFileSync(config.inputFLevelDirectory + '/md1stin');

let decompressed = decompress(buffer);
console.log("decompressed.length=" + decompressed.length);
*/
