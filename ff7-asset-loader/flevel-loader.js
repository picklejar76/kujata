const fs = require("fs");
const stringUtil = require("./string-util.js");
const LzsDecompressor = require("../lzs/lzs-decompressor.js");
const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js");

module.exports = class FLevelLoader {

  constructor(lzsDecompressor, mapList) {
    this.lzsDecompressor = lzsDecompressor;
    this.mapList = mapList ? mapList : [];
  }

  loadFLevel(config, baseFilename, isDecompressed) {

    var charMap = require("./char-map.js");

    var buffer = fs.readFileSync(config.inputFieldFLevelDirectory + '/' + baseFilename);
    if (!isDecompressed) {
      buffer = this.lzsDecompressor.decompress(buffer);
    }

    var r = new FF7BinaryDataReader(buffer);

    let fileSizeBytes = buffer.length;
    r.offset = 0;

    let flevel = {};
    var sectionOffset = 0;
    var sectionOffsetBase = 0;

    flevel.blank = r.readShort(); // always 0x00
    flevel.numSections = r.readInt();
    flevel.sectionOffsets = [];
    for (let s=0; s<flevel.numSections; s++) {
      flevel.sectionOffsets.push(r.readInt());
    }

    // Section 0/1: "script" (Dialog and Event)

    flevel.script = {};

    var sectionOffset = r.offset;        // flevel.sectionOffsets[i]     // this offset is relative to the beginning of file
    flevel.script.length = r.readInt();
    var sectionOffsetBase = r.offset;    // flevel.sectionOffsets[i] + 4 // entityScriptRoutines[j] is relative to this offset

    flevel.script.header = {
      unknown: r.readShort(),
      numEntities: r.readByte(),
      numModels: r.readByte(),
      stringOffset: r.readUShort(),
      numAkaoOffsets: r.readShort(),
      scale: r.readShort(),
      blank: [r.readShort(), r.readShort(), r.readShort()],
      creator: r.readString(8),
      name: r.readString(8),
      entityNames: [],
      akaoOffsets: [],
      entitySections: [],
    };

    for (let i=0; i<flevel.script.header.numEntities; i++) {
      flevel.script.header.entityNames.push(r.readString(8));
    }
    for (let i=0; i<flevel.script.header.numAkaoOffsets; i++) {
      flevel.script.header.akaoOffsets.push(r.readInt());
    }

    for (let i=0; i<flevel.script.header.numEntities; i++) {
      let entitySection = {
        entityName: flevel.script.header.entityNames[i],
        entityScriptRoutines: []
      };
      for (let i=0; i<32; i++) {
        entitySection.entityScriptRoutines.push(r.readUShort());
      }
      flevel.script.header.entitySections.push(entitySection);
    }

    flevel.script.entities = [];
    flevel.script.dialogStrings = [];

    // read dialog offsets, then dialog strings
    r.offset = sectionOffsetBase + flevel.script.header.stringOffset;
    let numDialogs = r.readUShort();
    let dialogOffsets = [];
    for (let i=0; i<numDialogs; i++) {
      dialogOffsets.push(r.readUShort());
    }
    for (let i=0; i<numDialogs; i++) {
      let dialogOffset = dialogOffsets[i];
      r.offset = sectionOffsetBase + flevel.script.header.stringOffset + dialogOffset;
      let string = r.readDialogString(1000); // TODO: What's the longest dialog string?
      flevel.script.dialogStrings.push(string);
    }

    r.setDialogStrings(flevel.script.dialogStrings);

    for (let i=0; i<flevel.script.header.numEntities; i++) {
      let entity = {
        entityName: flevel.script.header.entityNames[i],
        scripts: []
      };
      flevel.script.entities.push(entity);
      for (let j=0; j<31; j++) { // TODO: support entities with 32 scripts; will need different method of determining endOffset
        let numReturnOpsProcessed = 0;
        let numReturnOpsExpected = (j == 0 ? 2 : 1);
        let startOffset = sectionOffsetBase + flevel.script.header.entitySections[i].entityScriptRoutines[j];
        r.startOffset = startOffset;
        r.offset = startOffset;
        // if (i==5 && j==0) {
        //   console.log("Entity " + i + ", Script " + j + ": Offset=" + startOffset + ", HexData:");
        //   r.printNextBufferDataAsHex();
        // }
        if (j > 0) {
          let prevStartOffset = sectionOffsetBase + flevel.script.header.entitySections[i].entityScriptRoutines[j-1];
          if (startOffset == prevStartOffset) {
            continue;
          }
        }
        let entityScript = {
          index: j,
          ops: []
        };
        var op = {};
        let done = false;
        // Determine the startOffset for the "next" script (which is the endOffset for the "current" script)
        let nextStartOffset = sectionOffsetBase + flevel.script.header.stringOffset; // default
        if (j<31) {
          // If this is not the last script for this entity, just look at the next script's offset
          nextStartOffset = sectionOffsetBase + flevel.script.header.entitySections[i].entityScriptRoutines[j+1];
        }
        let isLastScript = (j==31 || nextStartOffset == startOffset);
        if (isLastScript) {
          let isLastEntity = i == flevel.script.header.numEntities-1;
          if (isLastEntity) {
            // If this is the last entity (and last script), assume it's the end of the entire field section (beginning of string/dialog section)
            nextStartOffset = sectionOffsetBase + flevel.script.header.stringOffset;
          } else {
            // If this is not the last entity, just look at the next entity's first script offset
            nextStartOffset = sectionOffsetBase + flevel.script.header.entitySections[i+1].entityScriptRoutines[0];
          }
        }
        while (!done) {
          //let lineNumber = pad5(offset - sectionOffsetBase);
          let lineNumber = stringUtil.pad5(r.offset);
          try {
            op = r.readOpAndIncludeRawBytes(); // r.readOp();
            entityScript.ops.push(op);
            ////console.log("read op=" + JSON.stringify(op, null, 0));
          } catch (e) {
            console.error("Error while reading op in " + baseFilename + ", entity " + entity.entityName + ", index " + j + ": ", e);
            console.error("Previous ops: " + JSON.stringify(entityScript.ops, null, 2));
            op = {op:"ERROR", js: "" + e};
            entityScript.ops.push(op);
            process.exit(0);
            break;
          }
          ////console.log("offset=" + r.offset + " after adding op: " + JSON.stringify(op, null, 0));
          if (op.op == "RET") {
            if (j > 0) {
              done = true;
            } else {
              // script 0 is divided into 2 scripts: Init and Main
              numReturnOpsProcessed++;
              if (numReturnOpsProcessed == 2) {
                done = true;
              } else {
                if (numReturnOpsProcessed == 1) {
                  // done with Init script, add to array and start Main script
                  entity.scripts.push(entityScript);
                  entityScript = {
                    index: 0,
                    isMain: true,
                    ops: []
                  };
                  r.startOffset = r.offset; // fix Main gotos
                  // keep going! done is still false
                }
              }
            }
          } // end of op.op == "RET"
          if (r.offset >= nextStartOffset) {
            done = true;
          }
        } // end while(!done)
        ////console.log("End of entity " + i + " script " + j);
        if (entityScript.ops.length > 0) {
          entity.scripts.push(entityScript);
        }
      }
    }

    // Section 2/3: Model Loaders
    r.offset = flevel.sectionOffsets[2];
    var sectionOffset = r.offset;        // flevel.sectionOffsets[i]     // this offset is relative to the beginning of file
    flevel.script.length = r.readInt();
    var sectionOffsetBase = r.offset;    // flevel.sectionOffsets[i] + 4 // offsets within section are relative to this offset
    let blank = r.readShort(), numModels = r.readShort(), modelScale = r.readShort();
    flevel.model = {
      header: {
        numModels: numModels,
        modelScale: modelScale
      },
      modelLoaders: []
    };
    for (let i=0; i<numModels; i++) {
      let modelLoader = {};
      let nameLength = r.readUShort();
      modelLoader.name = r.readString(nameLength);
      let unknown = r.readUShort();
      modelLoader.hrcId = r.readString(8);
      modelLoader.scaleString = r.readString(4);
      modelLoader.numAnimations = r.readUShort();
      modelLoader.light1 = {r: r.readUByte(), g: r.readUByte(), b: r.readUByte(), x: r.readShort(), y: r.readShort(), z: r.readShort()};
      modelLoader.light2 = {r: r.readUByte(), g: r.readUByte(), b: r.readUByte(), x: r.readShort(), y: r.readShort(), z: r.readShort()};
      modelLoader.light3 = {r: r.readUByte(), g: r.readUByte(), b: r.readUByte(), x: r.readShort(), y: r.readShort(), z: r.readShort()};
      modelLoader.globalLight = {r: r.readUByte(), g: r.readUByte(), b: r.readUByte()};
      modelLoader.animations = [];

      for (let j=0; j<modelLoader.numAnimations; j++) {
        let animNameLength = r.readUShort();
        let animName = r.readString(animNameLength);
        let unknown = r.readShort();
        modelLoader.animations.push(animName);
        //modelLoader.animations.push({name: animName, unknown: unknown}); // TODO: see if anyone figured out what unknown is
      }

      flevel.model.modelLoaders.push(modelLoader);
    }

    // Section 7/8: Triggers
    r.offset = flevel.sectionOffsets[7];
    let sectionEndOffset = flevel.sectionOffsets[8];
    var sectionOffset = r.offset;        // flevel.sectionOffsets[i]     // this offset is relative to the beginning of file
    flevel.script.length = r.readInt();
    var sectionOffsetBase = r.offset;    // flevel.sectionOffsets[i] + 4 // offsets within section are relative to this offset
    flevel.triggers = {};
    flevel.triggers.header = {};
    flevel.triggers.header.fieldName = r.readString(9);
    flevel.triggers.header.controlDirection = r.readByte();
    flevel.triggers.header.cameraHeightAdjustment = r.readShort(); // could be negative
    flevel.triggers.header.cameraRange = {
      left: r.readShort(),
      bottom: r.readShort(),
      right: r.readShort(),
      top: r.readShort()
    };
    flevel.triggers.header.bgLayer3 = {};
    flevel.triggers.header.bgLayer4 = {};
    let off0x20 = [ r.readByte(), r.readByte(), r.readByte(), r.readByte() ];
    flevel.triggers.header.bgLayer3.animation = { width: r.readUShort(), height: r.readUShort() };
    flevel.triggers.header.bgLayer4.animation = { width: r.readUShort(), height: r.readUShort() };
    let off0x32 = [];
    for (let i=0; i<24; i++) {
      off0x32.push(r.readByte());
    }
    //flevel.triggers.header.bgLayer34Unknown = {off0x20: off0x20, off0x32: off0x32}; // TODO: unknowns

    flevel.triggers.gateways = [];
    for (let i=0; i<12; i++) {
      let gateway = {
        exitLineVertex1: { x: r.readShort(), y: r.readShort(), z: r.readShort() },
        exitLineVertex2: { x: r.readShort(), y: r.readShort(), z: r.readShort() },
        destinationVertex: { x: r.readShort(), y: r.readShort(), z: r.readShort() },
        fieldId: r.readUShort()
      };
      let unknown = [ r.readByte(), r.readByte(), r.readByte(), r.readByte() ];
      if (gateway.fieldId != 32767) {
        if (gateway.fieldId < this.mapList.length) {
          gateway.fieldName = this.mapList[gateway.fieldId];
        }
        flevel.triggers.gateways.push(gateway);
      }
    }

    flevel.triggers.triggers = [];
    for (let i=0; i<12; i++) {
      let trigger = {
        cornerVertex1: { x: r.readShort(), y: r.readShort(), z: r.readShort() },
        cornerVertex2: { x: r.readShort(), y: r.readShort(), z: r.readShort() },
        bgGroupId_param: r.readUByte(), // see BGON/BGOFF opcodes
        bgFrameId_state: r.readUByte(), // see BGON/BGOFF opcodes
        behavior: r.readUByte(),
        soundId: r.readUByte()
      };
      flevel.triggers.triggers.push(trigger);
    }

    // TODO: interpret this data better, consider combining showArrows and gatewayArrows, consider reoving "empty" instances
    flevel.triggers.shownArrows = [];
    for (let i=0; i<12; i++) {
      flevel.triggers.shownArrows.push(r.readByte());
    }
    flevel.triggers.gatewayArrows = [];
    for (let i=0; i<12; i++) {
      let gatewayArrow = { x: r.readInt(), z: r.readInt(), y: r.readInt(), type: r.readInt() };
      flevel.triggers.gatewayArrows.push(gatewayArrow);
    }

    var replacer = function(k, v) {
      if (k == "entitySections") { return undefined; }
      return v;
    };

    return flevel;
  }; // end loadFLevel() function

}; // end module.exports = class FLevelLoader {
