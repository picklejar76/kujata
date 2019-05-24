#
# ff7.world - Final Fantasy VII world event script handling
#
# Copyright (C) 2014 Christian Bauer <www.cebix.net>
#
# Permission to use, copy, modify, and/or distribute this software for any
# purpose with or without fee is hereby granted, provided that the above
# copyright notice and this permission notice appear in all copies.
#

import struct

import lzss


def _enum(**enums):
    return type('Enum', (), enums)


# Some selected opcodes
Op = _enum(
    CLEAR = 0x100,
    PUSHI = 0x110,
    JUMP = 0x200,
    JUMPZ = 0x201,
    WINDOW = 0x324,
    MES = 0x325,
    ASK = 0x326
)

callTableSizeBytes = 0x400
callTableSize16Bit = 0x200

# Find the size (number of 16-bit values) of the given instruction.
def instructionSize(op):
    if op > 0x100 and op < 0x200:  # push
        return 2
    elif op in [Op.JUMP, Op.JUMPZ]:  # jump
        return 2
    #elif op == 0x0e0:  # WriteToBank
    #    return 2
    else:
        return 1

# World map file
class WorldMap:

    # Parse the map from an open file object.
    def __init__(self, fileobj):

        # Read the file data
        cmpData = fileobj.read()

        # Decompress the file
        ### lines changed below, as commented by ###, by picklejar, to use PC version instead of PSX
        ### compressedSize = struct.unpack_from("<L", cmpData)[0]
        ### self.data = bytearray(lzss.decompress(cmpData[4:4 + compressedSize]))
        self.data = bytearray(cmpData)

        # Find the script section
        offset = 0 ### struct.unpack_from("<L", self.data, 0x14)[0]
        size = 0x7000 / 2 ### struct.unpack_from("<L", self.data, 0x18)[0] - offset

        ### self.scriptStart = offset + 4
        ### self.scriptEnd = self.scriptStart + size
        self.scriptStart = offset
        self.scriptEnd = self.scriptStart + size

    # Return the script code as a list of 16-bit values.
    def getScript(self):
        script = []

        # First, read the call table
        offset = self.scriptStart
        while offset < self.scriptStart + callTableSizeBytes:
            op = struct.unpack_from("<H", self.data, offset)[0]
            offset += 2
            script.append(op)

        # Convert code after the entry table until we find a
        # null opcode or reach the end of the data
        offset = self.scriptStart + callTableSizeBytes
        while offset < self.scriptEnd:
            op = struct.unpack_from("<H", self.data, offset)[0]
            offset += 2

            if op == 0:
                break

            script.append(op)

            for i in xrange(instructionSize(op) - 1):
                script.append(struct.unpack_from("<H", self.data, offset)[0])
                offset += 2

        return script

    # Insert script code back into the data.
    def setScript(self, script):
        offset = self.scriptStart + callTableSizeBytes
        for w in script:
            struct.pack_into("<H", self.data, offset, w)
            offset += 2

    # Write the map to a file object, truncating the file.
    def writeToFile(self, fileobj):

        # Compress the map data
        cmpData = lzss.compress(str(self.data))

        # Write to file
        fileobj.seek(0)
        fileobj.truncate()
        fileobj.write(struct.pack("<L", len(cmpData)))
        fileobj.write(cmpData)


# Map opcodes to mnemonics
opcodes = {
    0x015: "PUSH -POP1",
    0x017: "PUSH !POP1",
    0x018: "PUSH ActiveEntity.GetDistanceToPoint(POP1)",
    0x019: "PUSH ActiveEntity.GetDistanceToModel(POP1)",
    0x01b: "PUSH Op01b_UsingAtbTable(POP1)",
    0x030: "PUSH POP2 * POP1",
    0x040: "PUSH POP2 + POP1",
    0x041: "PUSH POP2 - POP1",
    0x050: "PUSH POP2 << POP1",
    0x051: "PUSH POP2 >> POP1",
    0x060: "PUSH POP2 < POP1",
    0x061: "PUSH POP2 > POP1",
    0x062: "PUSH POP2 <= POP1",
    0x063: "PUSH POP2 >= POP1",
    0x070: "PUSH POP2 == POP1",
    0x071: "PUSH POP2 != POP1",
    0x080: "PUSH POP2 & POP1",
    0x0a0: "PUSH POP2 | POP1",
    0x0b0: "PUSH POP2 && POP1",
    0x0c0: "PUSH POP2 || POP1",
    0x0e0: "WriteToBank_I_(POP2, POP1)",
    0x100: "CLEAR",
    0x110: "PUSH #[I]",
    0x114: "PUSH GetBitFromBank0(BitIndex=[I])",
    0x115: "PUSH GetBitFromBank1(BitIndex=[I])",
    0x116: "PUSH GetBitFromBank2(BitIndex=[I])",
    0x117: "PUSH SpecialA(Type=[I])",
    0x118: "PUSH Bank0[I]",
    0x119: "PUSH Bank1[I]",
    0x11a: "PUSH Bank2[I]",
    0x11b: "PUSH SpecialB(Type=[I])",
    0x11c: "PUSH GetWordFromBank0(Addr=[I])",
    0x11d: "PUSH GetWordFromBank1(Addr=[I])",
    0x11e: "PUSH GetWordFromBank2(Addr=[I])",
    0x11f: "PUSH SpecialC(Type=[I])",
    0x200: "JUMP [I]",
    0x201: "JUMPZ(POP1) [I]",
    0x203: "RETURN",
    0x204: "CALL Model[POP1].Function([O])",
    0x300: "LoadAndInitModel(POP1)",
    0x302: "SetCurrentEntityAsPlayerEntity()",
    0x303: "ActiveEntity.SetMoveSpeed(POP1)",
    0x304: "ActiveEntity.SetDirectionAndFacing(POP1)",
    0x305: "SetNumWaitFrames(POP1)",
    0x306: "Wait()",
    0x307: "SetControlsEnabled(POP1)",
    0x308: "ActiveEntity.SetMeshCoordsXZ(POP2, POP1)",
    0x309: "ActiveEntity.SetCoordsInMeshXZ(POP2, POP1)",
    0x30a: "Op30a(POP1)",
    0x30b: "ActiveEntity.SetYOffset(POP1)",
    0x30c: "EnterVehicle()",
    0x30d: "Op30d()",
    0x30e: "ActiveEntity.PlayAnimation(POP2, POP1)",
    0x310: "SetActivePoint(POP2, POP1)",
    0x311: "SetPointMeshCoordsXZ(POP2, POP1)",
    0x312: "SetPointCoordsInMeshXZ(POP2, POP1)",
    0x313: "SetPointTerrainBGR(POP3, POP2, POP1)",
    0x314: "SetPointDropoffParams(POP2, POP1)",
    0x315: "SetPointSkyBGR(POP3, POP2, POP1)",
    0x316: "SetPointOtherBGR(POP3, POP2, POP1)",
    0x317: "TriggerBattle(SceneId=POP1)",
    0x318: "EnterFieldScene(POP2, POP1)",
    0x319: "Op319(POP1)",
    0x31b: "NoOp()",
    0x31c: "Op31c(POP1)",
    0x31d: "PlaySoundEffect(POP1)",
    0x31f: "Op31f(POP1)",
    0x320: "Op320()",
    0x321: "Op321(POP1)",
    0x324: "SetWindowDimensions(POP4, POP3, POP2, POP1)",
    0x325: "SetWindowMessage(POP1)",
    0x326: "SetWindowPrompt(POP3, POP2, POP1)",
    0x327: "WaitForPromptAcknowledge()",
    0x328: "SetActiveEntityDirection(POP1)",
    0x329: "Op329(POP1)",
    0x32a: "Op32a(POP1)",
    0x32b: "SetRandomEncountersEnabled(POP1)",
    0x32c: "SetWindowParams(POP2, POP1)",
    0x32d: "WaitForWindowReady()",
    0x32e: "WaitForMessageAcknowledge()",
    0x32f: "Op32f(POP1)",
    0x330: "SetActiveEntity(POP1)",
    0x331: "Op331()",
    0x332: "Op332()",
    0x333: "Op333(POP2, POP1)",
    0x334: "Op334()",
    0x336: "ActiveEntity.SetMoveSpeedHonoringWalkmesh(Speed=POP1)",
    0x339: "Op339()",
    0x33a: "Op33a(POP1)",
    0x33b: "FadeOut(POP2, POP1)",
    0x33c: "SetFieldEntryPoint()",
    0x33d: "SetFieldEntryPointFromFieldTblId(POP1)",
    0x33e: "SendSoundCommand(POP1)",
    0x347: "ActiveEntity.MoveToModel(POP1)",
    0x348: "FadeIn(POP2, POP1)",
    0x349: "WorldProgress=POP1",
    0x34a: "Op34a(POP1)",
    0x34b: "SetChocoboType(POP1)",
    0x34c: "SetSubmarineType(POP1)",
    0x34d: "Op3fd(POP3, POP2, POP1)",
    0x34e: "Op3fe(POP1)",
    0x34f: "SetActiveEntityYPos(POP1)",
    0x350: "SetMeteorTextureEnabled(POP1)",
    0x351: "SetMusicVolume(POP1)",
    0x352: "SetCameraShakingEnabled(POP1)",
    0x353: "Op353()",
    0x354: "Op354(POP1)",
    0x355: "Op355(POP1)"
}

# Disassemble script code.
def disassemble(script):

    s = "Addr\tOpCode\tOpCode2\tOp\n"

    i = 0
    while i < callTableSize16Bit:
        s += "%04x\t" % i
        functionId = script[i]
        i += 1
        addr = script[i]
        i += 1
        s += "%04x\t" % functionId
        s += "%04x\t" % addr
        functionType = functionId >> 14            # 11000000 00000000
        if functionType == 0x0:
            functionNumber = functionId & 0x00ff   # 00000000 11111111
            s += "SYSFUNC(%04x, %04x)" % (functionNumber, addr)
        elif functionType == 0x1:
            functionNumber = functionId & 0x00ff   # 00000000 11111111
            modelId = (functionId & 0x3f00) >> 8   # 00111111 00000000
            s += "MODELFUNC(%04x, %04x, %04x)" % (modelId, functionNumber, addr)
        elif functionType == 0x2:
            walkmeshType = functionId & 0x000f     # 00000000 00001111
            meshIndex = (functionId & 0x3ff0) >> 4 # 00111111 11110000
            s += "WALKMESHFUNC(%04x, %04x, %04x)" % (walkmeshType, meshIndex, addr)

        s += "\n"

    while i < len(script):
        relativeAddress = i - callTableSize16Bit
        s += "%04x\t" % relativeAddress

        op = script[i]
        s += "%04x\t" % op

        i += 1
        if instructionSize(op) == 2:
            s += "%04x\t" % script[i]
        else:
            s += "\t"

        if op == Op.PUSHI:
            s += "PUSH #%04x" % script[i]
            i += 1
        elif op == 0x0e0:
            s += "WRITE BANK POP2 = POP1" # will end up looking like Bank0[xxxx] = yyyy
            #i += 1
        elif op in [0x114, 0x115, 0x116]:
            bit = script[i] & 0x0007
            addr = script[i] >> 3
            s += "PUSH Bank%d[%04x].Bit(%d)" % (op & 3, addr, bit)
            i += 1
        elif op in [0x118, 0x119, 0x11a]:
            s += "PUSH Bank%d[%04x]" % (op & 3, script[i])
            i += 1
        elif op in [0x11c, 0x11d, 0x11e]:
            s += "PUSH Bank%d_16bit[%04x]" % (op & 3, script[i])
            i += 1
        elif op > 0x100 and op < 0x200 and op & 3 == 3:
            s += "PUSH GetSpecial(%04x)" % script[i]
            i += 1
        elif op == Op.JUMP:
            s += "JUMP %04x" % script[i]
            i += 1
        elif op == Op.JUMPZ:
            s += "JUMPZ(POP1) %04x" % script[i]
            i += 1
        elif op > 0x203 and op < 0x300:
            s += "CALL Model(POP1).Function(%04x)" % (op - 0x204)
        else:
            try:
                s += opcodes[op]
            except KeyError:
                s += "<%04x>" % op

        s += "\n"

    return s
