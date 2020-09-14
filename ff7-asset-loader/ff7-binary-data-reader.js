const fs = require("fs");
var stringUtil = require("./string-util.js");

class FF7BinaryDataReader {

  constructor(buffer) {
    this.buffer = buffer;
    this.length = this.buffer.length
    this.offset = 0;
    this.charMap = require("./char-map.js");
    this.kernelVars = {
      0xea: "CHAR",
      0xeb: "ITEM",
      0xec: "NUM",
      0xed: "TARGET",
      0xee: "ATTACK",
      0xef: "ID",
      0xf0: "ELEMENT"
    };
  }

  setDialogStrings(dialogStrings) {
    this.dialogStrings = dialogStrings;
  }

  readByte() { let b = this.buffer.readInt8(this.offset); this.offset += 1; return b; };
  readUByte() { let b = this.buffer.readUInt8(this.offset); this.offset += 1; return b; };
  readShort() { let s = this.buffer.readInt16LE(this.offset); this.offset += 2; return s; };
  readUShort() { let s = this.buffer.readUInt16LE(this.offset); this.offset += 2; return s; };
  read24bitInteger() { let b = this.buffer.readUIntBE(this.offset, 3); this.offset += 3; return b; };
  readInt() { let i = this.buffer.readInt32LE(this.offset); this.offset += 4; return i; };
  readUInt() { let i = this.buffer.readUInt32LE(this.offset); this.offset += 4; return i; };
  readFloat() { let f = this.buffer.readFloatLE(this.offset); this.offset += 4; return f; };

  readUByteArray(length) {
    let array = [];
    for (let i = 0; i < length; i++) {
      array.push(this.readUByte());
    }
    return array;
  };
  readUShortArray(length) {
    let array = [];
    for (let i = 0; i < length; i++) {
      array.push(this.readUShort());
    }
    return array;
  };

  peekUByte() { let b = this.buffer.readUInt8(this.offset); return b; };

  readString(len) {
    let s = "";
    for (let i = 0; i < len; i++) {
      let c = this.buffer.readUInt8(this.offset + i);
      if (c > 0) {
        s = s + String.fromCharCode(c);
      } else {
        break;
      }
    }
    this.offset += len;
    return s;
  }

  readKernelString(maxLength) {
    let s = "";
    for (let i = 0; i < maxLength; i++) {
      let c = this.buffer.readUInt8(this.offset + i);
      if (c == 0xff) {
        break;
      } else if (c < 0xe7) {
        s = s + this.charMap[c];
      } else if (c >= 0xea && c <= 0xf0) {
        let v1 = this.buffer.readUInt8(this.offset + i + 1);
        let v2 = this.buffer.readUInt8(this.offset + i + 2);
        i += 2;
        //s = s + "{" + this.kernelVars[c] + "(" + v1 + "," + v2 + ")}";
        s = s + "{" + this.kernelVars[c] + "}";
      } else if (c == 0xf8) {
        let v = this.buffer.readUInt8(this.offset + i + 1);
        i += 1;
        s = s + "{COLOR(" + v + ")}";
      } else if (c == 0xf9) {
        let v = this.buffer.readUInt8(this.offset + i + 1);
        i += 1;
        let v1 = ((v & 0b11000000) >> 6);
        let v2 = (v & 0b00111111);
        let numBytes = v1 * 2 + 4;
        let newOffset = this.offset + (i - 1) - 1 - v2;
        let oldOffset = this.offset;
        this.offset = newOffset;
        let fragment = this.readKernelString(numBytes);
        this.offset = oldOffset;
        s = s + fragment;
      } else {
        s = s + "<0x" + c.toString(16) + ">";
      }
    }
    return s;
  }

  readDialogString(maxLength) {
    let s = "";
    for (let i = 0; i < maxLength; i++) {
      let c = this.buffer.readUInt8(this.offset + i);
      if (c != 255) {
        s = s + this.charMap[c];
      } else {
        break;
      }
    }
    return s;
  }

  getCmpDesc(a, c, b) {
    if (c == 0) return a + " == " + b;
    if (c == 1) return a + " != " + b;
    if (c == 2) return a + " > " + b;
    if (c == 3) return a + " < " + b;
    if (c == 4) return a + " >= " + b;
    if (c == 5) return a + " <= " + b;
    if (c == 6) return a + " & " + b;
    if (c == 7) return a + " ^ " + b;
    if (c == 8) return a + " | " + b;
    if (c == 9) return a + " & (1<<" + b + ")";
    if (c == 10) return "!((" + a + " & (1<<" + b + ")))";
    throw new Error("unsupported comparison type: " + c);
  }

  getCharacterDesc(c) {
    if (c == 0) return "C.Cloud";
    if (c == 1) return "C.Barret";
    if (c == 2) return "C.Tifa";
    if (c == 3) return "C.Aeris";
    if (c == 4) return "C.RedXIII";
    if (c == 5) return "C.Yuffie";
    if (c == 6) return "C.CaitSith";
    if (c == 7) return "C.Vincent";
    if (c == 8) return "C.Cid";
    if (c == 9) return "C.YoungCloud";
    if (c == 10) return "C.Sephiroth";
    if (c == 11) return "C.Chocobo";
    if (c == 0xfe) return "C.NoneFE";
    if (c == 0xff) return "C.NoneFF";
    throw new Error("unexpected character id: " + c);
  }

  getNextBytes(n) {
    let $r = this; // in case we want to split this class into two classes, one for readUByte() etc. and one for readOp()+getCmpDesc()+getCharacterDesc()
    let bytes = [];
    for (let i = 0; i < n; i++) {
      let byte = $r.readUByte();
      bytes.push(byte);
    }
    return bytes;
  }

  readOpAndIncludeRawBytes() {
    let $r = this;
    let offset1 = $r.offset;
    let opData = this.readOp();
    let offset2 = $r.offset;
    let raw = [];
    $r.offset = offset1;
    for (let i = offset1; i < offset2; i++) {
      let byte = $r.readUByte();
      let hex = stringUtil.toHex2(byte);
      raw.push(hex);
    }
    opData.raw = raw.join(" ");
    return opData;
  }

  readOp() {

    let $r = this; // in case we want to split this class into two classes, one for readUByte() etc. and one for readOp()+getCmpDesc()+getCharacterDesc()

    let offset1 = $r.offset;

    let op = $r.readUByte();

    if (op == 0x00) {
      return {
        op: "RET",
        mr: "Return",
        js: "return;"
      };
    }

    if (op == 0x01) {
      let e = $r.readUByte(), bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "REQ", e: e, p: p, f: f,
        mr: "Execute script #%3 in extern group %1 (priority %2/6) - Only if the script is not already running|_script(groupID)|priority|scriptID",
        js: "entityExecuteAsync({entity:" + e + ", priority:" + p + ", function:" + f + "});",
        pres: "Tells <entityName> to <scriptName>"
      };
    }

    if (op == 0x02) {
      let e = $r.readUByte(), bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "REQSW", e: e, p: p, f: f,
        mr: "Execute script #%3 in extern group %1 (priority %2/6) - Only if the script is not already running|_script(groupID)|priority|scriptID",
        js: "entityExecuteAsyncGuaranteed({entity:" + e + ", priority:" + p + ", function:" + f + "});",
        pres: "Tells <entityName> to <scriptName>"
      };
    }

    if (op == 0x03) {
      let e = $r.readUByte(), bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "REQEW", e: e, p: p, f: f,
        js: "entityExecuteSync({entity:" + e + ", priority:" + p + ", function:" + f + "});",
        pres: "Tells <entityName> to <scriptName>"
      };
    }

    if (op == 0x04) {
      let e = $r.readUByte(), bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "PREQ", e: e, p: p, f: f,
        js: "partyMemberExecuteAsync({entity:" + e + ", priority:" + p + ", function:" + f + "});",
        pres: "Tells <partyMemberName> to <scriptName>"
      };
    }

    if (op == 0x05) {
      let e = $r.readUByte(), bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "PRQSW", e: e, p: p, f: f,
        js: "partyMemberExecuteAsyncGuaranteed({partyMemberId:" + e + ", priority:" + p + ", function:" + f + "});",
        pres: "Tells <partyMemberName> to <scriptName>"
      };
    }

    if (op == 0x06) {
      let e = $r.readUByte(), bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "PRQEW", e: e, p: p, f: f,
        js: "partyMemberExecuteSync({partyMemberId:" + e + ", priority:" + p + ", function:" + f + "});",
        pres: "Tells <partyMemberName> to <scriptName>"
      };
    }

    if (op == 0x07) {
      let bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "RETTO", p: p, f: f,
        js: "returnToFunction({priority:" + p + ", function:" + f + "});"
      };
    }

    if (op == 0x08) {
      let s = $r.readUByte();
      return {
        op: "JOIN", s: s,
        js: "joinParty({slowness:" + s + "});",
        pres: "The party gathers."
      };
    }

    if (op == 0x09) {
      let bx1by1 = $r.readUByte(), bx1 = (bx1by1 & 0xF0) >> 4, by1 = (bx1by1 & 0x0F);
      let bd1bx2 = $r.readUByte(), bd1 = (bd1bx2 & 0xF0) >> 4, bx2 = (bd1bx2 & 0x0F);
      let by2bd2 = $r.readUByte(), by2 = (by2bd2 & 0xF0) >> 4, bd2 = (by2bd2 & 0x0F);
      let x1 = $r.readShort(), y1 = $r.readShort(), d1 = $r.readUByte();
      let x2 = $r.readShort(), y2 = $r.readShort(), d2 = $r.readUByte();
      let s = $r.readUByte();
      let x1Desc = bx1 == 0 ? x1 : "Bank[" + bx1 + "][" + x1 + "]";
      let y1Desc = by1 == 0 ? y1 : "Bank[" + by1 + "][" + y1 + "]";
      let d1Desc = bd1 == 0 ? d1 : "Bank[" + bd1 + "][" + d1 + "]";
      let x2Desc = bx2 == 0 ? x2 : "Bank[" + bx2 + "][" + x2 + "]";
      let y2Desc = by2 == 0 ? y2 : "Bank[" + by2 + "][" + y2 + "]";
      let d2Desc = bd2 == 0 ? d2 : "Bank[" + bd2 + "][" + d2 + "]";
      return {
        op: "SPLIT",
        bx1: bx1, by1: by1, bd1: bd1, bx2: bx2, by2: by2, bd2: bd2, x1, y1, d1, x2, y2, d2, s,
        js: "splitParty({c1: {x:" + x1Desc + ", y:" + y1Desc + ", d:" + d1Desc + "}, c2: {x:" + x2Desc + ", y:" + y2Desc + ", d:" + d2Desc + "}, slowness:" + s + "});",
        pres: "The party spreads out."
      };
    }

    if (op == 0x0a) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let a1 = $r.readUByte(), a2 = $r.readUByte(), a3 = $r.readUByte();
      let a1Desc = b1 == 0 ? a1 : "Bank[" + b1 + "][" + a1 + "]";
      let a2Desc = b2 == 0 ? a2 : "Bank[" + b2 + "][" + a2 + "]";
      let a3Desc = b3 == 0 ? a3 : "Bank[" + b3 + "][" + a3 + "]";
      return {
        op: "SPTYE", b1: b1, b2: b2, b3: b3, a1: a1, a2: a2, a3: a3,
        js: "setParty({characterId1:" + a1Desc + ", characterId2:" + a2Desc + ", characterId3:" + a3Desc + "});",
        pres: "The party changes to <A1,A2,A3>"
      };
    }

    if (op == 0x0b) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let a1 = $r.readUByte(), a2 = $r.readUByte(), a3 = $r.readUByte();
      let a1Desc = b1 == 0 ? a1 : "Bank[" + b1 + "][" + a1 + "]";
      let a2Desc = b2 == 0 ? a2 : "Bank[" + b2 + "][" + a2 + "]";
      let a3Desc = b3 == 0 ? a3 : "Bank[" + b3 + "][" + a3 + "]";
      return {
        op: "GTPYE", b1: b1, b2: b2, b3: b3, a1: a1, a2: a2, a3: a3,
        js: a1Desc + " = getParty({partyId:0}); " + a2Desc + " = getParty({partyId:1}); " + a3Desc + " = getParty({partyId:2});",
        pres: "The party prepares to switch up..."
      };
    }

    // 0c, 0d are unused
    if (op >= 0x0c && op <= 0x0d) {
      console.error("invalid opCode: 0x" + stringUtil.toHex2(op));
      throw new Error("invalid opCode: 0x" + stringUtil.toHex2(op));
    }

    if (op == 0x0e) {
      let d = $r.readUByte();
      return {
        op: "DSKCG", d: d,
        js: "diskChangeScreen({diskId:" + d + "});"
      };
    }

    if (op == 0x0f) {
      let subOp = $r.readUByte();
      let params = [];
      let numBytes = { 0xf5: 1, 0xf6: 1, 0xf7: 1, 0xf8: 2, 0xf9: 0, 0xfa: 0, 0xfb: 1, 0xfc: 1, 0xfd: 2, 0xfe: 0, 0xff: 0 }[subOp];
      for (let i = 0; i < numBytes; i++) {
        let byte = $r.readUByte();
        params.push(byte);
      }
      let subOpName = { 0xf5: "ARROW", 0xf6: "PNAME", 0xf7: "GMSPD", 0xf8: "SMSPD", 0xf9: "FLMAT", 0xfa: "FLITM", 0xfb: "BTLCK", 0xfc: "MVLCK", 0xfd: "SPCNM", 0xfe: "RSGLB", 0xff: "CLITM" }[subOp];
      return {
        op: "SPECIAL", subOp: subOp, params: params,
        js: "specialOp({subOpName:'" + subOpName + "', params:" + JSON.stringify(params, null, 0) + "});"
      };
    }

    if (op == 0x10) {
      let baseOffset = this.offset - this.startOffset;
      let a = $r.readUByte();
      return {
        op: "JMPF", a: a,
        js: "goto " + (baseOffset + a) + ";",
        goto: baseOffset + a
      };
    }

    if (op == 0x11) {
      let baseOffset = this.offset - this.startOffset;
      let a = $r.readUShort();
      return {
        op: "JMPFL", a: a,
        js: "goto " + (baseOffset + a) + ";",
        goto: baseOffset + a
      };
    }

    if (op == 0x12) {
      let baseOffset = this.offset - 1 - this.startOffset;
      let a = $r.readUByte();
      return {
        op: "JMPB", a: a,
        js: "goto " + (baseOffset - a) + ";",
        goto: baseOffset - a
      };
    }

    if (op == 0x13) {
      let baseOffset = this.offset - 1 - this.startOffset;
      let a = $r.readUShort();
      return {
        op: "JMPBL", a: a,
        js: "goto " + (baseOffset - a) + ";",
        goto: baseOffset - a
      };
    }

    if (op == 0x14) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let a = $r.readUByte(), v = $r.readUByte(), c = $r.readUByte(), e = $r.readUByte();
      let aDesc = b1 == 0 ? a : "Bank[" + b1 + "][" + a + "]";
      let vDesc = b2 == 0 ? v : "Bank[" + b2 + "][" + v + "]";
      let cDesc = this.getCmpDesc(aDesc, c, vDesc);
      let baseOffset = this.offset - 1 - this.startOffset;
      return {
        op: "IFUB",
        b1: b1,
        b2: b2,
        a: a,
        v: v,
        c: c,
        e: e,
        js: "if (" + cDesc + ") (else goto " + (baseOffset + e) + ");",
        goto: baseOffset + e
      };
    }

    if (op == 0x15) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let a = $r.readUByte(), v = $r.readUByte(), c = $r.readUByte(), e = $r.readUShort();
      let aDesc = b1 == 0 ? a : "Bank[" + b1 + "][" + a + "]";
      let vDesc = b2 == 0 ? v : "Bank[" + b2 + "][" + v + "]";
      let cDesc = this.getCmpDesc(aDesc, c, vDesc);
      let baseOffset = this.offset - 1 - this.startOffset;
      return {
        op: "IFUBL",
        b1: b1,
        b2: b2,
        a: a,
        v: v,
        c: c,
        e: e,
        js: "if (" + cDesc + ") (else goto " + (baseOffset + e) + ");",
        goto: baseOffset + e
      };
    }

    if (op == 0x16) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let a = $r.readUShort(), v = $r.readShort(), c = $r.readUByte(), e = $r.readUByte();
      let aDesc = b1 == 0 ? a : "Bank[" + b1 + "][" + a + "]";
      let vDesc = b2 == 0 ? v : "Bank[" + b2 + "][" + v + "]";
      let cDesc = this.getCmpDesc(aDesc, c, vDesc);
      let baseOffset = this.offset - 1 - this.startOffset;
      return {
        op: "IFSW",
        b1: b1,
        b2: b2,
        a: a,
        v: v,
        c: c,
        e: e,
        js: "if (" + cDesc + ") (else goto " + (baseOffset + e) + ");",
        goto: baseOffset + e
      };
    }

    if (op == 0x17) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let a = $r.readUShort(), v = $r.readShort(), c = $r.readUByte(), e = $r.readUShort();
      let aDesc = b1 == 0 ? a : "Bank[" + b1 + "][" + a + "]";
      let vDesc = b2 == 0 ? v : "Bank[" + b2 + "][" + v + "]";
      let cDesc = this.getCmpDesc(aDesc, c, vDesc);
      let baseOffset = this.offset - 1 - this.startOffset;
      return {
        op: "IFSWL",
        b1: b1,
        b2: b2,
        a: a,
        v: v,
        c: c,
        e: e,
        js: "if (" + cDesc + ") (else goto " + (baseOffset + e) + ");",
        goto: baseOffset + e
      };
    }

    if (op == 0x18) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let a = $r.readUShort(), v = $r.readUShort(), c = $r.readUByte(), e = $r.readUByte();
      let aDesc = b1 == 0 ? a : "Bank[" + b1 + "][" + a + "]";
      let vDesc = b2 == 0 ? v : "Bank[" + b2 + "][" + v + "]";
      let cDesc = this.getCmpDesc(aDesc, c, vDesc);
      let baseOffset = this.offset - 1 - this.startOffset;
      return {
        op: "IFUW",
        b1: b1,
        b2: b2,
        a: a,
        v: v,
        c: c,
        e: e,
        js: "if (" + cDesc + ") (else goto " + (baseOffset + e) + ");",
        goto: baseOffset + e
      };
    }

    if (op == 0x19) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let a = $r.readUShort(), v = $r.readUShort(), c = $r.readUByte(), e = $r.readUShort();
      let aDesc = b1 == 0 ? a : "Bank[" + b1 + "][" + a + "]";
      let vDesc = b2 == 0 ? v : "Bank[" + b2 + "][" + v + "]";
      let cDesc = this.getCmpDesc(aDesc, c, vDesc);
      let baseOffset = this.offset - 1 - this.startOffset;
      return {
        op: "IFUWL",
        b1: b1,
        b2: b2,
        a: a,
        v: v,
        c: c,
        e: e,
        js: "if (" + cDesc + ") (else goto " + (baseOffset + e) + ");",
        goto: baseOffset + e
      };
    }

    // 1a, 1b, 1c, 1d, 1e, 1f are all unused
    if (op >= 0x1a && op <= 0x1f) {
      console.error("invalid opCode: 0x" + stringUtil.toHex2(op));
      throw new Error("invalid opCode: 0x" + stringUtil.toHex2(op));
    }

    // TODO: Minigame types
    if (op == 0x20) {
      let m = $r.readUShort(), x = $r.readShort(), y = $r.readShort(), z = $r.readShort(), g = $r.readUByte(), t = $r.readUByte();
      return {
        op: "MINIGAME", m: m, x: x, y: y, z: z, g: g, t: t,
        js: "runMinigame({mapId:" + m + ", x:" + x + ", y:" + y + ", z:" + z + ", value:" + g + ", gameType:" + t + "});"
      };
    }

    if (op == 0x21) {
      let t = $r.readUByte();
      return {
        op: "TUTORIAL", t: t,
        js: "openMainMenuAndPlayTutorial({tutorialId:" + t + "});"
      };
    }

    if (op == 0x22) {
      let bits1 = $r.readUByte(), bits2 = $r.readUByte(), bits3 = $r.readUByte(), bits4 = $r.readUByte();
      let descriptions = [];
      if (bits1 & 0b10000000) { descriptions.push("DisableRewardScreens"); }
      if (bits1 & 0b01000000) { descriptions.push("ActivateArenaMode"); }
      if (bits1 & 0b00100000) { descriptions.push("DisableVictoryMusic"); }
      if (bits1 & 0b00010000) { descriptions.push("Unknown0b00010000"); }
      if (bits1 & 0b00001000) { descriptions.push("CanNotEscape"); }
      if (bits1 & 0b00000100) { descriptions.push("PreEmptiveAttack"); }
      if (bits1 & 0b00000010) { descriptions.push("TimedBattleWithoutRewardScreen"); }
      if (bits1 & 0b00000001) { descriptions.push("Unknown0b00000001"); }
      if (bits2 & 0b00000001) { descriptions.push("NoCelebrations"); }
      if (bits3 & 0b10000000) { descriptions.push("DisableGameOver"); }
      if (bits3 & 0b00000001) { descriptions.push("DisableGameOver"); }
      return {
        op: "BTMD2", bits1: bits1, bits2: bits2, bits3: bits3, bits4: bits4,
        js: "setBattleModeOptions(" + descriptions.join(", ") + ");",
        pres: descriptions.join(", ")
      };
    }

    if (op == 0x23) {
      // TODO: battle result bits
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "BTRLD", b: b, a: a,
        js: aDesc + " = getLastBattleResult();"
      };
    }

    if (op == 0x24) {
      let a = $r.readUShort();
      return {
        op: "WAIT", a: a,
        js: "wait({numFrames:" + a + "});"
      };
    }

    if (op == 0x25) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let bxb3 = $r.readUByte(), b3 = (bxb3 & 0x0F);
      let t = $r.readUByte(), r = $r.readUByte(), g = $r.readUByte();
      let b = $r.readUByte(), s = $r.readUByte(), unused = $r.readUByte();
      let rDesc = b1 == 0 ? r : "Bank[" + b1 + "][" + r + "]";
      let gDesc = b2 == 0 ? g : "Bank[" + b2 + "][" + g + "]";
      let bDesc = b3 == 0 ? b : "Bank[" + b3 + "][" + b + "]";
      return {
        op: "NFADE",
        b1: b1,
        b2: b2,
        r: r, g: g, b: b, s: s, t: t, unused: unused,
        js: "fadeScreen({r:" + rDesc + ", g:" + gDesc + ", b:" + bDesc + ", speed:" + s + ", type:" + t + "}); // unused=" + unused,
        pres: "The screen fades..."
      };
    }

    if (op == 0x26) {
      let s = $r.readUByte();
      let sFuncDesc = s == 0 ? "enableBlink" : "disableBlink";
      return {
        op: "BLINK", s: s,
        js: sFuncDesc + "();"
      };
    }

    if (op == 0x27) {
      let s = $r.readUByte();
      let sFuncDesc = s == 0 ? "bgMovieOn" : "bgMovieOff";
      return {
        op: "BGMOVIE", s: s,
        js: sFuncDesc + "();"
      };
    }

    if (op == 0x28) {
      let l = $r.readUByte(), s = $r.readUByte();
      let vars = [];
      for (let i = 0; i < l - 3; i++) {
        vars.push($r.readUByte());
      }
      return {
        op: "KAWAI", l: l, s: s, vars: vars,
        js: "doCharacterGraphicsOp({length:" + l + ", kawaiOp:" + s + ", vars:" + vars + "});"
      };
    }

    if (op == 0x29) {
      return {
        op: "KAWIW",
        js: "waitForCharacterGraphicsOp();"
      };
    }

    if (op == 0x2a) {
      let p = $r.readUByte();
      return {
        op: "PMOVA", p: p,
        js: "moveToPartyMember({partyId:" + p + "});"
      };
    }

    if (op == 0x2b) {
      let s = $r.readUByte();
      let sFuncDesc = s == 0 ? "slipOn" : "slipOff";
      return {
        op: "SLIP", s: s,
        js: sFuncDesc + "();"
      };
    }

    if (op == 0x2c) {
      let b1bx = $r.readUByte(), b1 = (b1bx & 0xF0) >> 4, bx = (b1bx & 0x0F);
      let l = $r.readUByte(), z = $r.readShort();
      let zDesc = b1 == 0 ? z : "Bank[" + b1 + "][" + z + "]";
      return {
        op: "BGPDH", b1: b1, l: l, z: z,
        js: "setBackgroundZDepth({layerId:" + l + ", z:" + zDesc + "});"
      };
    }

    if (op == 0x2d) {
      let bxby = $r.readUByte(), bx = (bxby & 0xF0) >> 4, by = (bxby & 0x0F);
      let l = $r.readUByte(), x = $r.readShort(), y = $r.readShort();
      let xDesc = bx == 0 ? x : "Bank[" + bx + "][" + x + "]";
      let yDesc = by == 0 ? y : "Bank[" + by + "][" + y + "]";
      return {
        op: "BGSCR", bx: bx, by: by, l: l, x: x, y: y,
        js: "scrollBackgroundLayer({layerId:" + l + ", xSpeed:" + x + ", ySpeed:" + y + "});",
        pres: "The background scrolls..."
      };
    }

    if (op == 0x2e) {
      let w = $r.readUByte();
      return {
        op: "WCLS", w: w,
        js: "closeWindow({windowId:" + w + "});"
      };
    }

    if (op == 0x2f) {
      let i = $r.readUByte(), x = $r.readUShort(), y = $r.readUShort(), w = $r.readUShort(), h = $r.readUShort();
      return {
        op: "WSIZW", i: i, x: x, y: y, w: w, h: h,
        js: "resizeWindow({windowId:" + i + ", x:" + x + ", y:" + y + ", width:" + w + ", height:" + h + "});"
      };
    }

    // TODO: Button IDs:
    // 1=assist, 8=start, 10=up, 20=right, 40=down, 80=left, 100=camera, 200=target, 400=pgup, 800=pgdown, 1000=menu, 2000=ok, 4000=cancel, 8000=switch
    if (op == 0x30) {
      let b = $r.readUShort();
      let a = $r.readUByte();
      let baseOffset = this.offset - 1 - this.startOffset;
      return {
        op: "IFKEY", b: b, a: a,
        js: "if keyPressed({inputKeyBitField:" + b + ") (else goto " + (baseOffset + a) + ");",
        goto: baseOffset + a
      };
    }

    if (op == 0x31) {
      let b = $r.readUShort();
      let a = $r.readUByte();
      let baseOffset = this.offset - 1 - this.startOffset;
      return {
        op: "IFKEYON", b: b, a: a,
        js: "if keyPressedJustPressed({inputKeyBitField:" + b + ") (else goto " + (baseOffset + a) + ");",
        goto: baseOffset + a
      };
    }

    if (op == 0x32) {
      let b = $r.readUShort();
      let a = $r.readUByte();
      let baseOffset = this.offset - 1 - this.startOffset;
      return {
        op: "IFKEYOFF", b: b, a: a,
        js: "if keyPressedJustReleased({inputKeyBitField:" + b + ") (else goto " + (baseOffset + a) + ");",
        goto: baseOffset + a
      };
    }

    if (op == 0x33) {
      let s = $r.readUByte();
      let sDesc = s == 0 ? "M.Movable" : "M.Frozen";
      return {
        op: "UC", s: s,
        js: "setPlayableCharacterMovability(" + sDesc + ");"
      };
    }

    if (op == 0x34) {
      let c = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "PDIRA", c: c,
        js: "turnToCharacterOrLeaderInstant({character:" + cDesc + "});"
      };
    }

    if (op == 0x35) {
      let p = $r.readUByte(), s = $r.readUByte(), a = $r.readUByte();
      return {
        op: "PTURA", p: p, s: s, a: a,
        js: "turnToPartyMember({partyId:" + p + ", slowness:" + s + ", directionA:" + a + "});"
      };
    }

    if (op == 0x36) {
      let w = $r.readUByte(), t = $r.readUByte(), x = $r.readUByte(), y = $r.readUByte();
      return {
        op: "WSPCL", w: w, t: t, x: x, y: y,
        js: "createNumericWindow({windowId:" + w + ", type:" + t + ", x:" + x + ", y:" + y + "});"
      };
    }

    if (op == 0x37) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let w = $r.readUByte(), nLow = $r.readUShort(), nHigh = $r.readUShort(), c = $r.readUByte();
      let nLowDesc = b1 == 0 ? nLow : "Bank[" + b1 + "][" + nLow + "]";
      let nHighDesc = b2 == 0 ? nHigh : "Bank[" + b2 + "][" + nHigh + "]";
      return {
        op: "WNUMB", b1: b1, b2: b2, w: w, nLow: nLow, nHigh: nHigh, c: c,
        js: "setNumericWindowDisplayValue({windowId:" + w + ", low:" + nLowDesc + ", high:" + nHighDesc + ", maxDigits:" + c + "});"
      };
    }

    if (op == 0x38) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let bxb3 = $r.readUByte(), b3 = (bxb3 & 0x0F);
      let h = $r.readUByte(), m = $r.readUByte(), s = $r.readUByte();
      let hDesc = b1 == 0 ? h : "Bank[" + b1 + "][" + h + "]";
      let mDesc = b2 == 0 ? m : "Bank[" + b2 + "][" + m + "]";
      let sDesc = b3 == 0 ? s : "Bank[" + b3 + "][" + s + "]";
      return {
        op: "STTIM", b1: b1, b2: b2, b3: b3, h: h, m: m, s: s,
        js: "setNumericWindowTimeValue({h:" + hDesc + ", m:" + mDesc + ", s:" + sDesc + "});"
      };
    }

    if (op == 0x39) {
      let b1bx = $r.readUByte(), b1 = (b1bx & 0xF0) >> 4, bx = (b1bx & 0x0F);
      let a = $r.readUInt();
      let aDesc = b1 == 0 ? a : "Bank[" + b1 + "][" + a + "]";
      return {
        op: "GOLDU", b1: b1, a: a,
        js: "increaseGilBy({increment:" + aDesc + "});"
      };
    }

    if (op == 0x3a) {
      let b1bx = $r.readUByte(), b1 = (b1bx & 0xF0) >> 4, bx = (b1bx & 0x0F);
      let a = $r.readUInt();
      let aDesc = b1 == 0 ? a : "Bank[" + b1 + "][" + a + "]";
      return {
        op: "GOLDD", b1: b1, a: a,
        js: "decreaseGilBy({decrement:" + aDesc + "});"
      };
    }

    if (op == 0x3b) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let nLow = $r.readUByte(), nHigh = $r.readUByte();
      let nLowDesc = b1 == 0 ? nLow : "Bank[" + b1 + "][" + nLow + "]";
      let nHighDesc = b2 == 0 ? nHigh : "Bank[" + b2 + "][" + nHigh + "]";
      return {
        op: "CHGLD", b1: b1, b2: b2, nLow: nLow, nHigh: nHigh,
        js: nLowDesc + " = getGilLow(); " + nHighDesc + " = getGilHigh();"
      };
    }

    if (op == 0x3c) {
      return {
        op: "HMPMAX1",
        js: "restoreHPMPMax({ver:0x3c});"
      };
    }

    if (op == 0x3d) {
      return {
        op: "HMPMAX2",
        js: "restoreHPMPMax({ver:0x3d});"
      };
    }

    if (op == 0x3e) {
      return {
        op: "MHMMX",
        js: "restoreHPMPMax({ver:0x3e});"
      };
    }

    if (op == 0x3f) {
      return {
        op: "HMPMAX3",
        js: "restoreHPMPMax({ver:0x3f});"
      };
    }

    if (op == 0x40) {
      let n = $r.readUByte(), d = $r.readUByte();
      return {
        op: "MESSAGE", n: n, d: d,
        js: "showWindowWithDialog({window:" + n + ", dialog:" + d + "}); // " + this.dialogStrings[d]
      };
    }

    if (op == 0x41) {
      let b = $r.readUByte(), w = $r.readUByte(), i = $r.readUByte(), v = $r.readUByte();
      let vDesc = b == 0 ? v : "Bank[" + b + "][" + v + "]";
      return {
        op: "MPARA", b: b, w: w, i: i, v: v,
        js: "setMessageParam({windowId:" + w + ", varId:" + i + ", value:" + vDesc + "});"
      };
    }

    if (op == 0x42) {
      let b = $r.readUByte(), w = $r.readUByte(), i = $r.readUByte(), v = $r.readUShort();
      let vDesc = b == 0 ? v : "Bank[" + b + "][" + v + "]";
      return {
        op: "MPRA2", b: b, w: w, i: i, v: v,
        js: "setMessageParam({windowId:" + w + ", varId:" + i + ", value:" + vDesc + "});"
      };
    }

    if (op == 0x43) {
      let dialogId = $r.readUByte();
      return {
        op: "MPNAM", dialogId: dialogId,
        js: "setMapName({dialog:" + dialogId + "});"
      };
    }

    // 0x44 is unused

    if (op == 0x45) {
      let b = $r.readUByte(), p = $r.readUByte(), v = $r.readUShort();
      let vDesc = b == 0 ? v : "Bank[" + b + "][" + v + "]";
      return {
        op: "MPUP", b: b, p: p, v: v,
        js: "increaseMP({partyId:" + p + ", increment:" + vDesc + "});"
      };
    }

    // 0x46 is unused

    if (op == 0x47) {
      let b = $r.readUByte(), p = $r.readUByte(), v = $r.readUShort();
      let vDesc = b == 0 ? v : "Bank[" + b + "][" + v + "]";
      return {
        op: "MPDWN", b: b, p: p, v: v,
        js: "decreaseMP({partyId:" + p + ", decrement:" + vDesc + "});"
      };
    }

    if (op == 0x48) {
      // TODO: Menu Types and Event Types
      let ba = $r.readUByte(), w = $r.readUByte(), d = $r.readUByte(), f = $r.readUByte(), l = $r.readUByte(), a = $r.readUByte();
      let aDesc = ba == 0 ? a : "Bank[" + ba + "][" + a + "]";
      return {
        op: "ASK", ba: ba, w: w, d: d, f: f, l: l, a: a,
        js: aDesc + " = askQuestion({window:" + w + ", dialog:" + d + ", firstChoice:" + f + ", lastChoice:" + l + "});"
      };
    }

    if (op == 0x49) {
      // TODO: Menu Types and Event Types
      let b = $r.readUByte(), t = $r.readUByte(), p = $r.readUByte();
      let pDesc = b == 0 ? p : "Bank[" + b + "][" + p + "]";
      return {
        op: "MENU", b: b, t: t, p: p,
        js: "callMenu({type:" + t + ", param:" + p + "});"
      };
    }

    if (op == 0x4a) {
      let s = $r.readUByte();
      let sDesc = s == 0 ? "MM.Accessible" : "MM.Inaccessible";
      return {
        op: "MENU2", s: s,
        js: "setMainMenuAccessibility(" + sDesc + ");"
      };
    }

    if (op == 0x4b) {
      let i = $r.readUByte();
      return {
        op: "BTLTB", i: i,
        js: "setBattleEncounterTable({index:" + i + "});"
      };
    }

    // 0x4c is unused

    if (op == 0x4d) {
      let b = $r.readUByte(), p = $r.readUByte(), v = $r.readUShort();
      let vDesc = b == 0 ? v : "Bank[" + b + "][" + v + "]";
      return {
        op: "HPUP", b: b, p: p, v: v,
        js: "increaseHP({partyId:" + p + ", increment:" + vDesc + "});"
      };
    }

    // 0x4e is unused

    if (op == 0x4f) {
      let b = $r.readUByte(), p = $r.readUByte(), v = $r.readUShort();
      let vDesc = b == 0 ? v : "Bank[" + b + "][" + v + "]";
      return {
        op: "HPDWN", b: b, p: p, v: v,
        js: "decreaseHP({partyId:" + p + ", decrement:" + vDesc + "});"
      };
    }

    if (op == 0x50) {
      let n = $r.readUByte(), x = $r.readUShort(), y = $r.readUShort(), w = $r.readUShort(), h = $r.readUShort();
      return {
        op: "WINDOW", n: n, x: x, y: y, w: w, h: h,
        js: "createWindow({window:" + n + ", x:" + x + ", y:" + y + ", width:" + w + ", height:" + h + "});"
      };
    }

    if (op == 0x51) {
      let w = $r.readUByte(), x = $r.readShort(), y = $r.readShort();
      return {
        op: "WMOVE", w: w, x: x, y: y,
        js: "setWindowPosition({windowId:" + w + ", x:" + x + ", y:" + y + "});"
      };
    }

    if (op == 0x52) {
      let w = $r.readUByte(), m = $r.readUByte(), p = $r.readUByte();
      let mDesc = m == 0 ? "WindowMode.Normal" : m == 1 ? "WindowMode.NoBackgroundNoBorder" : m == 2 ? "WindowMode.TransparentBackground" : "WindowMode.UNKNOWN_" + m;
      let pDesc = p == 0 ? "Closability.Closable" : p == 1 ? "Closability.NotClosable" : "Closability.UNKNOWN_" + p;
      return {
        op: "WMODE", w: w, m: m, p: p,
        js: "setWindowModes({windowId:" + w + ", mode:" + m + ", closability:" + p + "});"
      };
    }

    if (op == 0x53) {
      let w = $r.readUByte();
      return {
        op: "WREST", w: w,
        js: "resetWindow({windowId:" + w + "});"
      };
    }

    if (op == 0x54) {
      let w = $r.readUByte();
      return {
        op: "WCLSE", w: w,
        js: "closeWindow({windowId:" + w + "});"
      };
    }

    if (op == 0x55) {
      let w = $r.readUByte(), r = $r.readUByte();
      return {
        op: "WROW", w: w, r: r,
        js: "setWindowHeightByNumRows({windowId:" + w + ", numRows:" + r + "});"
      };
    }

    if (op == 0x56) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let c = $r.readUByte(), r = $r.readUByte(), g = $r.readUByte(), b = $r.readUByte();
      let cDesc = b1 == 0 ? c : "Bank[" + b1 + "][" + c + "]";
      let rDesc = b2 == 0 ? r : "Bank[" + b2 + "][" + r + "]";
      let gDesc = b3 == 0 ? g : "Bank[" + b3 + "][" + g + "]";
      let bDesc = b4 == 0 ? b : "Bank[" + b4 + "][" + b + "]";
      return {
        op: "GWCOL", b1: b1, b2: b2, b3: b3, b4: b4, c: c, r: r, g: g, b: b,
        js: "{ let color = getWindowColor({cornerId:" + cDesc + "}); " + rDesc + " = color.r; " + gDesc + " = color.g; " + bDesc + " = color.b; }"
      };
    }

    if (op == 0x57) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let c = $r.readUByte(), r = $r.readUByte(), g = $r.readUByte(), b = $r.readUByte();
      let cDesc = b1 == 0 ? c : "Bank[" + b1 + "][" + c + "]";
      let rDesc = b2 == 0 ? r : "Bank[" + b2 + "][" + r + "]";
      let gDesc = b3 == 0 ? g : "Bank[" + b3 + "][" + g + "]";
      let bDesc = b4 == 0 ? b : "Bank[" + b4 + "][" + b + "]";
      return {
        op: "SWCOL", b1: b1, b2: b2, b3: b3, b4: b4, c: c, r: r, g: g, b: b,
        js: "setWindowColor({cornerId:" + cDesc + ", color:{r:" + rDesc + ", g:" + gDesc + ", b:" + bDesc + "}});"
      };
    }

    if (op == 0x58) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let t = $r.readUShort(), a = $r.readUByte();
      let tDesc = b1 == 0 ? t : "Bank[" + b1 + "][" + t + "]";
      let aDesc = b2 == 0 ? a : "Bank[" + b2 + "][" + a + "]";
      return {
        op: "STITM",
        b1: b1,
        b2: b2,
        t: t,
        a: a,
        js: "addItem({item:" + tDesc + ", amount:" + aDesc + "});"
      };
    }

    if (op == 0x59) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let t = $r.readUShort(), a = $r.readUByte();
      let tDesc = b1 == 0 ? t : "Bank[" + b1 + "][" + t + "]";
      let aDesc = b2 == 0 ? a : "Bank[" + b2 + "][" + a + "]";
      return {
        op: "DLITM",
        b1: b1,
        b2: b2,
        t: t,
        a: a,
        js: "dropItem({item:" + tDesc + ", amount:" + aDesc + "});"
      };
    }

    if (op == 0x5a) {
      let b = $r.readUByte(), i = $r.readUShort(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "CKITM", b: b, i: i, a: a,
        js: aDesc + " = getItemCount({itemId:" + i + "});"
      };
    }

    if (op == 0x5b) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let t = $r.readUByte(), apByte1 = $r.readUByte(), apByte2 = $r.readUByte(), apByte3 = $r.readUByte();
      let tDesc = b1 == 0 ? t : "Bank[" + b1 + "][" + t + "]";
      let apByte1Desc = b2 == 0 ? apByte1 : "Bank[" + b2 + "][" + apByte1 + "]";
      let apByte2Desc = b3 == 0 ? apByte2 : "Bank[" + b3 + "][" + apByte2 + "]";
      let apByte3Desc = b4 == 0 ? apByte3 : "Bank[" + b4 + "][" + apByte3 + "]";
      let apDesc = "(" + apByte1Desc + " + 256 * " + apByte2Desc + " + 65536 * " + apByte3Desc + ")";
      if (b2 == 0 && b3 == 0 && b4 == 0) {
        apDesc = apByte1 + 256 * apByte2 + 65536 * apByte3;
      }
      return {
        op: "SMTRA", b1: b1, b2: b2, b3: b3, b4: b4, t: t, apByte1: apByte1, apByte2: apByte2, apByte3: apByte3,
        js: "addMateriaToInventory({materiaId:" + t + ", ap:" + apDesc + "});"
      };
    }

    if (op == 0x5c) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let t = $r.readUByte(), apByte1 = $r.readUByte(), apByte2 = $r.readUByte(), apByte3 = $r.readUByte(), a = $r.readUByte();
      let tDesc = b1 == 0 ? t : "Bank[" + b1 + "][" + t + "]";
      let apByte1Desc = b2 == 0 ? apByte1 : "Bank[" + b2 + "][" + apByte1 + "]";
      let apByte2Desc = b3 == 0 ? apByte2 : "Bank[" + b3 + "][" + apByte2 + "]";
      let apByte3Desc = b4 == 0 ? apByte3 : "Bank[" + b4 + "][" + apByte3 + "]";
      let apDesc = "(" + apByte1Desc + " + 256 * " + apByte2Desc + " + 65536 * " + apByte3Desc + ")";
      if (b2 == 0 && b3 == 0 && b4 == 0) {
        apDesc = apByte1 + 256 * apByte2 + 65536 * apByte3;
      }
      return {
        op: "DMTRA", b1: b1, b2: b2, b3: b3, b4: b4, t: t, apByte1: apByte1, apByte2: apByte2, apByte3: apByte3,
        js: "deleteMateriaFromInventory({materiaId:" + t + ", ap:" + apDesc + ", amount:" + a + "});"
      };
    }

    // 0x5d is supposedly not used in the game

    if (op == 0x5e) {
      let u1 = $r.readUByte();
      let u2 = $r.readUByte();
      let c = $r.readUByte();
      let u3 = $r.readUByte();
      let u4 = $r.readUByte();
      let a = $r.readUByte();
      let s = $r.readUByte();
      return {
        op: "SHAKE", u1: u1, u2: u2, c: c, u3: u3, u4: u4, a: a, s: s,
        js: "shake({u1:" + u1 + ", u2:" + u2 + ", count:" + c + ", u3:" + u3 + ", u4:" + u4 + ", aplitude:" + a + ", speed:" + s + "});"
      };
    }

    if (op == 0x5f) {
      return {
        op: "NOP",
        js: "noOp();"
      };
    }

    if (op == 0x60) {
      let f = $r.readUShort(), x = $r.readShort(), y = $r.readShort(), i = $r.readShort(), d = $r.readUByte();
      return {
        op: "MAPJUMP", f: f, x: x, y: y, i: i, d: d,
        js: "mapJump({fieldId:" + f + ", x:" + x + ", y:" + y + ", triangleId:" + i + ", direction:" + d + "});"
      };
    }

    if (op == 0x61) {
      let p = $r.readUByte();
      return {
        op: "SCRLO", p: p,
        js: "scrollOp0x61({param:" + p + "});",
        pres: "The camera scrolls..."
      };
    }

    if (op == 0x62) {
      let p1 = $r.readUByte(), p2 = $r.readUByte(), p3 = $r.readUByte(), p4 = $r.readUByte();
      return {
        op: "SCRLC", p1: p1, p2: p2, p3: p3, p4: p4,
        js: "scrollOp0x62({param1:" + p1 + ", param2:" + p2 + ", param3:" + p3 + ", param4:" + p4 + "});",
        pres: "The camera scrolls..."
      };
    }

    if (op == 0x63) {
      let b = $r.readUByte(), s = $r.readUShort(), e = $r.readUByte(), t = $r.readUByte();
      let sDesc = b == 0 ? s : "Bank[" + b + "][" + s + "]";
      return {
        op: "SCRLA", b: b, s: s, e: e, t: t,
        js: "scrollToEntity({speedInFrame:" + sDesc + ", entityId:" + e + ", scrollType:" + t + "});",
        pres: "The camera pans to <E" + e + ">."
      };
    }

    if (op == 0x64) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let targetX = $r.readShort(), targetY = $r.readShort();
      let xDesc = b1 == 0 ? targetX : "Bank[" + b1 + "][" + targetX + "]";
      let yDesc = b2 == 0 ? targetY : "Bank[" + b2 + "][" + targetY + "]";
      return {
        op: "SCR2D",
        b1: b1,
        b2: b2,
        targetX: targetX,
        targetY: targetY,
        js: "scroll({x:" + xDesc + ", y:" + yDesc + "});"
      };
    }

    if (op == 0x65) {
      return {
        op: "SCRCC",
        js: "scrollToCurrentPlayableCharacter();"
      };
    }

    if (op == 0x66) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let bxb3 = $r.readUByte(), b3 = (bxb3 & 0x0F);
      let x = $r.readShort(), y = $r.readShort(), s = $r.readUShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      let sDesc = b3 == 0 ? s : "Bank[" + b3 + "][" + s + "]";
      return {
        op: "SCR2DC", b1: b1, b2: b2, b3: b3, x: x, y: y, s: s,
        js: "scrollSmooth({x:" + xDesc + ", y:" + yDesc + ", speed:" + sDesc + "});"
      };
    }

    if (op == 0x67) {
      return {
        op: "SCRLW",
        js: "waitForScroll();"
      };
    }

    if (op == 0x68) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let bxb3 = $r.readUByte(), b3 = (bxb3 & 0x0F);
      let x = $r.readShort(), y = $r.readShort(), s = $r.readUShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      let sDesc = b3 == 0 ? s : "Bank[" + b3 + "][" + s + "]";
      return {
        op: "SCR2DL", b1: b1, b2: b2, b3: b3, x: x, y: y, s: s,
        js: "scrollToCoordsLinear({x:" + xDesc + ", y:" + yDesc + ", s:" + sDesc + ", speed:" + s + "});"
      };
    }

    if (op == 0x69) {
      let p = $r.readUByte();
      return {
        op: "MPDSP", p: p,
        js: "MPDSPOp0x69({param:" + p + "});"
      };
    }

    if (op == 0x6a) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let x = $r.readShort(), y = $r.readShort(), s = $r.readUByte();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      return {
        op: "VWOFT", b1: b1, b2: b2, x: x, y: y, s: s,
        js: "VWOFTOp0x6a({x:" + xDesc + ", y:" + yDesc + ", s:" + s + "});"
      };
    }

    if (op == 0x6b) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let bxb3 = $r.readUByte(), b3 = (bxb3 & 0x0F);
      let r = $r.readUByte(), g = $r.readUByte(), b = $r.readUByte();
      let s = $r.readUByte(), t = $r.readUByte(), a = $r.readUByte();
      let rDesc = b1 == 0 ? r : "Bank[" + b1 + "][" + r + "]";
      let gDesc = b2 == 0 ? g : "Bank[" + b2 + "][" + g + "]";
      let bDesc = b3 == 0 ? b : "Bank[" + b3 + "][" + b + "]";
      return {
        op: "FADE",
        b1: b1,
        b2: b2,
        b3: b3,
        r: r, g: g, b: b, s: s, t: t, a: a,
        js: "fade({r:" + rDesc + ", g:" + gDesc + ", b:" + bDesc + ", speed:" + s + ", type:" + t + ", adjust:" + a + "});",
        pres: "The screen fades..."
      };
    }

    if (op == 0x6c) {
      return {
        op: "FADEW",
        js: "waitForFade();",
        pres: "..."
      };
    }

    if (op == 0x6d) {
      let i = $r.readUShort(), s = $r.readUByte();
      let sFuncDesc = s == 0 ? "disableCollisionDetection" : "enableCollisionDetection";
      return {
        op: "IDLCK", i: i, s: s,
        js: sFuncDesc + "({triangleId:" + i + "});",
        pres: "The <I" + i + "> " + (s == 0 ? "no longer blocks" : "blocks")
      };
    }

    if (op == 0x6e) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "LSTMP", b: b, a: a,
        js: aDesc + " = getLastFieldMapId(); // wm does not count"
      };
    }

    if (op == 0x6f) {
      let b = $r.readUByte(), s = $r.readUShort(), e = $r.readUByte(), t = $r.readUByte();
      let sDesc = b == 0 ? s : "Bank[" + b + "][" + s + "]";
      return {
        op: "SCRLP", b: b, s: s, e: e, t: t,
        js: "scrollToPartyMember({speedInFrame:" + sDesc + ", partyId:" + e + ", scrollType:" + t + "});",
        pres: "The camera focuses on <P" + e + ">."
      };
    }

    if (op == 0x70) {
      let b = $r.readUByte(), n = $r.readUShort();
      let nDesc = b == 0 ? n : "Bank[" + b + "][" + n + "]";
      return {
        op: "BATTLE", b: b, n: n,
        js: "startBattle({battle:" + nDesc + "});"
      };
    }

    if (op == 0x71) {
      let s = $r.readUByte();
      let func = s == 0 ? "enableRandomEncounters" : "disableRandomEncounters";
      return {
        op: "BTLON",
        s: s,
        js: func + "();",
        pres: s == 0 ? "Random monsters start showing up." : "Random monsters stop showing up."
      };
    }

    if (op == 0x72) {
      let bits1 = $r.readUByte(), bits2 = $r.readUByte();
      let descriptions = [];
      if (bits1 & 0b10000000) { descriptions.push("DisableRewardScreens"); }
      if (bits1 & 0b01000000) { descriptions.push("ActivateArenaMode"); }
      if (bits1 & 0b00100000) { descriptions.push("DisableVictoryMusic"); }
      if (bits1 & 0b00010000) { descriptions.push("Unknown0b00010000"); }
      if (bits1 & 0b00001000) { descriptions.push("CanNotEscape"); }
      if (bits1 & 0b00000100) { descriptions.push("PreEmptiveAttack"); }
      if (bits1 & 0b00000010) { descriptions.push("TimedBattleWithoutRewardScreen"); }
      if (bits1 & 0b00000001) { descriptions.push("Unknown0b00000001"); }
      if (bits2 & 0b11111110) { descriptions.push("UnknownLSB"); }
      if (bits2 & 0b00000001) { descriptions.push("DisableGameOver"); }
      return {
        op: "BTLMD", bits1: bits1, bits2: bits2,
        js: "setBattleModeOptions(" + descriptions.join(", ") + ");",
        pres: descriptions.join(", ")
      };
    }

    if (op == 0x73) {
      let b = $r.readUByte(), p = $r.readUByte(), d = $r.readUByte();
      let dDesc = b == 0 ? d : "Bank[" + b + "][" + d + "]";
      return {
        op: "PGTDR", b: b, p: p, d: d,
        js: dDesc + " = getPartyMemberDirection({partyId:" + p + "});"
      };
    }

    if (op == 0x74) {
      let b = $r.readUByte(), p = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "GETPC", b: b, p: p, a: a,
        js: aDesc + " = getPartyMemberCharacterId({partyId:" + p + "});"
      };
    }

    if (op == 0x75) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let p = $r.readUByte(), x = $r.readUByte(), y = $r.readUByte(), z = $r.readUByte(), i = $r.readUByte();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      let zDesc = b3 == 0 ? z : "Bank[" + b3 + "][" + z + "]";
      let iDesc = b4 == 0 ? i : "Bank[" + b4 + "][" + i + "]";
      return {
        op: "PXYZI", b1: b1, b2: b2, b3: b3, b4: b4, p: p, x: x, y: y, z: z, i: i,
        js: "{ let pos = getPartyMemberPosition({partyId:" + p + "}); "
          + xDesc + " = pos.x; " + yDesc + " = pos.y; " + zDesc + " = pos.z; " + iDesc + " = pos.triangleId; }"
      };
    }

    if (op == 0x76) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "PLUS!",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = add8bitClamped(" + dDesc + ", " + sDesc + ");"
      };
    }

    if (op == 0x77) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readShort();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "PLUS2!",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = add16bitClamped(" + dDesc + ", " + sDesc + ");"
      };
    }

    if (op == 0x78) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "MINUS!",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = subtract8bitClamped(" + dDesc + ", " + sDesc + ");"
      };
    }

    if (op == 0x79) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readShort();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "MINUS2!",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = subtract16bitClamped(" + dDesc + ", " + sDesc + ");"
      };
    }

    if (op == 0x7a) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "INC!",
        b: b, a: a,
        js: "increment8bitClamped(" + aDesc + ");"
      };
    }

    if (op == 0x7b) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "INC2!",
        b: b, a: a,
        js: "increment16bitClamped(" + aDesc + ");"
      };
    }

    if (op == 0x7c) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "DEC!",
        b: b, a: a,
        js: "decrement8bitClamped(" + aDesc + ");"
      };
    }

    if (op == 0x7d) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "DEC2!",
        b: b, a: a,
        js: "decrement16bitClamped(" + aDesc + ");"
      };
    }

    if (op == 0x7e) {
      let s = $r.readUByte();
      let funcDesc = s == 0 ? "interactibilityOn" : "interactibilityOff";
      return {
        op: "TLKON",
        s: s,
        js: funcDesc + "();"
      };
    }

    if (op == 0x7f) {
      let b = $r.readUByte(), s = $r.readUByte();
      let sDesc = b == 0 ? s : "Bank[" + b + "][" + s + "]";
      return {
        op: "RDMSD", b: b, s: s,
        js: "setRandomSeed({tableOffset:" + sDesc + "});"
      };
    }

    if (op == 0x80) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let a = $r.readUByte(), v = $r.readUByte();
      let aDesc = bd == 0 ? a : "Bank[" + bd + "][" + a + "]";
      let vDesc = bs == 0 ? v : "Bank[" + bs + "][" + v + "]";
      return {
        op: "SETBYTE",
        bd: bd, bs: bs, a: a, v: v,
        js: aDesc + " = " + vDesc + ";"
      };
    }

    if (op == 0x81) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let a = $r.readUByte(), v = $r.readShort();
      let aDesc = bd == 0 ? a : "Bank[" + bd + "][" + a + "]";
      let vDesc = bs == 0 ? v : "Bank[" + bs + "][" + v + "]";
      if (bd == 2 && a == 0) {
        aDesc = "$GameMoment";
      }
      return {
        op: "SETWORD",
        bd: bd, bs: bs, a: a, v: v,
        mr: aDesc + " = " + vDesc + " (16 bit)",
        js: aDesc + " = " + vDesc + ";"
      };
    }

    if (op == 0x82) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), bit = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      return {
        op: "BITON", // SETBIT seems better?
        bd: bd, bs: bs, d: d, bit: bit,
        js: "setBit({destination:" + dDesc + ", bit:" + bit + "});"
      };
    }

    if (op == 0x83) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), bit = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      return {
        op: "BITOFF", // UNSETBIT seems better?
        bd: bd, bs: bs, d: d, bit: bit,
        js: "unsetBit({destination:" + dDesc + ", bit:" + bit + "});"
      };
    }

    if (op == 0x84) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), bit = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      return {
        op: "BITXOR",
        bd: bd, bs: bs, d: d, bit: bit,
        js: "toggleBit({destination:" + dDesc + ", bit:" + bit + "});"
      };
    }

    if (op == 0x85) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "PLUS",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = add8bit(" + dDesc + ", " + sDesc + ");"
      };
    }

    if (op == 0x86) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readShort();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "PLUS2",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = add16bit(" + dDesc + ", " + sDesc + ");"
      };
    }

    if (op == 0x87) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "MINUS",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = subtract8bit(" + dDesc + ", " + sDesc + ");"
      };
    }

    if (op == 0x88) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readShort();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "MINUS2",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = subtract16bit(" + dDesc + ", " + sDesc + ");"
      };
    }

    if (op == 0x89) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "MUL",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = " + dDesc + " * " + sDesc + "; // TODO: cap at 255"
      };
    }

    if (op == 0x8a) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readShort();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "MUL2",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = " + dDesc + " * " + sDesc + ";"
      };
    }

    if (op == 0x8b) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "DIV",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = Math.floor(" + dDesc + " / " + sDesc + ");"
      };
    }

    if (op == 0x8c) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readShort();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "DIV2",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = Math.floor(" + dDesc + " / " + sDesc + ");"
      };
    }

    if (op == 0x8d) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "MOD",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = " + dDesc + " % " + sDesc + ";"
      };
    }

    if (op == 0x8e) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readShort();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "MOD2",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = " + dDesc + " % " + sDesc + ";"
      };
    }

    if (op == 0x8f) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "AND",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = " + dDesc + " & " + sDesc + ";"
      };
    }

    if (op == 0x90) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readShort();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "AND2",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = " + dDesc + " & " + sDesc + ";"
      };
    }

    if (op == 0x91) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "OR",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = " + dDesc + " | " + sDesc + ";"
      };
    }

    if (op == 0x92) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readShort();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "OR2",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = " + dDesc + " | " + sDesc + ";"
      };
    }

    if (op == 0x93) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "XOR",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = " + dDesc + " ^ " + sDesc + ";"
      };
    }

    if (op == 0x94) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readShort();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "XOR2",
        bd: bd, bs: bs, d: d, s: s,
        js: dDesc + " = " + dDesc + " ^ " + sDesc + ";"
      };
    }

    if (op == 0x95) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "INC",
        b: b, a: a,
        js: "increment8bit(" + aDesc + ");"
      };
    }

    if (op == 0x96) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "INC2",
        b: b, a: a,
        js: "increment16bit(" + aDesc + ");"
      };
    }

    if (op == 0x97) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "DEC",
        b: b, a: a,
        js: "decrement8bit(" + aDesc + ");"
      };
    }

    if (op == 0x98) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "DEC2",
        b: b, a: a,
        js: "decrement16bit(" + aDesc + ");"
      };
    }

    if (op == 0x99) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "RANDOM",
        b: b, a: a,
        js: "set8bit(" + aDesc + ", Math.floor(Math.random() * 256));"
      };
    }

    if (op == 0x9a) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "LBYTE",
        bd: bd, bs: bs, d: d, s: s,
        js: "set8bit(" + dDesc + ", get8bit(" + sDesc + "));"
      };
    }

    if (op == 0x9b) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), s = $r.readUShort();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      let sDesc = bs == 0 ? s : "Bank[" + bs + "][" + s + "]";
      return {
        op: "HBYTE",
        bd: bd, bs: bs, d: d, s: s,
        js: "set8bit(" + dDesc + ", getHighByte(" + sDesc + "));"
      };
    }

    if (op == 0x9c) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let bxb3 = $r.readUByte(), b3 = (bxb3 & 0x0F);
      let d = $r.readUByte(), l = $r.readUByte(), h = $r.readUByte();
      let dDesc = b1 == 0 ? d : "Bank[" + b1 + "][" + d + "]";
      let lDesc = b2 == 0 ? l : "Bank[" + b2 + "][" + l + "]";
      let hDesc = b3 == 0 ? h : "Bank[" + b3 + "][" + h + "]";
      return {
        op: "2BYTE",
        b1: b1, b2: b2, b3: b3, d: d, l: l, h: h,
        js: "setTwoBytes(" + dDesc + ", " + lDesc + ", " + hDesc + ");"
      };
    }

    if (op == 0x9d) {
      let p1 = $r.readUByte(), p2 = $r.readUByte(), p3 = $r.readUByte(), p4 = $r.readUByte(), p5 = $r.readUByte(), p6 = $r.readUByte();
      return {
        op: "SETX", p1: p1, p2: p2, p3: p3, p4: p4, p5: p5, p6: p6,
        js: "setX(" + p1 + ", " + p2 + ", " + p3 + ", " + p4 + ", " + p5 + ", " + p6 + ");"
      };
    }

    if (op == 0x9e) {
      let p1 = $r.readUByte(), p2 = $r.readUByte(), p3 = $r.readUByte(), p4 = $r.readUByte(), p5 = $r.readUByte(), p6 = $r.readUByte();
      return {
        op: "GETX", p1: p1, p2: p2, p3: p3, p4: p4, p5: p5, p6: p6,
        js: "getX(" + p1 + ", " + p2 + ", " + p3 + ", " + p4 + ", " + p5 + ", " + p6 + ");"
      };
    }

    if (op == 0x9f) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let b5b6 = $r.readUByte(), b5 = (b5b6 & 0xF0) >> 4, b6 = (b5b6 & 0x0F);
      let i = $r.readUByte(), s = $r.readUShort(), e = $r.readUShort(), v = $r.readUByte(), r = $r.readUByte();
      let sDesc = b2 == 0 ? s : "Bank[" + b2 + "][" + s + "]";
      let eDesc = b3 == 0 ? e : "Bank[" + b3 + "][" + e + "]";
      let vDesc = b4 == 0 ? v : "Bank[" + b4 + "][" + v + "]";
      let rDesc = b6 == 0 ? r : "Bank[" + b6 + "][" + r + "]";
      return {
        op: "SEARCHX",
        b1: b1, b2: b2, b3: b3, b4: b4, b6: b6, i: i, s: s, e: e, v: v, r: r,
        js: rDesc + " = searchAndGetIndexOfValueInBank({bank: Bank[" + b1 + "], offset:" + i + ", startOffset:" + sDesc + ", endOffset:" + eDesc + ", value:" + vDesc + "});"
      };
    }

    if (op == 0xa0) {
      let c = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "PC", c: c,
        js: "thisIsAPlayableCharacter(" + cDesc + ");"
      };
    }

    if (op == 0xa1) {
      let n = $r.readUByte();
      return {
        op: "CHAR", n: n,
        js: "thisIsAFieldModel(" + n + ");"
      };
    }

    if (op == 0xa2) {
      let a = $r.readUByte(), s = $r.readUByte();
      return {
        op: "DFANM", a: a, s: s,
        js: "playAnimationLoop({animation:" + a + ", slowness:" + s + "});"
      };
    }

    if (op == 0xa3) {
      let a = $r.readUByte(), s = $r.readUByte();
      return {
        op: "ANIME1", a: a, s: s,
        js: "playAnimationSync({animation:" + a + ", slowness:" + s + "});"
      };
    }

    if (op == 0xa4) {
      let s = $r.readUByte();
      let sDesc = s == 0 ? "V.NotVisible" : "V.Visible";
      return {
        op: "VISI", s: s,
        js: "setVisibilityMode(" + sDesc + ");"
      };
    }

    if (op == 0xa5) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let x = $r.readShort(), y = $r.readShort(), z = $r.readShort(), i = $r.readUShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      let zDesc = b3 == 0 ? z : "Bank[" + b3 + "][" + z + "]";
      let iDesc = b4 == 0 ? i : "Bank[" + b4 + "][" + i + "]";
      return {
        op: "XYZI", b1: b1, b2: b2, b3: b3, b4: b4, x, y, z, i,
        js: "placeObject({x:" + xDesc + ", y:" + yDesc + ", z:" + zDesc + ", walkmeshTriangle:" + iDesc + "});"
      };
    }

    if (op == 0xa6) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let x = $r.readShort(), y = $r.readShort(), i = $r.readUShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      let iDesc = b3 == 0 ? i : "Bank[" + b3 + "][" + i + "]";
      return {
        op: "XYI", b1: b1, b2: b2, b3: b3, x, y, i,
        js: "placeObject({x:" + xDesc + ", y:" + yDesc + ", walkmeshTriangle:" + iDesc + "});"
      };
    }

    if (op == 0xa7) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let x = $r.readShort(), y = $r.readShort(), z = $r.readUShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      let zDesc = b3 == 0 ? z : "Bank[" + b3 + "][" + z + "]";
      return {
        op: "XYZ", b1: b1, b2: b2, b3: b3, x, y, z,
        js: "placeObject({x:" + xDesc + ", y:" + yDesc + ", z:" + zDesc + "});"
      };
    }

    if (op == 0xa8) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let x = $r.readShort(), y = $r.readShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      return {
        op: "MOVE", b1: b1, b2: b2, x, y,
        js: "walkObjectTo({x:" + xDesc + ", y:" + yDesc + "});" // using standard walk animation, found with animation ID 1 in the field object
      };
    }

    if (op == 0xa9) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let x = $r.readShort(), y = $r.readShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      return {
        op: "CMOVE", b1: b1, b2: b2, x, y,
        js: "moveObjectTo({x:" + xDesc + ", y:" + yDesc + "});" // using no animation
      };
    }

    if (op == 0xaa) {
      let e = $r.readUByte();
      return {
        op: "MOVA", e: e,
        js: "moveObjectToEntity({entityId:" + e + "});"
      };
    }

    if (op == 0xab) {
      let g = $r.readUByte(), d = $r.readUByte(), s = $r.readUByte();
      return {
        op: "TURA", g: g, d: d, s: s,
        js: "turnToEntity({groupId:" + g + ", direction:" + d + ", speed:" + s + "});"
      };
    }

    if (op == 0xac) {
      return {
        op: "ANIMW",
        js: "waitForLastAnimationToFinish();"
      };
    }

    if (op == 0xad) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let x = $r.readShort(), y = $r.readShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      return {
        op: "FMOVE", b1: b1, b2: b2, x, y,
        js: "moveFieldObjectTo({x:" + xDesc + ", y:" + yDesc + "});" // using no animation
      };
    }

    if (op == 0xae) {
      let a = $r.readUByte(), s = $r.readUByte();
      return {
        op: "ANIME1", a: a, s: s,
        js: "playAnimationAsync({animation:" + a + ", slowness:" + s + "});"
      };
    }

    if (op == 0xaf) {
      let a = $r.readUByte(), s = $r.readUByte();
      return {
        op: "ANIM!1", a: a, s: s,
        js: "playAnimationOnceAsync({animation:" + a + ", slowness:" + s + "});"
      };
    }

    if (op == 0xb0) {
      let a = $r.readUByte(), f = $r.readUByte(), l = $r.readUByte(), s = $r.readUByte();
      return {
        op: "CANIM1", a: a, f: f, l: l, s: s,
        js: "playPartialAnimation({animation:" + a + ", firstFrame:" + f + ", lastFrame:" + l + ", slowness:" + s + "});"
      };
    }

    if (op == 0xb1) {
      let a = $r.readUByte(), f = $r.readUByte(), l = $r.readUByte(), s = $r.readUByte();
      return {
        op: "CANM!1", a: a, f: f, l: l, s: s,
        js: "playPartialAnimation({animation:" + a + ", firstFrame:" + f + ", lastFrame:" + l + ", slowness:" + s + "});"
      };
    }

    if (op == 0xb2) {
      let b = $r.readUByte(), s = $r.readUShort();
      let sDesc = b == 0 ? s : "Bank[" + b + "][" + s + "]";
      return {
        op: "MSPED", b: b, s: s,
        js: "setMovementSpeed({speed:" + sDesc + "});"
      };
    }

    if (op == 0xb3) {
      let b = $r.readUByte(), d = $r.readUByte();
      let dDesc = b == 0 ? d : "Bank[" + b + "][" + d + "]";
      return {
        op: "DIR", b: b, d: d,
        js: "setFacingDirection({direction:" + dDesc + "});"
      };
    }

    if (op == 0xb4) {
      let b = $r.readUByte(), r = $r.readUByte(), d = $r.readUByte(), s = $r.readUByte(), t = $r.readUByte();
      let rDesc = b == 0 ? r : "Bank[" + b + "][" + r + "]";
      return {
        op: "TURNGEN", b: b, r: r, d: d, s: s, t: t,
        js: "rotateModel({rotation:" + rDesc + ", direction:" + d + ", steps:" + s + ", stepType:" + t + "});"
      };
    }

    if (op == 0xb5) {
      let b = $r.readUByte(), r = $r.readUByte(), d = $r.readShort(), s = $r.readShort(), t = $r.readUByte();
      let rDesc = b == 0 ? r : "Bank[" + b + "][" + r + "]";
      return {
        op: "TURN", b: b, r: r, d: d, s: s, t: t,
        js: "rotateModelDeprecatedSync({rotation:" + rDesc + ", direction:" + d + ", steps:" + s + ", stepType:" + t + "});"
      };
    }

    if (op == 0xb6) {
      let e = $r.readUByte();
      return {
        op: "DIRA", e: e,
        js: "setModelDirectionToFaceEntity({entityIndex:" + e + "});"
      };
    }

    if (op == 0xb7) {
      let b = $r.readUByte(), e = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "GETDIR", b: b, e: e, a: a,
        js: aDesc + " = getEntityDirection({entityIndex:" + e + "});"
      };
    }

    if (op == 0xb8) {
      let bxby = $r.readUByte(), bx = (bxby & 0xF0) >> 4, by = (bxby & 0x0F);
      let e = $r.readUByte(), x = $r.readUByte(), y = $r.readUByte();
      let xDesc = bx == 0 ? x : "Bank[" + bx + "][" + x + "]";
      let yDesc = by == 0 ? y : "Bank[" + by + "][" + y + "]";
      return {
        op: "GETAXY", bx: bx, by: by, e, x, y,
        js: xDesc + " = getEntityX({entityIndex:" + e + "}); " + yDesc + " = getEntityY({entityIndex:" + e + "})"
      };
    }

    if (op == 0xb9) {
      let b = $r.readUByte(), e = $r.readUByte(), a = $r.readUByte();
      return {
        op: "GETAI", b: b, e: e, a: a,
        js: "Bank[" + b + "][" + a + "] = getTriangleIdUnderEntity({entity:" + e + "});"
      };
    }

    if (op == 0xba) {
      let a = $r.readUByte(), s = $r.readUByte();
      return {
        op: "ANIM!2", a: a, s: s,
        js: "playAnimationHoldLastFrameSync({animation:" + a + ", slowness:" + s + "});"
      };
    }

    if (op == 0xbb) {
      let a = $r.readUByte(), f = $r.readUByte(), l = $r.readUByte(), s = $r.readUByte();
      return {
        op: "CANIM2", a: a, f: f, l: l, s: s,
        js: "playPartialAnimation({animation:" + a + ", firstFrame:" + f + ", lastFrame:" + l + ", slowness:" + s + "});"
      };
    }

    if (op == 0xbc) {
      let a = $r.readUByte(), f = $r.readUByte(), l = $r.readUByte(), s = $r.readUByte();
      return {
        op: "CANM!2", a: a, f: f, l: l, s: s,
        js: "playPartialAnimation({animation:" + a + ", firstFrame:" + f + ", lastFrame:" + l + ", slowness:" + s + "});"
      };
    }

    if (op == 0xbd) {
      let b = $r.readUByte(), s = $r.readUShort();
      let sDesc = b == 0 ? s : "Bank[" + b + "][" + s + "]";
      return {
        op: "ASPED", b: b, s: s,
        js: "setAnimationSpeed({speed:" + sDesc + "});"
      };
    }

    // 0xbe is unused

    if (op == 0xbf) {
      let e = $r.readUByte();
      return {
        op: "CC", e: e,
        js: "setControllableCharacter({entity:" + e + "});"
      };
    }

    if (op == 0xc0) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let x = $r.readShort(), y = $r.readShort(), i = $r.readShort(), h = $r.readUShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      let iDesc = b3 == 0 ? i : "Bank[" + b3 + "][" + i + "]";
      let hDesc = b4 == 0 ? h : "Bank[" + b4 + "][" + h + "]";
      return {
        op: "JUMP", b1: b1, b2: b2, b3: b3, b4: b4, x: x, y: y, i: i, h: h,
        js: "makeObjectJump({x:" + xDesc + ", y:" + yDesc + ", triangleId:" + iDesc + ", height:" + hDesc + "});"
      };
    }

    if (op == 0xc1) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let a = $r.readUByte(), x = $r.readUByte(), y = $r.readUByte(), z = $r.readUByte(), i = $r.readUByte();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      let zDesc = b3 == 0 ? z : "Bank[" + b3 + "][" + z + "]";
      let iDesc = b4 == 0 ? i : "Bank[" + b4 + "][" + i + "]";
      return {
        op: "AXYZI", b1: b1, b2: b2, b3: b3, b4: b4, a: a, x: x, y: y, z: z, i: i,
        js: "{ let pos = getEntityPosition({entityId:" + a + "}); "
          + xDesc + " = pos.x; " + yDesc + " = pos.y; " + zDesc + " = pos.z; " + iDesc + " = pos.triangleId; }"
      };
    }

    if (op == 0xc2) {
      let advanceKeys = ['Key.Down', 'Key.Up', 'Key.Right', 'Key.Left'];
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let x = $r.readShort(), y = $r.readShort(), z = $r.readShort(), i = $r.readUShort();
      let k = $r.readUByte(), a = $r.readUByte(), d = $r.readUByte(), s = $r.readUByte();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      let zDesc = b3 == 0 ? z : "Bank[" + b3 + "][" + z + "]";
      let iDesc = b4 == 0 ? i : "Bank[" + b4 + "][" + i + "]";
      let kDesc = advanceKeys[k];
      return {
        op: "LADER", b1: b1, b2: b2, b3: b3, b4: b4, x: x, y: y, z: z, i: i, k: k, a: a, d: d, s: s,
        js: "climbLadder({x:" + xDesc + ", y:" + yDesc + ", z:" + zDesc + ", triangleId:" + iDesc +
          ", advanceKey:" + kDesc + ", animationId:" + a + ", facingDirection:" + d + ", speed:" + s + "});"
      };
    }

    if (op == 0xc3) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let t = $r.readUByte(), x = $r.readShort(), y = $r.readShort(), z = $r.readShort(), s = $r.readUShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      let zDesc = b3 == 0 ? z : "Bank[" + b3 + "][" + z + "]";
      let sDesc = b4 == 0 ? s : "Bank[" + b4 + "][" + s + "]";
      return {
        op: "OFST", b1: b1, b2: b2, b3: b3, b4: b4, x: x, y: y, z: z, s: s,
        js: "transposeObjectDisplayOnly({x:" + xDesc + ", y:" + yDesc + ", z:" + zDesc + ", speed:" + sDesc + "});"
      };
    }

    if (op == 0xc4) {
      return {
        op: "OFSTW",
        js: "waitForTransposeObjectDisplayOnly();"
      };
    }

    if (op == 0xc5) {
      let b = $r.readUByte(), r = $r.readUByte();
      let rDesc = b == 0 ? r : "Bank[" + b + "][" + r + "]";
      return {
        op: "TALKR", b: b, r: r,
        js: "setInteractibilityRadius({radius:" + r + "});"
      };
    }

    if (op == 0xc6) {
      let b = $r.readUByte(), r = $r.readUByte();
      let rDesc = b == 0 ? r : "Bank[" + b + "][" + r + "]";
      return {
        op: "SLIDR", b: b, r: r,
        js: "setCollisionRadius({radius:" + r + "});"
      };
    }

    if (op == 0xc7) {
      let s = $r.readUByte();
      let sDesc = s == 0 ? "S.Solid" : "S.NonSolid";
      return {
        op: "SOLID", s: s,
        js: "setSolidMode(" + sDesc + ");"
      };
    }

    if (op == 0xc8) {
      let c = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "PRTYP", c: c,
        js: "addToParty(" + cDesc + ");"
      };
    }

    if (op == 0xc9) {
      let c = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "PRTYM", c: c,
        js: "removeFromParty(" + cDesc + ");"
      };
    }

    if (op == 0xca) {
      let c1 = $r.readUByte(), c2 = $r.readUByte(), c3 = $r.readUByte();
      let c1Desc = this.getCharacterDesc(c1);
      let c2Desc = this.getCharacterDesc(c2);
      let c3Desc = this.getCharacterDesc(c3);
      return {
        op: "PRTYE", c1: c1, c2: c2, c3: c3,
        js: "changePartyTo([" + c1Desc + ", " + c2Desc + ", " + c3Desc + "]);"
      };
    }

    if (op == 0xcb) {
      let c = $r.readUByte(), a = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      let baseOffset = this.offset - 1 - this.startOffset;
      return {
        op: "IFPRTYQ", c: c, a: a,
        js: "if (isCharacterInParty(" + cDesc + ") (else goto " + (baseOffset + a) + ");",
        goto: baseOffset + a
      };
    }

    if (op == 0xcc) {
      let c = $r.readUByte(), a = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      let baseOffset = this.offset - 1 - this.startOffset;
      return {
        op: "IFMEMBQ", c: c, a: a,
        js: "if (isCharacterAvailable(" + cDesc + ") (else goto " + (baseOffset + a) + ");",
        goto: baseOffset + a
      };
    }

    if (op == 0xcd) {
      let s = $r.readUByte(), c = $r.readUByte();
      let sFuncDesc = s == 0 ? "makeCharacterUnavailable" : "makeCharacterAvailable";
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "MMBud", s: s, c: c,
        js: sFuncDesc + "(" + cDesc + ");"
      };
    }

    if (op == 0xce) {
      let c = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "MMBLK", c: c,
        js: "lockPartyMember(" + cDesc + ");"
      };
    }

    if (op == 0xcf) {
      let c = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "MMBUK", c: c,
        js: "unlockPartyMember(" + cDesc + ");"
      };
    }

    if (op == 0xd0) {
      let x1 = $r.readShort(), y1 = $r.readShort(), z1 = $r.readShort();
      let x2 = $r.readShort(), y2 = $r.readShort(), z2 = $r.readShort();
      return {
        op: "LINE", x1: x1, y1: y1, z1: z1, x2: x2, y2: y2, z2: z2,
        js: "createLineTrigger({x1:" + x1 + ", y1:" + y1 + ", z1:" + z1 + ", x2:" + x2 + ", y2:" + y2 + ", z2:" + z2 + "});"
      };
    }

    if (op == 0xd1) {
      let s = $r.readUByte();
      let funcDesc = s == 0 ? "disableAllLineTriggers" : "enableAllLineTriggers";
      return {
        op: "LINON",
        s: s,
        js: funcDesc + "();"
      };
    }

    if (op == 0xd2) {
      let s = $r.readUByte();
      let funcDesc = s == 0 ? "enableAllGatewayTriggers" : "disableAllGatewayTriggers";
      return {
        op: "MPJPO",
        s: s,
        js: funcDesc + "();"
      };
    }

    if (op == 0xd3) {
      let bx1by1 = $r.readUByte(), bx1 = (bx1by1 & 0xF0) >> 4, by1 = (bx1by1 & 0x0F);
      let bz1bx2 = $r.readUByte(), bz1 = (bz1bx2 & 0xF0) >> 4, bx2 = (bz1bx2 & 0x0F);
      let by2bz2 = $r.readUByte(), by2 = (by2bz2 & 0xF0) >> 4, bz2 = (by2bz2 & 0x0F);
      let x1 = $r.readShort(), y1 = $r.readShort(), z1 = $r.readShort();
      let x2 = $r.readShort(), y2 = $r.readShort(), z2 = $r.readShort();
      let x1Desc = bx1 == 0 ? x1 : "Bank[" + bx1 + "][" + x1 + "]";
      let y1Desc = by1 == 0 ? y1 : "Bank[" + by1 + "][" + y1 + "]";
      let z1Desc = bz1 == 0 ? z1 : "Bank[" + bz1 + "][" + z1 + "]";
      let x2Desc = bx2 == 0 ? x2 : "Bank[" + bx2 + "][" + x2 + "]";
      let y2Desc = by2 == 0 ? y2 : "Bank[" + by2 + "][" + y2 + "]";
      let z2Desc = bz2 == 0 ? z2 : "Bank[" + bz2 + "][" + z2 + "]";
      return {
        op: "SLINE", bx1: bx1, by1: by1, bz1: bz1, bx2: bx2, by2: by2, bz2: bz2, x1: x1, y1: y1, z1: z1, x2: x2, y2: y2, z2: z2,
        js: "setLine({v1: {x:" + x1Desc + ", y:" + y1Desc + ", z:" + z1Desc + "}, v2: {x:" + x2Desc + ", y:" + y2Desc + ", z:" + z2Desc + "}});"
      };
    }

    if (op == 0xd4) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let v1 = $r.readUShort(), v2 = $r.readUShort(), v3 = $r.readUShort(), v4 = $r.readUByte();
      return {
        op: "SIN", b1: b1, b2: b2, b3: b3, b4: b4, v1: v1, v2: v2, v3: v3, v4: v4,
        js: "doMathSinOp0xd4({b1:" + b1 + ", b2:" + b2 + ", b3:" + b3 + ", b4:" + b4 +
          ", v1:" + v1 + ", v2:" + v2 + ", v3:" + v3 + ", v4:" + v4 + "});"
      };
    }

    if (op == 0xd5) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let v1 = $r.readUShort(), v2 = $r.readUShort(), v3 = $r.readUShort(), v4 = $r.readUByte();
      return {
        op: "COS", b1: b1, b2: b2, b3: b3, b4: b4, v1: v1, v2: v2, v3: v3, v4: v4,
        js: "doMathCosOp0xd5({b1:" + b1 + ", b2:" + b2 + ", b3:" + b3 + ", b4:" + b4 +
          ", v1:" + v1 + ", v2:" + v2 + ", v3:" + v3 + ", v4:" + v4 + "});"
      };
    }

    if (op == 0xd6) {
      let b = $r.readUByte(), r = $r.readUShort();
      let rDesc = b == 0 ? r : "Bank[" + b + "][" + r + "]";
      return {
        op: "TLKR2", b: b, r: r,
        js: "setInteractibilityRadius({radius:" + r + "});"
      };
    }

    if (op == 0xd7) {
      let b = $r.readUByte(), r = $r.readUShort();
      let rDesc = b == 0 ? r : "Bank[" + b + "][" + r + "]";
      return {
        op: "SLDR2", b: b, r: r,
        js: "setCollisionRadius({radius:" + r + "});"
      };
    }

    if (op == 0xd8) {
      let i = $r.readUShort();
      return {
        op: "PMJMP", i: i,
        js: "setFieldJumpId({fieldId:" + i + "});"
      };
    }

    if (op == 0xd9) {
      return {
        op: "PMJMP2",
        js: "doPMJMP2Op0xd9();"
      };
    }

    if (op == 0xda) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let bxb5 = $r.readUByte(), b5 = (bxb5 & 0x0F);
      let akaoOp = $r.readUByte();
      let p1 = $r.readUShort(), p2 = $r.readUShort(), p3 = $r.readUShort(), p4 = $r.readUShort(), p5 = $r.readUShort();
      let p1Desc = b1 == 0 ? p1 : "Bank[" + b1 + "][" + p1 + "]";
      let p2Desc = b2 == 0 ? p2 : "Bank[" + b2 + "][" + p2 + "]";
      let p3Desc = b3 == 0 ? p3 : "Bank[" + b3 + "][" + p3 + "]";
      let p4Desc = b4 == 0 ? p4 : "Bank[" + b4 + "][" + p4 + "]";
      let p5Desc = b5 == 0 ? p5 : "Bank[" + b5 + "][" + p5 + "]";
      return {
        op: "AKAO2",
        b1: b1, b2: b2, b3: b3, b4: b4, b5: b5, akaoOp: akaoOp, p1: p1, p2: p2, p3: p3, p4: p4, p5: p5,
        js: "musicOp_da_" + stringUtil.toHex2(akaoOp) + "({p1:" + p1Desc + ", p2:" + p2Desc + ", p3:" + p3Desc + ", p4:" + p4Desc + ", p5:" + p5Desc + "});",
        pres: "Musical event..."
      };
    }

    if (op == 0xdb) {
      let s = $r.readUByte();
      let funcDesc = s == 0 ? "lockRotatability" : "unlockRotatability";
      return {
        op: "FCFIX", s: s,
        js: funcDesc + "();",
        pres: "<This> is locked facing forward."
      };
    }

    if (op == 0xdc) {
      let actionNames = ["Action.Stand", "Action.Walk", "Action.Run"];
      let a = $r.readUByte(), s = $r.readUByte(), i = $r.readUByte();
      let iDesc = actionNames[i];
      return {
        op: "CCANM", a: a, s: s, i: i,
        js: "setAnimationId({animationId:" + a + ", speed:" + s + ", actionId:" + iDesc + "});",
        pres: "<This> <Animation>."
      };
    }

    if (op == 0xdd) {
      return {
        op: "ANIMB",
        js: "stopAnimation();",
        pres: "<This> stops."
      };
    }

    if (op == 0xde) {
      return {
        op: "TURNW",
        js: "waitForTurn();",
        pres: "..."
      };
    }

    // quint8 banks[3], posSrc, posDst, start, b, g, r, colorCount;
    if (op == 0xdf) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let bxb5 = $r.readUByte(), b5 = (bxb5 & 0x0F);
      let s = $r.readUByte(), d = $r.readUByte(), i = $r.readUByte(), b = $r.readUByte(), g = $r.readUByte(), r = $r.readUByte(), size = $r.readUByte();
      let iDesc = b1 == 0 ? i : "Bank[" + b1 + "][" + i + "]";
      let bDesc = b2 == 0 ? b : "Bank[" + b2 + "][" + b + "]";
      let gDesc = b3 == 0 ? g : "Bank[" + b3 + "][" + g + "]";
      let rDesc = b4 == 0 ? r : "Bank[" + b4 + "][" + r + "]";
      let sizeDesc = b5 == 0 ? size : "Bank[" + b5 + "][" + size + "]";
      return {
        op: "MPPAL",
        b1: b1, b2: b2, b3: b3, b4: b4, b5: b5, s: s, d: d, i: i, b: b, g: g, r: r, size: size,
        js: "multiplyPaletteColors({sourcePaletteId:" + s + ", targetPaletteId:" + d + ", startColor:" + iDesc +
          ", r:" + rDesc + ", g:" + gDesc + ", b:" + bDesc + ", size:" + sizeDesc + "});",
        pres: "The colors change."
      };
    }

    if (op == 0xe0) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let a = $r.readUByte(), l = $r.readUByte();
      let aDesc = b1 == 0 ? a : "Bank[" + b1 + "][" + a + "]";
      let lDesc = b2 == 0 ? l : "Bank[" + b2 + "][" + l + "]";
      return {
        op: "BGON",
        b1: b1, b2: b2, a: a, l: l,
        js: "backgroundOn({area:" + aDesc + ", layer:" + l + "});",
        pres: "<Area:" + aDesc + "> <Layer:" + l + "> appears."
      };
    }

    if (op == 0xe1) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let a = $r.readUByte(), l = $r.readUByte();
      let aDesc = b1 == 0 ? a : "Bank[" + b1 + "][" + a + "]";
      let lDesc = b2 == 0 ? l : "Bank[" + b2 + "][" + l + "]";
      return {
        op: "BGOFF",
        b1: b1, b2: b2, a: a, l: l,
        js: "backgroundOff({area:" + aDesc + ", layer:" + l + "});",
        pres: "<Area:" + aDesc + "> <Layer:" + l + "> disappears."
      };
    }

    if (op == 0xe2) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "BGROL", b: b, a: a,
        js: "backgroundRollForward({area:" + aDesc + "});",
        pres: "<Area:" + aDesc + "> rolls forward."
      };
    }

    if (op == 0xe3) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "BGROL2", b: b, a: a,
        js: "backgroundRollBack({area:" + aDesc + "});",
        pres: "<Area:" + aDesc + "> rolls back."
      };
    }

    if (op == 0xe4) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "BGCLR", b: b, a: a,
        js: "clearBackground({area:" + aDesc + "});",
        pres: "<Area:" + aDesc + "> clears."
      };
    }

    if (op == 0xe5) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let p = $r.readUByte(), a = $r.readUByte(), size = $r.readUByte();
      let pDesc = b1 == 0 ? p : "Bank[" + b1 + "][" + p + "]";
      let aDesc = b2 == 0 ? a : "Bank[" + b2 + "][" + a + "]";
      return {
        op: "STPAL", b1: b1, b2: b2, p: p, a: a,
        js: "storePalette({paletteId:" + pDesc + ", paletteArrayId:" + aDesc + ", size:" + size + "});"
      };
    }

    if (op == 0xe6) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let p = $r.readUByte(), a = $r.readUByte(), size = $r.readUByte();
      let pDesc = b1 == 0 ? p : "Bank[" + b1 + "][" + p + "]";
      let aDesc = b2 == 0 ? a : "Bank[" + b2 + "][" + a + "]";
      return {
        op: "LDPAL", b1: b1, b2: b2, p: p, a: a,
        js: "loadPalette({paletteId:" + pDesc + ", paletteArrayId:" + aDesc + ", size:" + size + "});"
      };
    }

    if (op == 0xe7) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let s = $r.readUByte(), d = $r.readUByte(), size = $r.readUByte();
      let sDesc = b1 == 0 ? s : "Bank[" + b1 + "][" + s + "]";
      let dDesc = b2 == 0 ? d : "Bank[" + b2 + "][" + d + "]";
      return {
        op: "CPPAL", b1: b1, b2: b2, s: s, d: d,
        js: "copyPalette({sourceArrayId:" + sDesc + ", targetArrayId:" + dDesc + ", size:" + size + "});"
      };
    }

    // quint8 banks[2], posSrc, posDst, start, end;
    if (op == 0xe8) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let posSrc = $r.readUByte(), posDst = $r.readUByte(), start = $r.readUByte(), end = $r.readUByte();
      return {
        op: "RTPAL", b1: b1, b2: b2, b3: b3, b4: b4, posSrc: posSrc, posDst: posDst, start: start, end: end,
        js: "copyPalettePartial({posSrc:" + posSrc + ", posDst:" + posDst + ", start:" + start + ", end:" + end + "});"
      };
    }

    if (op == 0xe9) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let bxb5 = $r.readUByte(), b5 = (bxb5 & 0x0F);
      let s = $r.readUByte(), d = $r.readUByte(), b = $r.readUByte(), g = $r.readUByte(), r = $r.readUByte(), size = $r.readUByte();
      let sDesc = b1 == 0 ? s : "Bank[" + b1 + "][" + s + "]";
      let dDesc = b2 == 0 ? d : "Bank[" + b2 + "][" + d + "]";
      let bDesc = b3 == 0 ? b : "Bank[" + b3 + "][" + b + "]";
      let gDesc = b4 == 0 ? g : "Bank[" + b4 + "][" + g + "]";
      let rDesc = b5 == 0 ? r : "Bank[" + b5 + "][" + r + "]";
      return {
        op: "ADPAL",
        b1: b1, b2: b2, b3: b3, b4: b4, b5: b5, s: s, d: d, b: b, g: g, r: r, size: size,
        js: "addPaletteColors_0xe9({sourcePaletteId:" + s + ", targetPaletteId:" + d +
          ", r:" + rDesc + ", g:" + gDesc + ", b:" + bDesc + ", size:" + size + "});"
      };
    }

    if (op == 0xea) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let bxb5 = $r.readUByte(), b5 = (bxb5 & 0x0F);
      let s = $r.readUByte(), d = $r.readUByte(), b = $r.readUByte(), g = $r.readUByte(), r = $r.readUByte(), size = $r.readUByte();
      let sDesc = b1 == 0 ? s : "Bank[" + b1 + "][" + s + "]";
      let dDesc = b2 == 0 ? d : "Bank[" + b2 + "][" + d + "]";
      let bDesc = b3 == 0 ? b : "Bank[" + b3 + "][" + b + "]";
      let gDesc = b4 == 0 ? g : "Bank[" + b4 + "][" + g + "]";
      let rDesc = b5 == 0 ? r : "Bank[" + b5 + "][" + r + "]";
      return {
        op: "MPPAL2",
        b1: b1, b2: b2, b3: b3, b4: b4, b5: b5, s: s, d: d, b: b, g: g, r: r, size: size,
        js: "multiplyPaletteColors2({sourcePaletteId:" + s + ", targetPaletteId:" + d +
          ", r:" + rDesc + ", g:" + gDesc + ", b:" + bDesc + ", size:" + size + "});"
      };
    }

    if (op == 0xeb) {
      let p = $r.readUByte(), posSrc = $r.readUByte(), start = $r.readUByte(), size = $r.readUByte();
      return {
        op: "STPLS", p: p, posSrc: posSrc, start: start, size: size,
        js: "storePalette({paletteId:" + p + ", posSrc:" + posSrc + ", start:" + start + ", size:" + size + "});"
      };
    }

    if (op == 0xec) {
      let p = $r.readUByte(), posSrc = $r.readUByte(), start = $r.readUByte(), size = $r.readUByte();
      return {
        op: "LDPLS", posSrc: posSrc, p: p, start: start, size: size,
        js: "loadPalette({posSrc:" + posSrc + ", paletteId:" + p + ", start:" + start + ", size:" + size + "});"
      };
    }

    if (op == 0xed) {
      let p1 = $r.readUByte(), p2 = $r.readUByte(), p3 = $r.readUByte(), p4 = $r.readUByte(), p5 = $r.readUByte(), p6 = $r.readUByte(), p7 = $r.readUByte();
      return {
        op: "CPPAL2", p1: p1, p2: p2, p3: p3, p4: p4, p5: p5, p6: p6, p7: p7,
        js: "op0xed_CPPAL2(" + p1 + ", " + p2 + ", " + p3 + ", " + p4 + ", " + p5 + ", " + p6 + ", " + p7 + ");"
      };
    }

    if (op == 0xee) {
      let p1 = $r.readUByte(), p2 = $r.readUByte(), p3 = $r.readUByte(), p4 = $r.readUByte(), p5 = $r.readUByte(), p6 = $r.readUByte(), p7 = $r.readUByte();
      return {
        op: "RTPAL2", p1: p1, p2: p2, p3: p3, p4: p4, p5: p5, p6: p6, p7: p7,
        js: "op0xee_RTPAL2(" + p1 + ", " + p2 + ", " + p3 + ", " + p4 + ", " + p5 + ", " + p6 + ", " + p7 + ");"
      };
    }

    if (op == 0xef) {
      let p1 = $r.readUByte(), p2 = $r.readUByte(), p3 = $r.readUByte(), p4 = $r.readUByte(), p5 = $r.readUByte();
      let p6 = $r.readUByte(), p7 = $r.readUByte(), p8 = $r.readUByte(), p9 = $r.readUByte(), p10 = $r.readUByte();
      return {
        op: "ADPAL2", p1: p1, p2: p2, p3: p3, p4: p4, p5: p5, p6: p6, p7: p7, p8: p8, p9: p9, p10: p10,
        js: "op0xef_ADPAL2(" + p1 + ", " + p2 + ", " + p3 + ", " + p4 + ", " + p5 +
          ", " + p6 + ", " + p7 + ", " + p8 + ", " + p9 + ", " + p10 + ");"
      };
    }

    if (op == 0xf0) {
      let id = $r.readUByte();
      return {
        op: "MUSIC", id: id,
        js: "playMusic({song:" + id + "});",
        pres: "Song starts: <Song:" + id + ">"
      };
    }

    if (op == 0xf1) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let i = $r.readUShort(), d = $r.readUByte();
      let iDesc = b1 == 0 ? i : "Bank[" + b1 + "][" + i + "]";
      let dDesc = b2 == 0 ? d : "Bank[" + b2 + "][" + d + "]";
      return {
        op: "SOUND", b1: b1, b2: b2, i: i, d: d,
        js: "playSound({sound:" + iDesc + ", direction:" + dDesc + "});"
      };
    }

    if (op == 0xf2) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let bxb5 = $r.readUByte(), b5 = (bxb5 & 0x0F);
      let akaoOp = $r.readUByte(), p1 = $r.readUByte();
      let p2 = $r.readUShort(), p3 = $r.readUShort(), p4 = $r.readUShort(), p5 = $r.readUShort();
      let p1Desc = b1 == 0 ? p1 : "Bank[" + b1 + "][" + p1 + "]";
      let p2Desc = b2 == 0 ? p2 : "Bank[" + b2 + "][" + p2 + "]";
      let p3Desc = b3 == 0 ? p3 : "Bank[" + b3 + "][" + p3 + "]";
      let p4Desc = b4 == 0 ? p4 : "Bank[" + b4 + "][" + p4 + "]";
      let p5Desc = b5 == 0 ? p5 : "Bank[" + b5 + "][" + p5 + "]";
      return {
        op: "AKAO",
        b1: b1, b2: b2, b3: b3, b4: b4, b5: b5, akaoOp: akaoOp, p1: p1, p2: p2, p3: p3, p4: p4, p5: p5,
        js: "musicOp_F2_" + stringUtil.toHex2(akaoOp) + "({p1:" + p1Desc + ", p2:" + p2Desc + ", p3:" + p3Desc + ", p4:" + p4Desc + ", p5:" + p5Desc + "});",
        pres: "Music event."
      };
    }

    if (op == 0xf3) {
      let id = $r.readUByte();
      return {
        op: "MUSVT", id: id,
        js: "musicVTOp0xf3({song:" + id + "});"
      };
    }

    if (op == 0xf4) {
      let id = $r.readUByte();
      return {
        op: "MUSVM", id: id,
        js: "musicVMOp0xf4({song:" + id + "});"
      };
    }

    if (op == 0xf5) {
      let s = $r.readUByte();
      let sDesc = s == 0 ? "M.NotLocked" : "M.Locked";
      return {
        op: "MULCK", s: s,
        js: "setMusicLockMode(" + sDesc + ");"
      };
    }

    if (op == 0xf6) {
      let id = $r.readUByte();
      return {
        op: "BMUSC", id: id,
        js: "setBattleMusic({song:" + id + "});"
      };
    }

    if (op == 0xf8) {
      let m = $r.readUByte();
      return {
        op: "PMVIE", m: m,
        js: "setCurrentMovie({movie:" + m + "});"
      };
    }

    if (op == 0xf9) {
      return {
        op: "MOVIE",
        js: "playMovie();"
      };
    }

    if (op == 0xfa) {
      let b = $r.readUByte(), a = $r.readUByte();
      return {
        op: "MVIEF", b: b, a: a,
        js: "Bank[" + b + "][" + a + "] = getCurrentMovieFrame();"
      };
    }

    if (op == 0xfb) {
      let s = $r.readUByte();
      let sFuncDesc = s == 0 ? "useMovieCamera" : "stopUsingMovieCamera";
      return {
        op: "MVCAM", s: s,
        js: sFuncDesc + "();"
      };
    }

    if (op == 0xfc) {
      let p = $r.readUByte();
      return {
        op: "FMUSC", p: p,
        js: "musicF({p:" + p + "});"
      };
    }

    if (op == 0xfd) {
      let i = $r.readUByte(), p1 = $r.readUByte(), p2 = $r.readUByte(), p3 = $r.readUByte(), p4 = $r.readUByte(), p5 = $r.readUByte(), p6 = $r.readUByte();
      return {
        op: "CMUSC", i: i, p1: p1, p2: p2, p3: p3, p4: p4, p5: p5, p6: p6,
        js: "musicC(" + i + ", " + p1 + ", " + p2 + ", " + p3 + ", " + p4 + ", " + p5 + ", " + p6 + ");"
      };
    }

    if (op == 0xfe) {
      let b = $r.readUByte(), a = $r.readUByte();
      return {
        op: "CHMST", b: b, a: a,
        js: "Bank[" + b + "][" + a + "] = isMusicPlaying();"
      };
    }

    if (op == 0xff) {
      return {
        op: "GAMEOVER",
        js: "gameOver();"
      };
    }

    // definitely want to throw Error here to prevent attempts to translate subsequent opcodes, which will be invalid/out-of-sync
    console.error("unsupported opCode: 0x" + stringUtil.toHex2(op));
    throw new Error("unsupported opCode: 0x" + stringUtil.toHex2(op));

  }; // end of readOp()

  printNextBufferDataAsHex(numRows = 30, numCols = 8) {
    console.log();
    let pad5 = stringUtil.pad5, toHex2 = stringUtil.toHex2, toHex5 = stringUtil.toHex5;
    let hex = "";
    for (let i = 0; i < numRows; i++) {
      hex = toHex5(this.offset) + " + " + toHex5(i * numCols) + " = " + toHex5(this.offset + i * numCols) + " : ";
      for (let j = 0; j < numCols; j++) {
        let pos = this.offset + i * numCols + j;
        if (pos >= this.buffer.length) {
          hex = hex + "EOF";
        } else {
          let c = this.buffer[pos];
          hex = hex + toHex2(c) + " ";
        }
      }
      hex = hex + "    ";
      for (let j = 0; j < numCols; j++) {
        let pos = this.offset + i * numCols + j;
        if (pos >= this.buffer.length) {
          hex = hex + "";
        } else {
          let c = this.buffer[pos];
          //hex = hex + (c >= 0x20 && c <= 127 ? String.fromCharCode(c) : ".");
          hex = hex + (c < 0xd0 ? this.charMap[c] : ".");
        }
      }
      console.log(hex);
      hex = "";
    }
  };

} // end of class FF7BinaryDataReader

module.exports = {
  FF7BinaryDataReader
};
