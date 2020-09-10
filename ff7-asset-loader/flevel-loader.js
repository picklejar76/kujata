const fs = require("fs");
const stringUtil = require("./string-util.js");
const LzsDecompressor = require("../lzs/lzs-decompressor.js");
const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js");
const backgroundLayerRenderer = require("./background-layer-renderer.js");
const musicList = JSON.parse(fs.readFileSync('../metadata/music-list/music-list-combined.json', 'utf-8'));
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
    for (let s = 0; s < flevel.numSections; s++) {
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

    for (let i = 0; i < flevel.script.header.numEntities; i++) {
      flevel.script.header.entityNames.push(r.readString(8));
    }
    for (let i = 0; i < flevel.script.header.numAkaoOffsets; i++) {
      flevel.script.header.akaoOffsets.push(r.readInt());
    }

    for (let i = 0; i < flevel.script.header.numEntities; i++) {
      let entitySection = {
        entityName: flevel.script.header.entityNames[i],
        entityScriptRoutines: []
      };
      for (let i = 0; i < 32; i++) {
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
    for (let i = 0; i < numDialogs; i++) {
      dialogOffsets.push(r.readUShort());
    }
    for (let i = 0; i < numDialogs; i++) {
      let dialogOffset = dialogOffsets[i];
      r.offset = sectionOffsetBase + flevel.script.header.stringOffset + dialogOffset;
      let string = r.readDialogString(1000); // TODO: What's the longest dialog string?
      flevel.script.dialogStrings.push(string);
    }

    r.setDialogStrings(flevel.script.dialogStrings);

    for (let i = 0; i < flevel.script.header.numEntities; i++) {
      let entity = {
        entityId: i,
        entityName: flevel.script.header.entityNames[i],
        entityType: '', // Purely added for positioning in JSON, updated delow
        scripts: []
      }
      // if (i === 14) { console.log('entity', entity, flevel.script.header.entitySections[i].entityScriptRoutines) } // DEBUG

      flevel.script.entities.push(entity);
      for (let j = 0; j < 31; j++) { // TODO: support entities with 32 scripts; will need different method of determining endOffset
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
          let prevStartOffset = sectionOffsetBase + flevel.script.header.entitySections[i].entityScriptRoutines[j - 1];
          if (startOffset == prevStartOffset) {
            continue;
          }
        }
        let entityScript = {
          index: j,
          scriptType: '',
          ops: []
        };
        var op = {};
        let done = false;
        // Determine the startOffset for the "next" script (which is the endOffset for the "current" script)
        let nextStartOffset = sectionOffsetBase + flevel.script.header.stringOffset; // default
        // if (i === 14) { console.log('-----------  default', j, nextStartOffset) } // Debug
        if (j < 31) {
          // If this is not the last script for this entity, just look at the next script's offset
          nextStartOffset = sectionOffsetBase + flevel.script.header.entitySections[i].entityScriptRoutines[j + 1];
          // if (i === 14) { console.log('  j < 31', startOffset, nextStartOffset) } //Debug
        }
        const lastScriptOffset = sectionOffsetBase + flevel.script.header.entitySections[i].entityScriptRoutines[flevel.script.header.entitySections[i].entityScriptRoutines.length - 1]
        let isLastScript = (j == 31 || lastScriptOffset == startOffset);
        // if (i === 14) { console.log('  isLastScript', isLastScript, j, nextStartOffset, startOffset, lastScriptOffset) } // Debug
        if (isLastScript) {
          let isLastEntity = i == flevel.script.header.numEntities - 1;
          if (isLastEntity) {
            // If this is the last entity (and last script), assume it's the end of the entire field section (beginning of string/dialog section)
            nextStartOffset = sectionOffsetBase + flevel.script.header.stringOffset;
            // if (i === 14) { console.log('last script last entity', j, r.offset, nextStartOffset) } // Debug
          } else {
            // If this is not the last entity, just look at the next entity's first script offset
            nextStartOffset = sectionOffsetBase + flevel.script.header.entitySections[i + 1].entityScriptRoutines[0];
            // if (i === 14) { console.log('last script not last entity', j, r.offset, nextStartOffset) } // Debug
          }
        }
        // if (i === 14) { console.log(' nextStartOffset', j, r.offset, nextStartOffset) } // Debug

        let byteIndexOffset = 0
        while (!done) {
          //let lineNumber = pad5(offset - sectionOffsetBase);
          let lineNumber = stringUtil.pad5(r.offset);
          let byteIndex = r.offset - startOffset
          try {
            op = r.readOpAndIncludeRawBytes(); // r.readOp();
            if (entityScript.ops.length === 0) {
              byteIndexOffset = byteIndex
            }
            op.byteIndex = byteIndex - byteIndexOffset

            entityScript.ops.push(op);
            ////console.log("read op=" + JSON.stringify(op, null, 0));
          } catch (e) {
            console.error("Error while reading op in " + baseFilename + ", entity " + entity.entityName + ", index " + j + ": ", e);
            console.error("Previous ops: " + JSON.stringify(entityScript.ops, null, 2));
            op = { op: "ERROR", js: "" + e };
            entityScript.ops.push(op);
            // process.exit(0);
            // TODO - For some reason there is an error with mds7st3 aval script 6
            // It looks as though the entityScriptRoutines value for the next script is just wrong
            // It says the value should be +46, but it isn't. Catching this single error anyway
            break
          }
          // console.log(`offset=${r.offset} max=${nextStartOffset} after adding op: ${JSON.stringify(op, null, 0)}`)
          if (op.op == "RET") {
            if (j > 0) {
              // done = true; // Not required anymore, presence of a RET doesn't mean end of the script
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
                    scriptType: '',
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
            // if (i === 14) { console.log('  done', j, r.offset, nextStartOffset) } // Debug
            done = true;
          } else {
            // if (i === 14) { console.log('  continue', j, r.offset, nextStartOffset) } // Debug
          }
        } // end while(!done)
        ////console.log("End of entity " + i + " script " + j);
        if (entityScript.ops.length > 0) {
          entity.scripts.push(entityScript);
        }
      }
    }

    const getEntityType = (entity) => {
      if (entity.scripts.length === 0) { return 'Unknown' }

      let ops0 = entity.scripts[0].ops.map(o => o.op)

      if (ops0.includes('PC')) { return 'Playable Character' }
      if (ops0.includes('CHAR')) { return 'Model' }
      if (ops0.includes('LINE')) { return 'Line' }
      if (
        ops0.includes('BGPDH') || ops0.includes('BGSCR') || ops0.includes('BGON') ||
        ops0.includes('BGOFF') || ops0.includes('BGROL') || ops0.includes('BGROL2') ||
        ops0.includes('BGCLR')
      ) { return 'Animation' }
      if (ops0.includes('MPNAM')) { return 'Director' }

      if (entity.scripts.length >= 2) {
        let ops1 = entity.scripts[1].ops.map(o => o.op)
        if (ops1.includes('MPNAM')) { return 'Director' }
      }
      return 'Unknown'
    }
    const getScriptType = (script, entityType) => {
      switch (script.index) { // This is the adjusted index, rather than the array position
        case 0:
          if (script.isMain) {
            return 'Main'
          } else {
            return 'Init'
          }
        case 1:
          if (entityType === 'Model') { return 'Talk' }
          if (entityType === 'Line') { return '[OK]' }
          break
        case 2:
          if (entityType === 'Model') { return 'Contact' }
          if (entityType === 'Line') { return 'Move' }
          break
        case 3:
          if (entityType === 'Line') { return 'Move' }
          break
        case 4:
          if (entityType === 'Line') { return 'Go' }
          break
        case 5:
          if (entityType === 'Line') { return 'Go 1x' }
          break
        case 6:
          if (entityType === 'Line') { return 'Go away' }
          break
        default:
          break
      }
      return `Script ${script.index}`
    }
    for (let i = 0; i < flevel.script.entities.length; i++) {
      const entity = flevel.script.entities[i]
      entity.entityType = getEntityType(entity) // Get the type of entity, it's really metadata, but useful
      for (let j = 0; j < entity.scripts.length; j++) {
        const script = entity.scripts[j]
        script.scriptType = getScriptType(script, entity.entityType)
        // console.log('getScriptType', script.index, script.isMain, entity.entityName, entity.entityType, '->', script.scriptType)
      }
    }

    // AKAO - eg music (Note all are music, this could be a tutorial also) - This should be built upon
    flevel.script.akao = []
    for (let i = 0; i < flevel.script.header.akaoOffsets.length; i++) {
      r.offset = flevel.script.header.akaoOffsets[i] + 50
      const musicId = r.readUByte()
      flevel.script.akao.push(musicList[musicId])
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
    for (let i = 0; i < numModels; i++) {
      let modelLoader = {};
      let nameLength = r.readUShort();
      modelLoader.name = r.readString(nameLength);
      let unknown = r.readUShort();
      modelLoader.hrcId = r.readString(8);
      modelLoader.scaleString = r.readString(4);
      modelLoader.numAnimations = r.readUShort();
      modelLoader.light1 = { r: r.readUByte(), g: r.readUByte(), b: r.readUByte(), x: r.readShort(), y: r.readShort(), z: r.readShort() };
      modelLoader.light2 = { r: r.readUByte(), g: r.readUByte(), b: r.readUByte(), x: r.readShort(), y: r.readShort(), z: r.readShort() };
      modelLoader.light3 = { r: r.readUByte(), g: r.readUByte(), b: r.readUByte(), x: r.readShort(), y: r.readShort(), z: r.readShort() };
      modelLoader.globalLight = { r: r.readUByte(), g: r.readUByte(), b: r.readUByte() };
      modelLoader.animations = [];

      for (let j = 0; j < modelLoader.numAnimations; j++) {
        let animNameLength = r.readUShort();
        let animName = r.readString(animNameLength);
        let unknown = r.readShort();
        modelLoader.animations.push(animName);
        //modelLoader.animations.push({name: animName, unknown: unknown}); // TODO: see if anyone figured out what unknown is
      }

      flevel.model.modelLoaders.push(modelLoader);
    }

    // Section 1/2: Camera
    r.offset = flevel.sectionOffsets[1];
    var sectionOffset = r.offset;        // flevel.sectionOffsets[i]     // this offset is relative to the beginning of file
    let cameraSectionLength = r.readUInt();
    var sectionOffsetBase = r.offset;    // flevel.sectionOffsets[i] + 4 // offsets within section are relative to this offset
    var readCameraVector = function () {
      return {
        x: r.readShort(),
        y: r.readShort(),
        z: r.readShort()
      }
    }
    flevel.cameraSection = {
      cameras: []
    };
    let camera = {
      xAxis: readCameraVector(),
      yAxis: readCameraVector(),
      zAxis: readCameraVector(),
      zz: r.readShort(),
      position: { x: r.readInt(), y: r.readInt(), z: r.readInt() },
      blank: r.readInt(),
      zoom: r.readUShort(),
      unknown: r.readUShort()
    }
    flevel.cameraSection.cameras.push(camera);

    // Section 4/5: Walkmesh
    r.offset = flevel.sectionOffsets[4];
    var sectionOffset = r.offset;        // flevel.sectionOffsets[i]     // this offset is relative to the beginning of file
    let walkmeshSectionLength = r.readUInt();
    var sectionOffsetBase = r.offset;    // flevel.sectionOffsets[i] + 4 // offsets within section are relative to this offset
    let numSectors = r.readUInt();
    flevel.walkmeshSection = {
      numSectors: numSectors,
      triangles: [],
      accessors: []
    };
    var readWalkmeshVertex = function () {
      return {
        x: r.readShort(),
        y: r.readShort(),
        z: r.readShort(),
        res: r.readShort() // res = Triangle[0].z (padding)
      }
    }
    for (let i = 0; i < numSectors; i++) {
      flevel.walkmeshSection.triangles.push({ vertices: [readWalkmeshVertex(), readWalkmeshVertex(), readWalkmeshVertex()] });
    }
    for (let i = 0; i < numSectors; i++) {
      flevel.walkmeshSection.accessors.push([r.readShort(), r.readShort(), r.readShort()]);
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
    flevel.triggers.header.controlDirection = r.readUByte();
    flevel.triggers.header.controlDirectionDegrees = ((256 - flevel.triggers.header.controlDirection) * 360 / 256) - 180; // Relative to y axis
    flevel.triggers.header.cameraHeightAdjustment = r.readShort(); // could be negative
    flevel.triggers.header.cameraRange = {
      left: r.readShort(),
      bottom: r.readShort(),
      right: r.readShort(),
      top: r.readShort()
    };
    flevel.triggers.header.bgLayer3 = {};
    flevel.triggers.header.bgLayer4 = {};
    let off0x20 = [r.readByte(), r.readByte(), r.readByte(), r.readByte()];
    flevel.triggers.header.bgLayer3.animation = { width: r.readUShort(), height: r.readUShort() };
    flevel.triggers.header.bgLayer4.animation = { width: r.readUShort(), height: r.readUShort() };
    let off0x32 = [];
    for (let i = 0; i < 24; i++) {
      off0x32.push(r.readByte());
    }
    //flevel.triggers.header.bgLayer34Unknown = {off0x20: off0x20, off0x32: off0x32}; // TODO: unknowns

    flevel.triggers.gateways = [];
    for (let i = 0; i < 12; i++) {
      let gateway = {
        exitLineVertex1: { x: r.readShort(), y: r.readShort(), z: r.readShort() },
        exitLineVertex2: { x: r.readShort(), y: r.readShort(), z: r.readShort() },
        destinationVertex: { x: r.readShort(), y: r.readShort(), triangleId: r.readShort() },
        fieldId: r.readUShort()
      };
      gateway.destinationVertex.direction = r.readByte()
      let unknown = [r.readByte(), r.readByte(), r.readByte()];
      if (gateway.fieldId != 32767) {
        if (gateway.fieldId < this.mapList.length) {
          gateway.fieldName = this.mapList[gateway.fieldId];
        }
        flevel.triggers.gateways.push(gateway);
      }
    }

    flevel.triggers.triggers = [];
    for (let i = 0; i < 12; i++) {
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

    // TODO: interpret this data better, consider combining showArrows and gatewayArrows, consider removing "empty" instances
    for (let i = 0; i < 12; i++) {
      const showArrow = r.readByte()
      if (flevel.triggers.gateways[i]) {
        flevel.triggers.gateways[i].showArrow = showArrow
      }
    }
    flevel.triggers.gatewayArrows = [];
    for (let i = 0; i < 12; i++) {
      let gatewayArrow = { x: r.readInt(), z: r.readInt(), y: r.readInt(), type: r.readInt() };
      flevel.triggers.gatewayArrows.push(gatewayArrow);
    }

    var replacer = function (k, v) {
      if (k == "entitySections") { return undefined; }
      return v;
    };



    // Section 3/4: Palette
    r.offset = flevel.sectionOffsets[3]
    flevel.palette = {
      length: r.readUInt(),
      header: {
        length: r.readUInt(),
        palX: r.readUShort(),
        palY: r.readUShort(),
        colorsPerPage: r.readUShort(),
        pageCount: r.readUShort()
      },
      pages: []
    }
    for (let i = 0; i < flevel.palette.header.pageCount; i++) {
      let page = []
      for (let j = 0; j < flevel.palette.header.colorsPerPage; j++) {
        let bytes = r.readShort()
        const color = backgroundLayerRenderer.getColorForPalette(bytes)
        page.push(color)
      }
      flevel.palette.pages.push(page)
    }

    // Section 8/9: Background
    r.offset = flevel.sectionOffsets[8]
    const setLayerIDs = (tile) => {
      switch (tile.id) { // id = z, where lower values are closer to the camera. 4095 = layer 0, 4096 = layer 2, 0 = layer 3
        case 4095: tile.layerID = 0; tile.param = 0; tile.state = 0; break; // Reset params for layer 0, shouldn't really be set
        case 4096: tile.layerID = 2; break;
        case 0: tile.layerID = 3; break;
        default: tile.layerID = 1; break;
      }
      tile.z = tile.id
      return tile
    }
    const readTile = (r) => {
      const blank = r.readUShort()
      const destinationX = r.readShort()
      const destinationY = r.readShort()
      const unknown1 = r.readUByteArray(4)
      const sourceX = r.readUByte()
      const unknown2 = r.readUByte()
      const sourceY = r.readUByte()
      const unknown3 = r.readUByte()
      const sourceX2 = r.readUByte()
      const unknown4 = r.readUByte()
      const sourceY2 = r.readUByte()
      const unknown5 = r.readUByte()
      const width = r.readUShort()
      const height = r.readUShort()
      const paletteId = r.readUByte()
      const unknown6 = r.readUByte()
      const id = r.readUShort()
      const param = r.readUByte()
      const statePow2 = r.readUByte()
      const blending = r.readUByte()
      const unknown7 = r.readUByte()
      const typeTrans = r.readUByte()
      const unknown8 = r.readUByte()
      const textureId = r.readUByte()
      const unknown9 = r.readUByte()
      const textureId2 = r.readUByte()
      const unknown10 = r.readUByte()
      const depth = r.readUByte()
      const unknown11 = r.readUByte()
      const idBig = r.readUInt()
      const sourceXBig = r.readUInt()
      const sourceYBig = r.readUInt()
      const blank2 = r.readUShort()
      return setLayerIDs({
        destinationX,
        destinationY,
        sourceX,
        sourceY,
        sourceX2,
        sourceY2,
        width,
        height,
        paletteId,
        id,
        param,
        statePow2,
        state: statePow2 > 0 ? Math.log2(statePow2) : 0,
        blending,
        typeTrans,
        textureId,
        textureId2,
        depth,
        idBig,
        sourceXBig,
        sourceYBig,
        // unknown: { // Uncomment should they wish to be used
        //   blank, blank2, unknown1, unknown2, unknown3, unknown4, unknown5, unknown6, unknown7, unknown8,
        //   unknown9, unknown10, unknown11
        // }
      })
    }
    flevel.background = {
      length: r.readUInt(),
      header: {
        zero1: r.readUShort(),
        usePaddles: r.readUShort(),
        activated: r.readUByte()
      },
      palette: {}
    }

    let paletteTitle = r.readString(7)
    flevel.background.palette.ignoreFirstPixel = r.readUByteArray(20)
    let paletteZero2 = r.readUInt()
    let paletteBack = r.readString(4)

    flevel.background.tiles = {
      layer1: {
        width: r.readUShort(),
        height: r.readUShort(),
        tileCount: r.readUShort(),
        depth: r.readUShort(),
        tiles: []
      }
    }
    flevel.background.tiles.layer1.blank = r.readUShort()
    for (let i = 0; i < flevel.background.tiles.layer1.tileCount; i++) {
      flevel.background.tiles.layer1.tiles.push(readTile(r))
    }
    flevel.background.tiles.layer1.blank2 = r.readUShort()

    for (let layerNo = 2; layerNo <= 4; layerNo++) {
      let layerFlag = r.readUByte()
      if (layerFlag === 1) {
        flevel.background.tiles[`layer${layerNo}`] = {
          width: r.readUShort(),
          height: r.readUShort(),
          tileCount: r.readUShort(),
          unknown: r.readUByteArray(layerNo == 2 ? 16 : 10),
          tiles: []
        }
        flevel.background.tiles[`layer${layerNo}`].blank = r.readUShort()
        for (let i = 0; i < flevel.background.tiles[`layer${layerNo}`].tileCount; i++) {
          let tile = readTile(r)
          flevel.background.tiles[`layer${layerNo}`].tiles.push(tile)
        }
        flevel.background.tiles[`layer${layerNo}`].blank2 = r.readUShort()
      }
    }


    let textureHeader = r.readString(7)
    // console.log('TEXTURE ->', textureHeader) // Check that all has been read properly
    flevel.background.textures = {}

    for (let textureCount = 0; textureCount < 42; textureCount++) { // Max possible 42 - https://github.com/niemasd/PyFF7/wiki/Field-File-Section-9%3A-Background
      let exists = r.readUShort()
      if (exists) {
        let size = r.readUShort()
        let depth = r.readUShort()
        let textureData
        if (depth === 2) {
          textureData = r.readUShortArray(256 * 256 * (depth / 2)) // Depth = 2 tiles don't seem to use palettes but instead have the colour directly, so it needs to be 2 bytes
        } else {
          textureData = r.readUByteArray(256 * 256 * depth)
        }
        flevel.background.textures[`texture${textureCount}`] = { textureId: textureCount, size: size, depth: depth, data: textureData }
      }
    }
    let end = r.readString(3)
    let ff7 = r.readString(14)
    // console.log('ff7 ->', ff7) // Check that all has been read properly

    // Render Backgrounds
    if (config.renderBackgroundLayers && config.renderBackgroundLayers === true) {
      const bgFolder = `${config.metadataDirectory}/background-layers/`
      const thisBgFolder = `${bgFolder}/${baseFilename}`
      if (!fs.existsSync(bgFolder)) {
        fs.mkdirSync(bgFolder)
      } if (!fs.existsSync(thisBgFolder)) {
        fs.mkdirSync(thisBgFolder)
      }
      backgroundLayerRenderer.renderBackgroundLayers(flevel, thisBgFolder, baseFilename)
    }

    // Clean up json object so it doesn't contain all pallette and texture data
    const textureIDs = Object.keys(flevel.background.textures)
    for (let i = 0; i < textureIDs.length; i++) {
      const textureID = textureIDs[i]
      flevel.background.textures[textureID].data = 'Omitted to reduce size'
    }
    const layerIDs = Object.keys(flevel.background.tiles)
    for (let i = 0; i < layerIDs.length; i++) {
      const layerID = layerIDs[i]
      flevel.background.tiles[layerID].tiles = 'Omitted to reduce size'
    }
    flevel.palette.pages = 'Omitted to reduce size'


    return flevel;
  }; // end loadFLevel() function

}; // end module.exports = class FLevelLoader {
