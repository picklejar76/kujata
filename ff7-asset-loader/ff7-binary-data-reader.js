const fs = require("fs");
var stringUtil = require("./string-util.js");

class FF7BinaryDataReader {

  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
    this.charMap = require("./char-map.js");
  }

  setDialogStrings(dialogStrings) {
    this.dialogStrings = dialogStrings;
  }

  readInt()    { let i = this.buffer.readInt32LE(this.offset);  this.offset += 4; return i; };
  readUInt()   { let i = this.buffer.readUInt32LE(this.offset); this.offset += 4; return i; };
  readFloat()  { let f = this.buffer.readFloatLE(this.offset);  this.offset += 4; return f; };
  readByte()   { let b = this.buffer.readInt8   (this.offset);  this.offset += 1; return b; };
  readUByte()  { let b = this.buffer.readUInt8  (this.offset);  this.offset += 1; return b; };
  readShort()  { let s = this.buffer.readInt16LE(this.offset);  this.offset += 2; return s; };
  readUShort() { let s = this.buffer.readUInt16LE(this.offset); this.offset += 2; return s; };

  readString(len) {
    let s = "";
    for (let i=0; i<len; i++) {
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
    if (c == 0xfe) return "C.None";
    throw new Error("unexpected character id: " + cid);
  }

  getNextBytes(n) {
    let $r = this; // in case we want to split this class into two classes, one for readUByte() etc. and one for readOp()+getCmpDesc()+getCharacterDesc()
    let bytes = [];
    for (let i=0; i<n; i++) {
      let byte = $r.readUByte();
      bytes.push(byte);
    }
    return bytes;
  }

  readOp() {

    let $r = this; // in case we want to split this class into two classes, one for readUByte() etc. and one for readOp()+getCmpDesc()+getCharacterDesc()

    let op = $r.readUByte();

    if (op == 0x00) {
      return {
        op: "RET",
        description: "return;"
      };
    }

    if (op == 0x01) {
      let e = $r.readUByte(), bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "REQ", e: e, p: p, f: f,
        description: "entityExecuteAsync({entity:" + e + ", priority:" + p + ", function:" + f + "});"
      };
    }

    if (op == 0x02) {
      let e = $r.readUByte(), bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "REQSW", e: e, p: p, f: f,
        description: "entityExecuteAsyncGuaranteed({entity:" + e + ", priority:" + p + ", function:" + f + "});"
      };
    }

    if (op == 0x03) {
      let e = $r.readUByte(), bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "REQEW", e: e, p: p, f: f,
        description: "entityExecuteSync({entity:" + e + ", priority:" + p + ", function:" + f + "});"
      };
    }

    if (op == 0x04) {
      let e = $r.readUByte(), bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "REQEW", e: e, p: p, f: f,
        description: "entityExecuteAsyncNonguaranteed({entity:" + e + ", priority:" + p + ", function:" + f + "});"
      };
    }

    if (op == 0x05) {
      let e = $r.readUByte(), bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "PRQSW", e: e, p: p, f: f,
        description: "partyMemberExecuteAsyncGuaranteed({partyMemberId:" + e + ", priority:" + p + ", function:" + f + "});"
      };
    }

    if (op == 0x06) {
      let e = $r.readUByte(), bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "PRQEW", e: e, p: p, f: f,
        description: "partyMemberExecuteSyncGuaranteed({partyMemberId:" + e + ", priority:" + p + ", function:" + f + "});"
      };
    }

    if (op == 0x07) {
      let bpbf = $r.readUByte(), p = (bpbf & 0b11100000) >> 5, f = (bpbf & 0b00011111);
      return {
        op: "RETTO", p: p, f: f,
        description: "returnToFunction({priority:" + p + ", function:" + f + "});"
      };
    }

    if (op == 0x08) {
      let s = $r.readUByte();
      return {
        op: "JOIN", s: s,
        description: "joinParty({slowness:" + s + "});"
      };
    }

    if (op == 0x09) {
      let bx1by1 = $r.readUByte(), bx1 = (bx1by1 & 0xF0) >> 4, by1 = (bx1by1 & 0x0F);
      let bd1bx2 = $r.readUByte(), dz1 = (bd1bx2 & 0xF0) >> 4, bx2 = (bd1bx2 & 0x0F);
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
        bx1: bx1, by1: by1, bd1: bd1, bx2: bx2, by2: by2, bz2: bz2, x1, y1, d1, x2, y2, d2, s,
        description: "splitParty({c1: {x:" + x1Desc + ", y:" + y1Desc + ", d:" + d1Desc + "}, c2: {x:" + x2Desc + ", y:" + y2Desc + ", d:" + d2Desc + "}, slowness:" + s + "});"
      };
    }

    if (op == 0x10) {
      let baseOffset = this.offset;
      let a = $r.readUByte();
      return {
        op: "JMPF", a: a,
        description: "goto " + (baseOffset + a) + ";"
      };
    }

    if (op == 0x12) {
      let baseOffset = this.offset - 1;
      let a = $r.readUByte();
      return {
        op: "JMPB", a: a,
        description: "goto " + (baseOffset - a) + ";"
      };
    }

    if (op == 0x14) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let a = $r.readUByte(), v = $r.readUByte(), c = $r.readUByte(), e = $r.readUByte();
      let aDesc = b1 == 0 ? a : "Bank[" + b1 + "][" + a + "]";
      let vDesc = b2 == 0 ? v : "Bank[" + b2 + "][" + v + "]";
      let cDesc = this.getCmpDesc(aDesc, c, vDesc);
      let baseOffset = this.offset - 1;
      return {
        op: "IFUB",
        b1: b1,
        b2: b2,
        a: a,
        v: v,
        c: c,
        e: e,
        description: "if (" + cDesc + ") (else goto " + (baseOffset + e) + ");"
      };
    }

    if (op == 0x16) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let a = $r.readUShort(), v = $r.readShort(), c = $r.readUByte(), e = $r.readUByte();
      let aDesc = b1 == 0 ? a : "Bank[" + b1 + "][" + a + "]";
      let vDesc = b2 == 0 ? v : "Bank[" + b2 + "][" + v + "]";
      let cDesc = this.getCmpDesc(aDesc, c, vDesc);
      let baseOffset = this.offset - 1;
      return {
        op: "IFSW",
        b1: b1,
        b2: b2,
        a: a,
        v: v,
        c: c,
        e: e,
        description: "if (" + cDesc + ") (else goto " + (baseOffset + e) + ");"
      };
    }

    if (op == 0x24) {
      let a = $r.readUShort();
      return {
        op: "WAIT", a: a,
        description: "wait({numFrames:" + a + "});"
      };
    }

    if (op == 0x25) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let bxb3 = $r.readUByte(),                          b3 = (bxb3 & 0x0F);
      let r = $r.readUByte(), g = $r.readUByte(), b = $r.readUByte();
      let s = $r.readUByte(), t = $r.readUByte(), unused = $r.readUByte();
      let rDesc = b1 == 0 ? r : "Bank[" + b1 + "][" + r + "]";
      let gDesc = b2 == 0 ? g : "Bank[" + b2 + "][" + g + "]";
      let bDesc = b3 == 0 ? b : "Bank[" + b3 + "][" + b + "]";
      return {
        op: "NFADE",
        b1: b1,
        b2: b2,
        r: r, g: g, b: b, s: s, t: t, unused: unused,
        description: "fadeScreen({r:" + rDesc + ", g:" + gDesc + ", b:" + bDesc + ", speed:" + s + ", type:" + t + "}); // unused=" + unused
      };
    }

    if (op == 0x28) {
      let l = $r.readUByte(), s = $r.readUByte();
      let vars = [];
      // TODO: figure out if l includes l and s; if so, need to change "l" to something like "l-2" below
      for (let i=0; i<l; i++) {
        vars.push($r.readUByte());
      }
      return {
        op: "KAWAI", l: l, s: s, vars: vars,
        description: "doCharacterGraphicsOp({length:" + l + ", kawaiOp:" + s + ", vars:" + vars + "});"
      };
    }

    if (op == 0x29) {
      return {
        op: "KAWIW",
        description: "waitForCharacterGraphicsOp();"
      };
    }

    // TODO: Compare with Makou Reactor; wiki page for this was blank, but it's a common op
    if (op == 0x2e) {
      let w = $r.readUByte();
      return {
        op: "WCLS", w: w,
        description: "closeWindow({windowId:" + w + "});"
      };
    }

    if (op == 0x2f) {
      let i = $r.readUByte(), x = $r.readUShort(), y = $r.readUShort(), w = $r.readUShort(), h = $r.readUShort();
      return {
        op: "WSIZW", i: i, x: x, y: y, w: w, h: h,
        description: "resizeWindow({windowId:" + i + ", x:" + x + ", y:" + y + ", width:" + w + ", height:" + h + "});"
      };
    }

    // TODO: Button IDs:
    // 1=assist, 8=start, 10=up, 20=right, 40=down, 80=left, 100=camera, 200=target, 400=pgup, 800=pgdown, 1000=menu, 2000=ok, 4000=cancel, 8000=switch
    if (op == 0x30) {
      let b = $r.readUShort();
      let a = $r.readUByte();
      return {
        op: "IFKEY", b: b, a: a,
        description: "if keyPressed({inputKeyBitField:" + b + ") (else goto " + (baseOffset + a) + ");"
      };
    }

    if (op == 0x31) {
      let b = $r.readUShort();
      let a = $r.readUByte();
      return {
        op: "IFKEYON", b: b, a: a,
        description: "if keyPressedJustPressed({inputKeyBitField:" + b + ") (else goto " + (baseOffset + a) + ");"
      };
    }

    if (op == 0x32) {
      let b = $r.readUShort();
      let a = $r.readUByte();
      return {
        op: "IFKEYOFF", b: b, a: a,
        description: "if keyPressedJustReleased({inputKeyBitField:" + b + ") (else goto " + (baseOffset + a) + ");"
      };
    }

    if (op == 0x33) {
      let s = $r.readUByte();
      let sDesc = s == 0 ? "M.Movable" : "M.Frozen";
      return {
        op: "UC", s: s,
        description: "setPlayableCharacterMovability(" + sDesc + ");"
      };
    }

    if (op == 0x35) {
      let p = $r.readUByte(), s = $r.readUByte(), a = $r.readUByte();
      return {
        op: "PTURA", p: p, s: s, a: a,
        description: "turnToPartyMember({partyId:" + p + ", slowness:" + s + ", directionA:" + a + "});"
      };
    }

    if (op == 0x40) {
      let n = $r.readUByte(), d = $r.readUByte();
      return {
        op: "MESSAGE", n: n, d: d,
        description: "showWindowWithDialog({window:" + n + ", dialog:" + d + "}); // " + this.dialogStrings[d]
      };
    }

    if (op == 0x43) {
      let dialogId = $r.readUByte();
      return {
        op: "MPNAM", dialogId: dialogId,
        description: "setMapName({dialog:" + dialogId + "});"
      };
    }

    if (op == 0x48) {
      // TODO: Menu Types and Event Types
      let ba = $r.readUByte(), w = $r.readUByte(), m = $r.readUByte(), f = $r.readUByte(), l = $r.readUByte(), a = $r.readUByte();
      let aDesc = ba == 0 ? a : "Bank[" + ba + "][" + a + "]";
      return {
        op: "ASK", ba: ba, w: w, m: m, f: f, l: l, a: a,
        description: aDesc + " = askQuestion({window:" + w + ", dialog:" + d + ", firstChoice:" + f + ", lastChoice:" + l + "});"
      };
    }

    if (op == 0x49) {
      // TODO: Menu Types and Event Types
      let b = $r.readUByte(), t = $r.readUByte(), p = $r.readUByte();
      let pDesc = b == 0 ? p : "Bank[" + b + "][" + p + "]";
      return {
        op: "MENU", b: b, t: t, p: p,
        description: "callMenu({type:" + t + ", param:" + p + "});"
      };
    }

    if (op == 0x4a) {
      let s = $r.readUByte();
      let sDesc = s == 0 ? "MM.Accessible" : "MM.Inaccessible";
      return {
        op: "MENU2", s: s,
        description: "setMainMenuAccessibility(" + sDesc + ")"
      };
    }

    if (op == 0x50) {
      let n = $r.readUByte(), x = $r.readUShort(), y = $r.readUShort(), w = $r.readUShort(), h = $r.readUShort();
      return {
        op: "WINDOW", n: n, x: x, y: y, w: w, h: h,
        description: "createWindow({window:" + n + ", x:" + x + ", y:" + y + ", width:" + w + ", height:" + h + "});"
      };
    }

    if (op == 0x51) {
      let w = $r.readUByte(), x = $r.readShort(), y = $r.readShort();
      return {
        op: "WMOVE", w: w, x: x, y: y,
        description: "setWindowPosition({windowId:" + w + ", x:" + x + ", y:" + y + "});"
      };
    }

    if (op == 0x52) {
      let w = $r.readUByte(), m = $r.readUByte(), p = $r.readUByte();
      let mDesc = m == 0 ? "WindowMode.Normal" : m == 1 ? "WindowMode.NoBackgroundNoBorder" : m == 2 ? "WindowMode.TransparentBackground" : "WindowMode.UNKNOWN_" + m;
      let pDesc = p == 0 ? "Closability.Closable" : p == 1 ? "Closability.NotClosable" : "Closability.UNKNOWN_" + p;
      return {
        op: "WMODE", w: w, m: m, p: p,
        description: "setWindowModes({windowId:" + w + ", mode:" + m + ", closability:" + p + "});"
      };
    }

    if (op == 0x53) {
      let w = $r.readUByte();
      return {
        op: "WREST", w: w,
        description: "resetWindow({windowId:" + w + "});"
      };
    }

    if (op == 0x54) {
      let w = $r.readUByte();
      return {
        op: "WCLSE", w: w,
        description: "closeWindow({windowId:" + w + "});"
      };
    }

    if (op == 0x55) {
      let w = $r.readUByte(), r = $r.readUByte();
      return {
        op: "WROW", w: w, r: r,
        description: "setWindowHeightByNumRows({windowId:" + w + ", numRows:" + r + "});"
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
        description: "addItem({item:" + tDesc + ", amount:" + aDesc + "});"
      };
    }

    if (op == 0x60) {
      let i = $r.readUShort(), x = $r.readShort(), y = $r.readShort(), z = $r.readShort(), d = $r.readUByte();
      return {
        op: "MAPJUMP", i: i, x: x, y: y, z: z, d: d,
        description: "mapJump({fieldId:" + i + ", x:" + x + ", y:" + y + ", z:" + z + ", direction:" + d + "});"
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
        description: "scroll({x:" + xDesc + ", y:" + yDesc + "});"
      };
    }

    if (op == 0x65) {
      return {
        op: "SCRCC",
        description: "scrollToCurrentPlayableCharacter();"
      };
    }

    if (op == 0x66) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let bxb3 = $r.readUByte(),                          b3 = (bxb3 & 0x0F);
      let x = $r.readShort(), y = $r.readShort(), s = $r.readUShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      let sDesc = b3 == 0 ? s : "Bank[" + b3 + "][" + s + "]";
      return {
        op: "SCR2DC", b1: b1, b2: b2, b3: b3, x: x, y: y, s: s,
        description: "scrollSmooth({x:" + xDesc + ", y:" + yDesc + ", speed:" + sDesc + "});"
      };
    }

    if (op == 0x6b) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let bxb3 = $r.readUByte(),                          b3 = (bxb3 & 0x0F);
      let r = $r.readUByte(), g = $r.readUByte(), b = $r.readUByte();
      let s = $r.readUByte(), t = $r.readUByte(), a = $r.readUByte();
      let rDesc = b1 == 0 ? r : "Bank[" + b1 + "][" + r + "]";
      let gDesc = b2 == 0 ? g : "Bank[" + b2 + "][" + g + "]";
      let bDesc = b3 == 0 ? b : "Bank[" + b3 + "][" + b + "]";
      return {
        op: "FADE",
        b1: b1,
        b2: b2,
        r: r, g: g, b: b, s: s, t: t, a: a,
        description: "fade({r:" + rDesc + ", g:" + gDesc + ", b:" + bDesc + ", speed:" + s + ", type:" + t + ", adjust:" + a + "});"
      };
    }

    if (op == 0x6c) {
      return {
        op: "FADEW",
        description: "waitForFade();"
      };
    }

    if (op == 0x6d) {
      let i = $r.readUShort(), s = $r.readUByte();
      let sFuncDesc = s == 0 ? "disableCollisionDetection" : "enableCollisionDetection";
      return {
        op: "IDLCK", i: i, s: s,
        description: sFuncDesc + "({triangleId:" + i + "});"
      };
    }

    if (op == 0x70) {
      let b = $r.readUByte(), n = $r.readUShort();
      let nDesc = b == 0 ? n : "Bank[" + b + "][" + n + "]";
      return {
        op: "BATTLE", b: b, n: n,
        description: "startBattle({battle:" + nDesc + "});"
      };
    }

    if (op == 0x71) {
      let s = $r.readUByte();
      let func = s == 0 ? "enableRandomEncounters" : "disableRandomEncounters";
      return {
        op: "BTLON",
        s: s,
        description: func + "();"
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
        description: "setBattleModeOptions(" + descriptions.join(", ") + ");"
      };
    }

    if (op == 0x7e) {
      let s = $r.readUByte();
      let funcDesc = s == 0 ? "interactibilityOne" : "interactibilityOff";
      return {
        op: "TLKON",
        s: s,
        description: funcDesc + "();"
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
        description: aDesc + " = " + vDesc + ";"
      };
    }

    if (op == 0x81) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let a = $r.readUByte(), v = $r.readShort();
      let aDesc = bd == 0 ? a : "Bank[" + bd + "][" + a + "]";
      let vDesc = bs == 0 ? v : "Bank[" + bs + "][" + v + "]";
      return {
        op: "SETWORD",
        bd: bd, bs: bs, a: a, v: v,
        description: aDesc + " = " + vDesc + ";"
      };
    }

    if (op == 0x82) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), bit = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      return {
        op: "BITON", // SETBIT seems better?
        bd: bd, bs: bs, d: d, bit: bit,
        description: "setBit({destination:" + dDesc + ", bit:" + bit + "});"
      };
    }

    if (op == 0x83) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), bit = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      return {
        op: "BITOFF", // UNSETBIT seems better?
        bd: bd, bs: bs, d: d, bit: bit,
        description: "unsetBit({destination:" + dDesc + ", bit:" + bit + "});"
      };
    }

    if (op == 0x84) {
      let bdbs = $r.readUByte(), bd = (bdbs & 0xF0) >> 4, bs = (bdbs & 0x0F);
      let d = $r.readUByte(), bit = $r.readUByte();
      let dDesc = bd == 0 ? d : "Bank[" + bd + "][" + d + "]";
      return {
        op: "BITXOR",
        bd: bd, bs: bs, d: d, bit: bit,
        description: "toggleBit({destination:" + dDesc + ", bit:" + bit + "});"
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
        description: dDesc + " = " + dDesc + " + " + sDesc + ";"
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
        description: dDesc + " = " + dDesc + " + " + sDesc + ";"
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
        description: dDesc + " = " + dDesc + " - " + sDesc + ";"
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
        description: dDesc + " = " + dDesc + " - " + sDesc + ";"
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
        description: dDesc + " = " + dDesc + " * " + sDesc + "; // TODO: cap at 255"
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
        description: dDesc + " = "  + dDesc + " * " + sDesc + ";"
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
        description: dDesc + " = Math.floor(" + dDesc + " / " + sDesc + ");"
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
        description: dDesc + " = Math.floor(" + dDesc + " / " + sDesc + ");"
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
        description: dDesc + " = " + dDesc + " % " + sDesc + ";"
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
        description: dDesc + " = " + dDesc + " % " + sDesc + ";"
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
        description: dDesc + " = " + dDesc + " & " + sDesc + ";"
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
        description: dDesc + " = " + dDesc + " & " + sDesc + ";"
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
        description: dDesc + " = " + dDesc + " | " + sDesc + ";"
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
        description: dDesc + " = " + dDesc + " | " + sDesc + ";"
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
        description: dDesc + " = " + dDesc + " ^ " + sDesc + ";"
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
        description: dDesc + " = " + dDesc + " ^ " + sDesc + ";"
      };
    }

    if (op == 0x95) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "INC",
        b: d, a: a,
        description: "increment8bit(" + aDesc + ");"
      };
    }

    if (op == 0x96) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "INC2",
        b: d, a: a,
        description: "increment16bit("+ aDesc + ");"
      };
    }

    if (op == 0x97) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "DEC",
        b: d, a: a,
        description: "decrement8bit(" + aDesc + ");"
      };
    }

    if (op == 0x98) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "DEC2",
        b: d, a: a,
        description: "decrement16bit("+ aDesc + ");"
      };
    }

    if (op == 0x99) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "RANDOM",
        b: d, a: a,
        description: "set8bit(" + aDesc + ", Math.floor(Math.random() * 256));"
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
        description: "set8bit(" + dDesc + ", get8bit(" + sDesc + "));"
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
        description: "set8bit(" + dDesc + ", getHighByte(" + sDesc + "));"
      };
    }

    if (op == 0x9c) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let bxb3 = $r.readUByte(),                          b3 = (bxb3 & 0x0F);
      let d = $r.readUByte(), l = $r.readUByte(), h = $r.readUByte();
      let dDesc = b1 == 0 ? d : "Bank[" + b1 + "][" + d + "]";
      let lDesc = b2 == 0 ? l : "Bank[" + b2 + "][" + l + "]";
      let hDesc = b3 == 0 ? h : "Bank[" + b3 + "][" + h + "]";
      return {
        op: "2BYTE",
        b1: b1, b2: b2, b3: b3, d: d, l: l, h: h,
        description: "setTwoBytes(" + dDesc + ", " + lDesc + ", " + hDesc + ");"
      };
    }

    if (op == 0xa0) {
      let c = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "PC", c: c,
        description: "thisIsAPlayableCharacter(" + cDesc + ");"
      };
    }

    if (op == 0xa1) {
      let n = $r.readUByte();
      return {
        op: "CHAR", n: n,
        description: "thisIsACharacterFieldModel(" + n + ");"
      };
    }

    if (op == 0xa2) {
      let a = $r.readUByte(), s = $r.readUByte();
      return {
        op: "DFANM", a: a, s: s,
        description: "playAnimationLoop({animation:" + a + ", slowness:" + s + "});"
      };
    }

    if (op == 0xa3) {
      let a = $r.readUByte(), s = $r.readUByte();
      return {
        op: "ANIME1", a: a, s: s,
        description: "playAnimationSync({animation:" + a + ", slowness:" + s + "});"
      };
    }

    if (op == 0xa4) {
      let s = $r.readUByte();
      let sDesc = s == 0 ? "V.NotVisible" : "V.Visible";
      return {
        op: "VISI", s: s,
        description: "setVisibilityMode(" + sDesc + ");"
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
        description: "placeObject({x:" + xDesc + ", y:" + yDesc + ", z:" + zDesc + ", walkmeshTriangle:" + iDesc + "});"
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
        description: "placeObject({x:" + xDesc + ", y:" + yDesc + ", walkmeshTriangle:" + iDesc + "});"
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
        description: "placeObject({x:" + xDesc + ", y:" + yDesc + ", z:" + zDesc + "});"
      };
    }

    if (op == 0xa8) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let x = $r.readShort(), y = $r.readShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      return {
        op: "MOVE", b1: b1, b2: b2, x, y,
        description: "walkObjectTo({x:" + xDesc + ", y:" + yDesc + "});" // using standard walk animation, found with animation ID 1 in the field object
      };
    }

    if (op == 0xa9) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let x = $r.readShort(), y = $r.readShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      return {
        op: "CMOVE", b1: b1, b2: b2, x, y,
        description: "moveObjectTo({x:" + xDesc + ", y:" + yDesc + "});" // using no animation
      };
    }

    if (op == 0xaa) {
      let e = $r.readUByte();
      return {
        op: "MOVA", e: e,
        description: "moveObjectToEntity({entityId:" + e + "});"
      };
    }

    if (op == 0xab) {
      let g = $r.readUByte(), d = $r.readUByte(), s = $r.readUByte();
      return {
        op: "TURA", g: g, d: d, s: s,
        description: "turnToEntity({groupId:" + g + ", direction:" + d + ", speed:" + s + "});"
      };
    }

    if (op == 0xac) {
      return {
        op: "ANIMW",
        description: "waitForLastAnimationToFinish();"
      };
    }

    if (op == 0xad) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let x = $r.readShort(), y = $r.readShort();
      let xDesc = b1 == 0 ? x : "Bank[" + b1 + "][" + x + "]";
      let yDesc = b2 == 0 ? y : "Bank[" + b2 + "][" + y + "]";
      return {
        op: "FMOVE", b1: b1, b2: b2, x, y,
        description: "moveFieldObjectTo({x:" + xDesc + ", y:" + yDesc + "});" // using no animation
      };
    }

    if (op == 0xae) {
      let a = $r.readUByte(), s = $r.readUByte();
      return {
        op: "ANIME1", a: a, s: s,
        description: "playAnimationAsync({animation:" + a + ", slowness:" + s + "});"
      };
    }

    if (op == 0xaf) {
      let a = $r.readUByte(), s = $r.readUByte();
      return {
        op: "ANIM!1", a: a, s: s,
        description: "playAnimationOnceAsync({animation:" + a + ", slowness:" + s + "});"
      };
    }

    if (op == 0xb0) {
      let a = $r.readUByte(), f = $r.readUByte(), l = $r.readUByte(), s = $r.readUByte();
      return {
        op: "CANIM1", a: a, f: f, l: l, s: s,
        description: "playPartialAnimation({animation:" + a + ", firstFrame:" + f + ", lastFrame:" + l + ", slowness:" + s + "});"
      };
    }

    if (op == 0xb1) {
      let a = $r.readUByte(), f = $r.readUByte(), l = $r.readUByte(), s = $r.readUByte();
      return {
        op: "CANM!1", a: a, f: f, l: l, s: s,
        description: "playPartialAnimation({animation:" + a + ", firstFrame:" + f + ", lastFrame:" + l + ", slowness:" + s + "});"
      };
    }

    if (op == 0xb2) {
      let b = $r.readUByte(), s = $r.readUShort();
      let sDesc = b == 0 ? s : "Bank[" + b + "][" + s + "]";
      return {
        op: "MSPED", b: b, d: s,
        description: "setMovementSpeed({speed:" + sDesc + "});"
      };
    }

    if (op == 0xb3) {
      let b = $r.readUByte(), d = $r.readUByte();
      let dDesc = b == 0 ? d : "Bank[" + b + "][" + d + "]";
      return {
        op: "DIR", b: b, d: d,
        description: "setFacingDirection({direction:" + dDesc + "});"
      };
    }

    if (op == 0xb4) {
      let b = $r.readUByte(), r = $r.readUByte(), d = $r.readUByte(), s = $r.readUByte(), t = $r.readUByte();
      let rDesc = b == 0 ? r : "Bank[" + b + "][" + r + "]";
      return {
        op: "TURNGEN", b: b, r: r, d: d, s: s, t: t,
        description: "rotateModel({rotation:" + rDesc + ", direction:" + d + ", steps:" + s + ", stepType:" + t + "});"
      };
    }

    if (op == 0xb5) {
      let b = $r.readUByte(), r = $r.readUByte(), ignored = $r.readShort(), s = $r.readShort(), t = $r.readUByte();
      let rDesc = b == 0 ? r : "Bank[" + b + "][" + r + "]";
      return {
        op: "TURN", b: b, r: r, d: d, s: s, t: t,
        description: "rotateModelDeprecatedSync({rotation:" + rDesc + ", direction:" + d + ", steps:" + s + ", stepType:" + t + "});"
      };
    }

    if (op == 0xb6) {
      let e = $r.readUByte();
      return {
        op: "DIRA", e: e,
        description: "setModelDirectionToFaceEntity({entityIndex:" + e + "});"
      };
    }

    if (op == 0xb7) {
      let ba = $r.readUByte(), e = $r.readUByte(), a = $r.readUByte();
      let aDesc = ba == 0 ? a : "Bank[" + ba + "][" + a + "]";
      return {
        op: "GETDIR", b: b, e: e, a: a,
        description: aDesc + " = getEntityDirection({entityIndex:" + e + "});"
      };
    }

    if (op == 0xb8) {
      let bxby = $r.readUByte(), bx = (bxby & 0xF0) >> 4, by = (bxby & 0x0F);
      let e = $r.readUByte(), x = $r.readUByte(), y = $r.readUByte();
      let xDesc = bx == 0 ? x : "Bank[" + bx + "][" + x + "]";
      let yDesc = by == 0 ? y : "Bank[" + by + "][" + y + "]";
      return {
        op: "GETAXY", bx: bx, by: by, e, x, y,
        description: xDesc + " = getEntityX({entityIndex:" + e + "}); " + yDesc + " = getEntityY({entityIndex:" + e + "})"
      };
    }

    if (op == 0xb9) {
      let b = $r.readUByte(), e = $r.readUByte(), a = $r.readUByte();
      return {
        op: "GETAI", b: b, e: e, a: a,
        description: "Bank[" + b + "][" + a + "] = getTriangleIdUnderEntity({entity:" + e + "});"
      };
    }

    if (op == 0xba) {
      let a = $r.readUByte(), s = $r.readUByte();
      return {
        op: "ANIM!2", a: a, s: s,
        description: "playAnimationHoldLastFrameSync({animation:" + a + ", slowness:" + s + "});"
      };
    }

    if (op == 0xbb) {
      let a = $r.readUByte(), f = $r.readUByte(), l = $r.readUByte(), s = $r.readUByte();
      return {
        op: "CANIM2", a: a, f: f, l: l, s: s,
        description: "playPartialAnimation({animation:" + a + ", firstFrame:" + f + ", lastFrame:" + l + ", slowness:" + s + "});"
      };
    }

    if (op == 0xbc) {
      let a = $r.readUByte(), f = $r.readUByte(), l = $r.readUByte(), s = $r.readUByte();
      return {
        op: "CANM!2", a: a, f: f, l: l, s: s,
        description: "playPartialAnimation({animation:" + a + ", firstFrame:" + f + ", lastFrame:" + l + ", slowness:" + s + "});"
      };
    }

    if (op == 0xbd) {
      let b = $r.readUByte(), s = $r.readUByte();
      let sDesc = b == 0 ? s : "Bank[" + b + "][" + s + "]";
      return {
        op: "ASPED", b: b, s: s,
        description: "setAnimationSpeed({speed:" + sDesc + "});"
      };
    }

    if (op == 0xbf) {
      let e = $r.readUByte();
      return {
        op: "CC", e: e,
        description: "setControllableCharacter({entity:" + e + "});"
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
        description: "makeObjectJump({x:" + xDesc + ", y:" + yDesc + ", triangleId:" + iDesc + ", height:" + hDesc + "});"
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
        description: "climbLadder({x:" + xDesc + ", y:" + yDesc + ", z:" + zDesc + ", triangleId:" + iDesc +
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
        description: "transposeObjectDisplayOnly({x:" + xDesc + ", y:" + yDesc + ", z:" + zDesc + ", speed:" + sDesc + "});"
      };
    }

    if (op == 0xc4) {
      return {
        op: "OFST",
        description: "waitForTransposeObjectDisplayOnly();"
      };
    }

    if (op == 0xc5) {
      let b = $r.readUByte(), r = $r.readUByte();
      let rDesc = b == 0 ? r : "Bank[" + b + "][" + r + "]";
      return {
        op: "TALKR", b: b, r: r,
        description: "setInteractibilityRadius({radius:" + r + "});"
      };
    }

    if (op == 0xc6) {
      let b = $r.readUByte(), r = $r.readUByte();
      let rDesc = b == 0 ? r : "Bank[" + b + "][" + r + "]";
      return {
        op: "SLIDR", b: b, r: r,
        description: "setCollisionRadius({radius:" + r + "});"
      };
    }

    if (op == 0xc7) {
      let s = $r.readUByte();
      let sDesc = s == 0 ? "S.Solid" : "S.NonSolid";
      return {
        op: "SOLID", s: s,
        description: "setSolidMode(" + sDesc + ");"
      };
    }

    if (op == 0xc8) {
      let c = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "PRTYP", c: c,
        description: "addToParty(" + cDesc + ");"
      };
    }

    if (op == 0xc9) {
      let c = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "PRTYM", c: c,
        description: "removeFromParty(" + cDesc + ");"
      };
    }

    if (op == 0xca) {
      let c1 = $r.readUByte(), c2 = $r.readUByte(), c3 = $r.readUByte();
      let c1Desc = this.getCharacterDesc(c1);
      let c2Desc = this.getCharacterDesc(c2);
      let c3Desc = this.getCharacterDesc(c3);
      return {
        op: "PRTYE", c1: c1, c2: c2, c3: c3,
        description: "changePartyTo([" + c1Desc + ", " + c2Desc + ", " + c3Desc + "]);"
      };
    }

    if (op == 0xcb) {
      let c = $r.readUByte(), a = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      let baseOffset = this.offset - 1;
      return {
        op: "IFPRTYQ", c: c, a: a,
        description: "if (isCharacterInParty(" + cDesc + ") (else goto " + (baseOffset + a) + ");"
      };
    }

    if (op == 0xcc) {
      let c = $r.readUByte(), a = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      let baseOffset = this.offset - 1;
      return {
        op: "IFMEMBQ", c: c, a: a,
        description: "if (isCharacterAvailable(" + cDesc + ") (else goto " + (baseOffset + a) + ");"
      };
    }

    if (op == 0xcd) {
      let s = $r.readUByte(), c = $r.readUByte();
      let sFuncDesc = s == 0 ? "makeCharacterUnavailable" : "makeCharacterAvailable";
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "MMBud", s: s, c: c,
        description: sFuncDesc + "(" + cDesc + ");"
      };
    }

    if (op == 0xce) {
      let c = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "MMBLK", c: c,
        description: "lockPartyMember(" + cDesc + ");"
      };
    }

    if (op == 0xcf) {
      let c = $r.readUByte();
      let cDesc = this.getCharacterDesc(c);
      return {
        op: "MMBUK", c: c,
        description: "unlockPartyMember(" + cDesc + ");"
      };
    }

    if (op == 0xd0) {
      let x1 = $r.readShort(), y1 = $r.readShort(), z1 = $r.readShort();
      let x2 = $r.readShort(), y2 = $r.readShort(), z2 = $r.readShort();
      return {
        op: "LINE", x1: x1, y1: y1, z1: z1, x2: x2, y2: y2, z2: z2,
        description: "createLineTrigger({x1:" + x1 + ", y1:" + y1 + ", z1:" + z1 + ", x2:" + x2 + ", y2:" + y2 + ", z2:" + z2 + "});"
      };
    }

    if (op == 0xd1) {
      let s = $r.readUByte();
      let funcDesc = s == 0 ? "disableAllLineTriggers" : "enableAllLineTriggers";
      return {
        op: "LINON",
        s: s,
        description: funcDesc + "();"
      };
    }

    if (op == 0xd2) {
      let s = $r.readUByte();
      let funcDesc = s == 0 ? "enableAllGatewayTriggers" : "disableAllGatewayTriggers";
      return {
        op: "MPJPO",
        s: s,
        description: funcDesc + "();"
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
        op: "SLINE", bx: bx, by: by, e, x, y,
        description: "setLine({v1: {x:" + x1Desc + ", y:" + y1Desc + ", z:" + z1Desc + "}, v2: {x:" + x2Desc + ", y:" + y2Desc + ", z:" + z2Desc + "}});"
      };
    }

    if (op == 0xd6) {
      let b = $r.readUByte(), r = $r.readUShort();
      let rDesc = b == 0 ? r : "Bank[" + b + "][" + r + "]";
      return {
        op: "TALKR2", b: b, r: r,
        description: "setInteractibilityRadius({radius:" + r + "});"
      };
    }

    if (op == 0xd7) {
      let b = $r.readUByte(), r = $r.readUShort();
      let rDesc = b == 0 ? r : "Bank[" + b + "][" + r + "]";
      return {
        op: "SLIDR2", b: b, r: r,
        description: "setCollisionRadius({radius:" + r + "});"
      };
    }

    if (op == 0xd8) {
      let i = $r.readUShort();
      return {
        op: "PMJMP", i: i,
        description: "setFieldJumpId({fieldId:" + i + "});"
      };
    }

    if (op == 0xda) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let bxb5 = $r.readUByte(),                          b5 = (bxb5 & 0x0F);
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
        description: "musicOp_da_" + stringUtil.toHex2(akaoOp) + "({p1:" + p1Desc + ", p2:" + p2Desc + ", p3:" + p3Desc + ", p4:" + p4Desc + ", p5:" + p5Desc + "});"
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
        description: "backgroundOn({area:" + aDesc + ", layer:" + l + "});"
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
        description: "backgroundOff({area:" + aDesc + ", layer:" + l + "});"
      };
    }

    if (op == 0xe4) {
      let b = $r.readUByte(), a = $r.readUByte();
      let aDesc = b == 0 ? a : "Bank[" + b + "][" + a + "]";
      return {
        op: "BGCLR", b: b, a: a,
        description: "clearBackground({area:" + aDesc + "});"
      };
    }

    if (op == 0xf0) {
      let id = $r.readUByte();
      return {
        op: "MUSIC", id: id,
        description: "playMusic({song:" + id + "});"
      };
    }

    if (op == 0xf1) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let i = $r.readUShort(), d = $r.readUByte();
      let iDesc = b1 == 0 ? i : "Bank[" + b1 + "][" + i + "]";
      let dDesc = b2 == 0 ? d : "Bank[" + b2 + "][" + d + "]";
      return {
        op: "SOUND", b1: b1, b2: b2, i: i, d: d,
        description: "playSound({sound:" + iDesc + ", direction:" + dDesc + "});"
      };
    }

    if (op == 0xf2) {
      let b1b2 = $r.readUByte(), b1 = (b1b2 & 0xF0) >> 4, b2 = (b1b2 & 0x0F);
      let b3b4 = $r.readUByte(), b3 = (b3b4 & 0xF0) >> 4, b4 = (b3b4 & 0x0F);
      let bxb5 = $r.readUByte(),                          b5 = (bxb5 & 0x0F);
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
        description: "musicOp_F2_" + stringUtil.toHex2(akaoOp) + "({p1:" + p1Desc + ", p2:" + p2Desc + ", p3:" + p3Desc + ", p4:" + p4Desc + ", p5:" + p5Desc + "});"
      };
    }

    if (op == 0xf5) {
      let s = $r.readUByte();
      let sDesc = s == 0 ? "M.NotLocked" : "M.Locked";
      return {
        op: "MULCK", s: s,
        description: "setMusicLockMode(" + sDesc + ");"
      };
    }

    if (op == 0xf6) {
      let id = $r.readUByte();
      return {
        op: "BMUSC", id: id,
        description: "setBattleMusic({song:" + id + "});"
      };
    }

    if (op == 0xf8) {
      let m = $r.readUByte();
      return {
        op: "PMVIE", m: m,
        description: "setCurrentMovie({movie:" + m + "});"
      };
    }

    if (op == 0xf9) {
      return {
        op: "MOVIE",
        description: "playMovie();"
      };
    }

    if (op == 0xfa) {
      let b = $r.readUByte(), a = $r.readUByte();
      return {
        op: "MVIEF", b: b, a: a,
        description: "Bank[" + b + "][" + a + "] = getCurrentMovieFrame();"
      };
    }

    if (op == 0xfb) {
      let s = $r.readUByte();
      let sFuncDesc = s == 0 ? "useMovieCamera" : "stopUsingMovieCamera";
      return {
        op: "MVCAM", s: s,
        description: sFuncDesc + "();"
      };
    }

    if (op == 0xfc) {
      let p = $r.readUByte();
      return {
        op: "FMUSC", p: p,
        description: "musicF({p:" + p + "});"
      };
    }

    // definitely want to throw Error here to prevent attempts to translate subsequent opcodes, which will be invalid/out-of-sync
    console.error("unsupported opCode: 0x" + stringUtil.toHex2(op));
    throw new Error("unsupported opCode: 0x" + stringUtil.toHex2(op));

  }; // end of readOp()

  printNextBufferDataAsHex() {
    console.log();
    let pad5 = stringUtil.pad5, toHex2 = stringUtil.toHex2;
    let hex = "";
    for (let i=0; i<60; i++) {
      hex = pad5(this.offset) + " + " + pad5(i*10) + " = " + pad5(this.offset + i*10) + " : ";
      for (let j=0; j<10; j++) {
        let pos = this.offset + i*10 + j;
        if (pos >= this.buffer.length) {
          hex = hex + "EOF";
        } else {
          let c = this.buffer[pos];
          hex = hex + toHex2(c) + " ";
        }
      }
      hex = hex + "    ";
      for (let j=0; j<10; j++) {
        let pos = this.offset + i*10 + j;
        if (pos >= this.buffer.length) {
          hex = hex + "";
        } else {
          let c = this.buffer[pos];
          hex = hex + (c >= 0x20 && c <= 127 ? String.fromCharCode(c) : ".");
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
