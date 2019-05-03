const fs = require("fs");
const zlib = require("zlib");

const { FF7BinaryDataReader } = require("../../ff7-asset-loader/ff7-binary-data-reader.js");

let config = JSON.parse(fs.readFileSync('../../config.json', 'utf-8'));

let buffer = fs.readFileSync(config.inputKernelDirectory + '/KERNEL.BIN');

var r = new FF7BinaryDataReader(buffer);

let fileSizeBytes = buffer.length;
r.offset = 0;

let sectionNames = {
  1: "commandData",
  2: "attackData",
  3: "battleAndGrowthData",
  4: "startData",
  5: "itemData",
  6: "weaponData",
  7: "armorData",
  8: "accessoryData",
  9: "materiaData",
  10: "commandDescriptions",
  11: "magicDescriptions",
  12: "itemDescriptions",
  13: "weaponDescriptions",
  14: "armorDescriptions",
  15: "accessoryDescriptions",
  16: "materiaDescriptions",
  17: "keyItemDescription",
  18: "commandNames",
  19: "magicNames",
  20: "itemNames",
  21: "weaponNames",
  22: "armorNames",
  23: "accessoryNames",
  24: "materiaNames",
  25: "keyItemNames",
  26: "battleText",
  27: "summonAttackNames"
};

function readSection(i, sectionBuffer) {
  var $r = new FF7BinaryDataReader(sectionBuffer);
  /*
  if (i == 5) {
    let items = [];
    while ($r.offset < sectionBuffer.length) {
      let item = {
        u1: $r.readUShort(),
        u2: $r.readUShort(),
        u3: $r.readUShort(),
        u4: $r.readUShort(),
        cameraMovementId: $r.readUShort(),
        restrictionMask: $r.readUByte().toString(16),
        targetFlags: $r.readUByte().toString(16),
        attackEffectId: $r.readUByte(),
        itemId: $r.readUByte(),
        restoreApplyMask: $r.readUByte(),
        amountMultiplier: $r.readUByte(),
        restoreType: $r.readUByte(),
        statusEffects: $r.readUByte(),
        addlEffects: $r.readUByte(),
        addlEffectsModifier: $r.readUByte(),
        statusEffects: $r.readUInt(),
        attackElement: $r.readUShort(),
        specialAttackFlags: $r.readUShort()
      };
      for (let prop of ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9"]) {
        item[prop] = undefined;
      }
      items.push(item);
    }
    return items;
  }
  */
  if (i >= 10) {
    let offsets = [];
    let texts = [];
    let firstOffset = $r.readUShort();
    offsets.push(firstOffset);
    while ($r.offset < firstOffset) {
      offsets.push($r.readUShort());
    }
    for (let offset of offsets) {
      $r.offset = offset;
      let text = $r.readKernelString(255);
      texts.push(text);
    }
    return texts;
  }
  // If we reach here, we haven't implemented the parser for this section yet
  return {
    raw: sectionBuffer.toString("hex")
  };
}

let kernelData = {};

for (let i=1; i<=27; i++) {
  let sectionName = sectionNames[i];
  let sectionLength = r.readUShort();
  let gunzippedLength = r.readUShort();
  let fileNumber = r.readUShort();
  let sectionBufferGzipped = Buffer.allocUnsafe(sectionLength);
  buffer.copy(sectionBufferGzipped, 0, r.offset, r.offset + sectionLength);
  let sectionBuffer = zlib.gunzipSync(sectionBufferGzipped);
  let sectionData = readSection(i, sectionBuffer);
  kernelData[sectionName] = sectionData;
  r.offset = r.offset + sectionLength;
}

fs.writeFileSync(config.outputKernelDirectory + '/kernel.bin.json', JSON.stringify(kernelData, null, 2));
