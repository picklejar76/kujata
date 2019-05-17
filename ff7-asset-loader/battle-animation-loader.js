const fs = require("fs");
const stringUtil = require("./string-util.js");
const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js");

module.exports = class BattleAnimationLoader {

  constructor() {
    this.debugCount = 0;
  }

  // converts an expression to type Long
  CLng(byte) {
    // TODO: handle negative bytes, or if not needed, remove this function
    return byte;
  }

  // if v=0xFFFF, return -1
  unsignedShortToSignedShort(unsignedShort) {
    let signedShort = unsignedShort < 0x8000 ? unsignedShort : unsignedShort - 0x10000;
    //console.log("unsignedShortToSignedShort: " + unsignedShort + " => " + signedShort);
    return signedShort;
  }

  extendSignInteger(val, length) {
    let aux_res = 0; // long

    if (length != 12) {
      aux_res = aux_res;
    }

    if ((val & Math.pow(2, (length - 1))) != 0) {
      aux_res = Math.pow(2, 16) - 1;
      aux_res = aux_res ^ (Math.pow(2, length) - 1);
      aux_res = aux_res | val;
      return this.unsignedShortToSignedShort(aux_res);
    } else {
      return val;
    }
  }

  getSignExtendedShort(src, valLength) {
    if (valLength > 0) {
        if (valLength < 16) {
            return this.extendSignInteger(src, valLength);
        } else {
            return this.unsignedShortToSignedShort(src); // CopyMemory GetSignExtendedShort, src, 2
        }
    } else {
        return 0;
    }
  }

  getBitBlockV(vect, nBits, offsetBitHolder) {
    let temp_val = this.getBitBlockVUnsigned(vect, nBits, offsetBitHolder); // as integer (short)
    //console.log("temp_val (signed bitblock value) = " + temp_val);
    let signExtendedValue = this.getSignExtendedShort(temp_val, nBits);
    //console.log("             sign-extended value = " + signExtendedValue);
    return signExtendedValue;
  }

  getBitBlockVUnsigned(vect, nBits, offsetBitHolder) {

    let FBit = offsetBitHolder.FBit;

    //let aux_res = null; // As Integer
    let res = 0;

    if (nBits > 0) {
      let base_byte = Math.floor(FBit / 8);
      let unaligned_by_bits = FBit % 8;
      if (unaligned_by_bits + nBits > 8) {
        let is_aligned = (unaligned_by_bits == 0);
        let end_bits = (FBit + nBits) % 8;
        let clean_end = (end_bits == 0);

        let num_bytes = Math.floor((nBits - (is_aligned ? 0 : 8 - unaligned_by_bits) - (clean_end ? 0 : end_bits)) / 8) + (is_aligned ? 0 : 1) + (clean_end ? 0 : 1);
        let last_aligned_byte = num_bytes - (clean_end ? 0 : 1) - 1;
        let first_aligned_byte = 0;
        res = 0;

        // unaligned bits from part of the first byte
        //Stored at the begining of the byte
        if (!is_aligned) {
          res = this.CLng(vect[base_byte]);
          res = res & (Math.pow(2, (8 - unaligned_by_bits)) - 1);
          first_aligned_byte = 1;
        }

        // full bytes
        for (let BI = first_aligned_byte; BI <= last_aligned_byte; BI++) {
          res = res * 256;
          res = res | this.CLng(vect[base_byte + BI]);
        }

        // unaligned bits from part of the last byte
        if (!clean_end) {
          res = res * Math.pow(2, end_bits);
          res = res | (
            (
              Math.floor(
                 this.CLng(vect[base_byte + last_aligned_byte + 1])
                     /
                 Math.pow(2, (8 - end_bits))
             )
            )
                 & (Math.pow(2, end_bits) - 1)
          );
        }
      } else {
        res = this.CLng(vect[base_byte]);
        res = Math.floor(res / Math.pow(2, (8 - (unaligned_by_bits + nBits)))); // TODO: bit shift would be faster! like res = res >> (unaligned_by_bits + nBits)
        res = res & (Math.pow(2, nBits) - 1);
      }

      let returnValue = this.unsignedShortToSignedShort(res);
      //console.log("DEBUG: bitBlockValue=" + res);

      FBit = FBit + nBits;

      offsetBitHolder.FBit = FBit;

      this.debugCount++;
      if (this.debugCount >= 6) {
        ////process.exit(0);
      }

      return returnValue;

    } else {
      return 0;
    }
  }

  getDegreesFromRaw(val, key) {
    return (val / Math.pow(2, (12 - key))) * 360.0;
  }

  readUncompressedFrameBoneRotation(stream, offsetBitHolder, key) {
    let value = this.getBitBlockV(stream, 12 - key, offsetBitHolder); // TODO: find way to "modify" offset bit
    //Convert to 12-bits value
    value = value * Math.pow(2, key);
    return value; // should be a short
  }

  readFrameBoneRotationDelta(stream, offsetBitHolder, key) {
    if (this.getBitBlockVUnsigned(stream, 1, offsetBitHolder) == 1) {
      let value = null;
      let dLength = this.getBitBlockVUnsigned(stream, 3, offsetBitHolder);
      if (dLength == 0) {
        //Minimum bone rotation decrement
        value = -1;
      } else if (dLength == 7) {
        //Just like the first frame
        value = this.getBitBlockV(stream, 12 - key, offsetBitHolder);
      } else {
        value = this.getBitBlockV(stream, dLength, offsetBitHolder);
        //Invert the value of the last bit
        let aux_sign_val = Math.pow(2, dLength - 1);
        if (value < 0) {
          value = value - aux_sign_val;
        } else {
          value = value + aux_sign_val;
        }
      }
      //Convert to 12-bits value
      value = value * Math.pow(2, key);
      return value;
    } else {
      return 0;
    }
  }

  readUncompressedFrameBone(stream, offsetBitHolder, key) {
    let bone = {};
    bone.AccumAlphaS = this.readUncompressedFrameBoneRotation(stream, offsetBitHolder, key);
    bone.AccumBetaS  = this.readUncompressedFrameBoneRotation(stream, offsetBitHolder, key);
    bone.AccumGammaS = this.readUncompressedFrameBoneRotation(stream, offsetBitHolder, key);
    bone.AccumAlphaL = bone.AccumAlphaS < 0 ? bone.AccumAlphaS + 0x1000 : bone.AccumAlphaS;
    bone.AccumBetaL  = bone.AccumBetaS  < 0 ? bone.AccumBetaS  + 0x1000 : bone.AccumBetaS;
    bone.AccumGammaL = bone.AccumGammaS < 0 ? bone.AccumGammaS + 0x1000 : bone.AccumGammaS;
    bone.x = this.getDegreesFromRaw(bone.AccumAlphaL, 0);
    bone.y  = this.getDegreesFromRaw(bone.AccumBetaL,  0);
    bone.z = this.getDegreesFromRaw(bone.AccumGammaL, 0);
    return bone;
  }

  readFrameBone(stream, offsetBitHolder, key, lastFrameBone) {
    let bone = {};
    bone.AccumAlphaS = lastFrameBone.AccumAlphaS + this.readFrameBoneRotationDelta(stream, offsetBitHolder, key);
    bone.AccumBetaS  = lastFrameBone.AccumBetaS  + this.readFrameBoneRotationDelta(stream, offsetBitHolder, key);
    bone.AccumGammaS = lastFrameBone.AccumGammaS + this.readFrameBoneRotationDelta(stream, offsetBitHolder, key);
    bone.AccumAlphaL = bone.AccumAlphaS < 0 ? bone.AccumAlphaS + 0x1000 : bone.AccumAlphaS;
    bone.AccumBetaL  = bone.AccumBetaS  < 0 ? bone.AccumBetaS  + 0x1000 : bone.AccumBetaS;
    bone.AccumGammaL = bone.AccumGammaS < 0 ? bone.AccumGammaS + 0x1000 : bone.AccumGammaS;
    bone.x = this.getDegreesFromRaw(bone.AccumAlphaL, 0);
    bone.y  = this.getDegreesFromRaw(bone.AccumBetaL,  0);
    bone.z = this.getDegreesFromRaw(bone.AccumGammaL, 0);
    return bone;
  }

  readUncompressedFrame(stream, offsetBitHolder, key, bonesVectorLength) {
    let frame = {};
    frame.rootRotation    = { x: 0, y: 0, z: 0 };
    frame.rootTranslation = {};
    frame.rootTranslation.x = this.getBitBlockV(stream, 16, offsetBitHolder);
    //console.log("X_start=" +frame.rootTranslation.x);
    frame.rootTranslation.y = -this.getBitBlockV(stream, 16, offsetBitHolder);
    //console.log("Y_start=" +frame.rootTranslation.x);
    frame.rootTranslation.z = this.getBitBlockV(stream, 16, offsetBitHolder);
    //console.log("Z_start=" +frame.rootTranslation.x);
    frame.boneRotations = [];
    for (let bi=0; bi<bonesVectorLength; bi++) {
      let boneRotation = this.readUncompressedFrameBone(stream, offsetBitHolder, key);
      boneRotation.i = bi;
      frame.boneRotations.push(boneRotation);
    }
    return frame;
  }

  readFrame(stream, offsetBitHolder, key, bonesVectorLength, frames, fi) {
    let frame = {};
    frame.rootRotation    = { x: 0, y: 0, z: 0 };
    frame.rootTranslation = {};
    //let offLength = 0;
    let lastFrame = frames[fi-1];
    for (let oi=0; oi<3; oi++) {
      let flag = this.getBitBlockV(stream, 1, offsetBitHolder) & 1;
      let offLength = flag == 0 ? 7 : 16;
      if      (oi == 0) { frame.rootTranslation.x =  this.getBitBlockV(stream, offLength, offsetBitHolder) + lastFrame.rootTranslation.x; }
      else if (oi == 1) { frame.rootTranslation.y = -this.getBitBlockV(stream, offLength, offsetBitHolder) + lastFrame.rootTranslation.y; }
      else              { frame.rootTranslation.z =  this.getBitBlockV(stream, offLength, offsetBitHolder) + lastFrame.rootTranslation.z; }
    }
    frame.boneRotations = [];
    for (let bi=0; bi<bonesVectorLength; bi++) {
      let boneRotation = this.readFrameBone(stream, offsetBitHolder, key, lastFrame.boneRotations[bi]);
      boneRotation.i = bi;
      frame.boneRotations.push(boneRotation);
    }
    frames[fi] = frame;
    return true;
  }

  readBattleAnimation(r, startOffset, bonesVectorLength) {
    let animation = {};
    r.offset = startOffset;

    animation.numBones = r.readUInt();
    animation.numFrames = r.readUInt();
    animation.blockLength = r.readUInt();
    // TODO: Determine "true" rotation order instead of hard-coding it here.
    animation.rotationOrder1 = 1;
    animation.rotationOrder2 = 0;
    animation.rotationOrder3 = 2;

    if (animation.blockLength < 11) {
      ////console.log("WARN: unexpectedly small blockLength=" + animation.blockLength);
      if (animation.blockLength > 0) {
        animation.unknownData = r.readUByteArray(animation.blockLength);
      }
      animation.numFrames2 = 0;
      return {};
    }

    animation.numFrames2 = r.readUShort();
    animation.animationLength = r.readUShort();
    animation.key = r.readUByte();

    let byteStream = null;

    // Hack for reading animations with missing secondary frame counter (which can't be actually used by FF7)
    if (animation.numFrames2 == animation.blockLength - 5) {
      console.log("WARN: Ignoring animation missing secondary frame counter");
      r.offset = startOffset + 12;
      animation.animationLength = r.readUShort();
      animation.key = r.readUByte();
      byteStream = r.readUByteArray(animation.animationLength);
      animation.missingNumFrames2 = true;
    } else {
      byteStream = r.readUByteArray(animation.animationLength); //.map(b => b.toString(16).padStart(2, '0')).join("");
      animation.missingNumFrames2 = false;
    }

    let sanityCheck = true;

    if (animation.numFrames != animation.numFrames2) {
      console.log("WARNING: numFrames is different from NumFrames2");
    }

    let errorMessage = null;
    if (!(animation.key == 0 || animation.key == 2 || animation.key == 4)) {
      console.log("ERROR: Invalid key: " + animation.key);
      sanityCheck = false;
    }

    if (!sanityCheck) {
      console.log("ERROR: frame count sanity check failed; skipping animation.");
      animation.numFrames2 = 0;
      //byteStream = r.readUByteArray(animation.animationLength);
      return;
    }

    animation.animationFrames = [];
    let offsetBitHolder = {
      FBit: 0
    };
    animation.animationFrames[0] = this.readUncompressedFrame(byteStream, offsetBitHolder, animation.key, bonesVectorLength);
    for (let fi=1; fi<animation.numFrames2; fi++) {
      //If we ran out of data while reading the frame, it means this frame doesn't
      let lastOffsetBit = offsetBitHolder.FBit;
      let success = this.readFrame(byteStream, offsetBitHolder, animation.key, bonesVectorLength, animation.animationFrames, fi);
      if (!success) {
        animation.numFrames2 = fi;
        offsetBitHolder.FBit = lastOffsetBit;
        break;
      }
    }

    if (animation.blockLength - animation.animationLength > 5) {
      //console.log("WARN: animation.blockLength - animation.animationLength > 5");
      r.offset = startOffset + 12 + animation.animationLength + 5;
      animation.unknownData = r.readUByteArray(animation.blockLength - animation.animationLength - 5).map(b => b.toString(16).padStart(2, '0')).join("");
    }

    r.offset = startOffset + animation.blockLength + 12;

    // final adjustment for bone rotations
    animation.numBones--; // don't "count" the root bone
    for (let frame of animation.animationFrames) {
      frame.rootRotation = frame.boneRotations[0];
      frame.boneRotations = frame.boneRotations.slice(1);
    }

    return animation;
  }

  // similar to Kimera's "ReadDAAnimationsPack" subroutine in FF7DAAnimationsPack.bas
  // filename should be something like "rtda" for Cloud (and will always end in "da")
  loadBattleAnimationPack(config, filename, numBones, numBodyAnimations, numWeaponAnimations) {

    var buffer = fs.readFileSync(config.inputBattleBattleDirectory + '/' + filename);

    var r = new FF7BinaryDataReader(buffer);

    let fileSizeBytes = buffer.length;
    r.offset = 0;

    let pack = {};

    pack.numAnimations = r.readUInt();
    pack.numBodyAnimations = numBodyAnimations;
    pack.numWeaponAnimations = numWeaponAnimations;
    pack.bodyAnimations = [];
    pack.weaponAnimations = [];

    //console.log("DEBUG: pack=" + JSON.stringify(pack, null, 2));

    for (let ai=0; ai<numBodyAnimations; ai++) {
      //console.log("DEBUG: reading body animation " + ai);
      let bonesPlusOne = (numBones > 1 ? numBones + 1 : 1);
      let animation = this.readBattleAnimation(r, r.offset, bonesPlusOne);
      pack.bodyAnimations.push(animation);
      if (ai==0) {
        ////console.log("DEBUG: animation 0 first frame = " + JSON.stringify(animation.animationFrames[0], null, 2));
      }
    }

    //console.log("DEBUG: pack=" + JSON.stringify(pack, null, 2));

    for (let ai=0; ai<numWeaponAnimations; ai++) {
      let animation = this.readBattleAnimation(r, r.offset, 1);
      pack.weaponAnimations.push(animation);
    }

    return pack;

  }; // end loadBattleModel() function

}; // end module.exports = class BattleModelLoader {
