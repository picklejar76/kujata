#
# world2.py - Step 2 of disassembling FF7 worldmap script
#

#import struct
#import lzss
import re

class IfBlock():
    def __init__(self, mode, nextElseAddr, endAddr):
        self.mode = mode
        self.nextElseAddr = nextElseAddr
        self.endAddr = endAddr

# Find the size (number of 16-bit values) of the given instruction.
def instructionSize(op):
    if op > 0x100 and op < 0x200:  # push
        return 2
    elif op in [Op.JUMP, Op.JUMPZ]:  # jump
        return 2
    else:
        return 1

# Whether this op could cause a jump in code (JUMP, CALL, RETURN)
def isBranchOp(opCode):
    if opCode >= 0x200 and opCode < 0x300:  # 0x200=JUMP, 0x201=JUMPZ, 0x203=RETURN, 0x204=CallFunc1, 0x205=CallFunc2, ... 
        return True
    else:
        return False

# Whether this op should be wrapped in parentheses
def isUnaryOpAndShouldWrap(opCode):
    if opCode == 0x015 or opCode == 0x017:  # negate, not
        return True
    return False

# Whether this op should be wrapped in parentheses
def isBinaryOpAndShouldWrap(opCode):
    if opCode >= 0x030 and opCode <= 0x0c0:  # add, substract, multiply, ...; and, or, not, ...
        return True
    return False

def printStack(stack, fout):
    stack0 = stack[0] if len(stack)>0 else ""
    stack1 = stack[1] if len(stack)>1 else ""
    stack2 = stack[2] if len(stack)>2 else ""
    stack3 = stack[3] if len(stack)>3 else ""
    s = "STACK: [%s] [%s] [%s] [%s]\n" % (stack0, stack1, stack2, stack3)
    #fout.write(s)

def htmlEscape(s):
    s = s.replace("&", "&amp;")
    s = s.replace("<", "&lt;")
    s = s.replace(">", "&gt;")
    s = s.replace("{MSG}", "<span class='msg'>")
    s = s.replace("{/MSG}", "</span>")
    return s

# Map chocobo type codes to friendly var names
chocoboTypes = {
    "#0000": "$YellowChocobo",
    "#0001": "$GreenChocobo",
    "#0002": "$BlueChocobo",
    "#0003": "$BlackChocobo",
    "#0004": "$GoldChocobo"
}

# Map submarine type codes to friendly var names
submarineTypes = {
    "#0000": "$RedSubmarine",
    "#0001": "$BlueSubmarine"
}

sysFunctionIdNames = {
    "0000": "$OnWorldMapLoad",
    "0001": "$OnWorldMapUnload",
    "0002": "$OnFrameTick",
    "0006": "$OnEnterHighwind",
    "0007": "$OnTouchMidgarZolom",
    "0007": "$OnDismountChocobo",
    "000f": "$OnEnterDesert",
    "0010": "$OnBuggyBreakdown1",
    "0011": "$OnBuggyBreakdown2",
    "0012": "$OnBuggyBreakdown?"
}
def getSysFunctionIdName(funcIdHex):
    return sysFunctionIdNames.get(funcIdHex, "$UnknownFunc" + str(int(funcIdHex, 16)))

modelFunctionIdNames = {
    "0000": "$OnModelLoad",
    "0001": "$OnModelUnload",
    "0002": "$OnFrameTick",
    "0003": "$OnMovement",
    "000f": "$OnEnterDesert"
}
def getModelFunctionIdName(funcIdHex):
    return modelFunctionIdNames.get(funcIdHex, "$UnknownFunc" + str(int(funcIdHex, 16)))

modelIdNames = {
    "0000": "$CloudModel",
    "0001": "$TifaModel",
    "0002": "$CidModel",
    "0003": "$UltimateWeaponModel",
    "000b": "$HighwindModel",
    "000d": "$SubmarineModel",
    "0013": "$ChocoboModel",
    "ffff": "$SystemModelInActiveEntityContext",
}
def getModelIdName(funcIdHex):
    return modelIdNames.get(funcIdHex, "$UnknownModel" + str(int(funcIdHex, 16)))

specialVarNames = {
    "0000": "$ActiveEntityMeshXCoor",
    "0001": "$ActiveEntityMeshZCoor",
    "0002": "$ActiveEntityXCoorInMesh",
    "0003": "$ActiveEntityZCoorInMesh",
    "0004": "$ActiveEntityDirection",
    "0008": "$FirstEntityModelId",
    "0009": "$ActiveEntityModelId",
    "000a": "$WildChocoboType",
    "000b": "$BattleResult",
    "000d": "$PromptWindowResult"
}
def getSpecialVarName(idHex):
    return specialVarNames.get(idHex, "$UnknownSpecialVar" + str(int(idHex, 16)))


def getMessages():
    messages = {}
    fin = open('./messages.txt', 'r') # this was generated from worldmsginfo.py by picklejar for PC version
    lines = fin.readlines()
    fin.close()
    for line in lines:
        line = line.rstrip('\r\n')
        (msgId, msg) = line.split('\t')
        msgId = "#00" + msgId
        messages[msgId] = msg
    return messages

def decodeWorldMapAssembly(worldMapName, messages):
    fin = open('./output_pc/' + worldMapName + '.tsv', 'r')
    lines = fin.readlines()
    fin.close()

    fout = open('./output_pc/' + worldMapName + '.html', 'w')

    del lines[0]
    lineNumber = 0
    stack = []
    ifBlockStack = []
    #ifBlockStack.append(IfBlock(-1, -1, -1))

    fout.write("<html>\n")
    fout.write("<head>\n")
    fout.write("<script src='https://ajax.googleapis.com/ajax/libs/jquery/1.4.3/jquery.min.js'></script>\n")
    fout.write("<style>table {white-space:pre; font-family:monospace; font-size:12pt;} .hdr{font-weight:bold; background-color:#eee;} .ass {display:none} .adr {color: #4d4} .op {color: #f44} .op2 {color: #f44} .asm1 {color: #f44} .asm2 {color: #44d} .msg { background-color: #ddf }</style>\n")
    fout.write("</head>\n")
    fout.write("<body>\n")
    fout.write("<p><input type='button' value='Show Assembly' onclick=\"$('.ass').show()\"></input></p>")
    fout.write("<h1>World Map Script: " + worldMapName + "</h1>\n")
    
    fout.write("<h2>User Friendly Variables</h2>\n")
    fout.write("<h3>System Function ID Names</h3>\n")
    fout.write("<ul>")
    for value in sorted(sysFunctionIdNames):
        fout.write("<li>" + sysFunctionIdNames[value] + " = " + value + "</li>\n")
    fout.write("</ul>\n")
    fout.write("<h3>Model Function ID Names</h3>\n")
    fout.write("<ul>")
    for value in sorted(modelFunctionIdNames):
        fout.write("<li>" + modelFunctionIdNames[value] + " = " + value + "</li>\n")
    fout.write("</ul>\n")
    fout.write("<h3>Model/Entity ID Names</h3>\n")
    fout.write("<ul>")
    for value in sorted(modelIdNames):
        fout.write("<li>" + modelIdNames[value] + " = " + value + "</li>\n")
    fout.write("</ul>\n")
    fout.write("<h3>Chocobo Types</h3>\n")
    fout.write("<ul>")
    for value in sorted(chocoboTypes):
        fout.write("<li>" + chocoboTypes[value] + " = " + value + "</li>\n")
    fout.write("</ul>\n")
    fout.write("<h3>Submarine Types</h3>\n")
    fout.write("<ul>")
    for value in sorted(submarineTypes):
        fout.write("<li>" + submarineTypes[value] + " = " + value + "</li>\n")
    fout.write("</ul>\n")
    fout.write("<h3>Special Var Names</h3>\n")
    fout.write("<ul>")
    for value in sorted(specialVarNames):
        fout.write("<li>" + specialVarNames[value] + " = " + value + "</li>\n")
    fout.write("</ul>\n")

    lastOp = ""

    callTable = {}
    numFunctionsProcessed = 0
    
    fout.write("<h2>Call Table</h2>\n")
    fout.write("<table>\n")
    fout.write("<tr class='hdr'><td style='width:40px'>Addr</td><td class='ass' style='width:40px'>FuncId</td><td class='ass' style='width:40px'>Addr</td><td class='ass' style='width:400px'>Assembly</td><td style='width:500px'>Code</td></tr>\n")
    for line in lines[0:0x100]:
        line = line.rstrip('\r\n')
        if (len(line) == 0):
            continue
        tokens = line.split("\t")
        
        opAddrString = tokens[0]
        opCodeString = tokens[1]
        opCode2String = tokens[2]
        op = tokens[3]
        opAddr = int(opAddrString, 16)
        opCode = int(opCodeString, 16)
        opCode2 = int(opCode2String, 16) if opCode2String != "" else -1
        newOp = op
        functionName = ""
        
        
        if "SYSFUNC" in op:
            m = re.search("SYSFUNC\\((.*?), (.*?)\\)", op)
            funcIdHex = m.group(1)
            funcAddr = m.group(2)
            funcId = int(funcIdHex, 16)
            funcIdName = getSysFunctionIdName(funcIdHex)
            functionName = "System.Function(" + funcIdName + ")" # str(funcId)
            #newOp = functionName + " { CALL 0x" + funcAddr + " }"
        elif "MODELFUNC" in op:
            m = re.search("MODELFUNC\\((.*?), (.*?), (.*?)\\)", op)
            modelIdHex = m.group(1)
            funcIdHex = m.group(2)
            funcAddr = m.group(3)
            modelId = int(modelIdHex, 16)
            funcId = int(funcIdHex, 16)
            funcIdName = getModelFunctionIdName(funcIdHex)
            modelIdName = getModelIdName(modelIdHex)
            functionName = "Model(" + modelIdName + ").Function(" + funcIdName + ")"
            #newOp = functionName + " { CALL 0x" + funcAddr + " }"
        elif "WALKMESHFUNC" in op:
            m = re.search("WALKMESHFUNC\\((.*?), (.*?), (.*?)\\)", op)
            walkmeshTypeHex = m.group(1)
            meshIndexHex = m.group(2)
            funcAddr = m.group(3)
            walkmeshType = int(walkmeshTypeHex, 16)
            meshIndex = int(meshIndexHex, 16)
            meshZ = meshIndex % 36
            meshX = meshIndex / 36
            functionName = "Walkmesh(" + str(meshX) + ", " + str(meshZ) + ").FunctionType(" + str(walkmeshType) + ")"
            #newOp = functionName + " { CALL 0x" + funcAddr + " }"
        
        #fout.write("<p>Line: " + line + "</p>\n")
        rowClass = "" # if we set to "ass" it will hide the entire row when hiding assembly
        if (opAddr == 0) or (len(op) == 0):
            # this is not a valid function definition
            # if opAddr==0, hide because this is the first "function 0 = address 0", which is invalid and will be defined on the next entry
            # if len(op)==0, hide because this is an empty filler row at the end of the call table
            rowClass = "ass" 
            newOp = ""
        else:
            # this is a valid function definition, so...
            # add it to our callTable (dictionary mapping address to list of functionName)
            if callTable.get(funcAddr, None) is None:
                callTable[funcAddr] = [functionName]
            else:
                callTable[funcAddr].append(functionName)
            newOp = functionName + " { CALL 0x" + funcAddr + " }"
        indent = 0
        s = "<tr class='%s'><td class='adr'>%s</td><td class='op ass'>%s</td><td class='op2 ass'>%s</td><td class='asm1 ass'>%-40s</td><td class='asm2'>%s%s</td></tr>\n" % (rowClass, opAddrString, opCodeString, opCode2String, htmlEscape(op), ('  ' * indent), htmlEscape(newOp))
        fout.write(s)

    fout.write("</table>\n")
    
    fout.write("<hr />\n")
    fout.write("<h2>Function 0000</h2>\n")
    fout.write("<table>\n")
    fout.write("<tr class='hdr'><td style='width:40px'>Addr</td><td class='ass' style='width:40px'>Op1</td><td class='ass' style='width:40px'>Op2</td><td class='ass' style='width:400px'>Assembly</td><td style='width:500px'>Code</td></tr>\n")
    #fout.write("<span>Addr</span>\t<span>Op1</span>\t<span>Op2</span>\t<span>ASM1</span>\t<span>ASM2</span><br/>\n")

    for line in lines[0x100:]:
    
        line = line.rstrip('\r\n')
        if (len(line) == 0):
            continue
        tokens = line.split("\t")

        opAddrString = tokens[0]
        opCodeString = tokens[1]
        opCode2String = tokens[2]
        op = tokens[3]
        opAddr = int(opAddrString, 16)
        opCode = int(opCodeString, 16)
        opCode2 = int(opCode2String, 16) if opCode2String != "" else -1
    
        if "RETURN" in lastOp:
            fout.write("</table>\n")
            fout.write("<hr />\n")
            fout.write("<h2>Function " + opAddrString + "</h2>\n")
            if callTable.get(opAddrString, None) is not None:
                fout.write("Called by:\n<ul>\n")
                for funcName in callTable[opAddrString]:
                    fout.write("<li>" + funcName + "</li>\n")
                fout.write("</ul>\n")
            fout.write("<table>\n")
            fout.write("<tr class='hdr'><td style='width:40px'>Addr</td><td class='ass' style='width:40px'>Op1</td><td class='ass' style='width:40px'>Op2</td><td class='ass' style='width:400px'>Assembly</td><td style='width:500px'>Code</td></tr>\n")
            #fout.write("<tr><td style='width:40px'>Addr</td>\t<td style='width:40px'>Op1</td>\t<td style='width:40px'>Op2</td>\t<td style='width:400px'>ASM1</td>\t<td style='width:500px'>ASM2</td></tr>\n")
            #fout.write("<span>Addr</span>\t<span>Op1</span>\t<span>Op2</span>\t<span>ASM1</span>\t<span>ASM2</span><br/>\n")

        if isBranchOp(op):
            stack = []  # temporary, might need to fix this later
        # Need to handle POPs before PUSHes, but we want to strip out the PUSH first
        # TODO...
        newOp = op
        isPushOp = False
        if "PUSH " in newOp:
            isPushOp = True
            newOp = newOp[5:]
        # do POPs first before any PUSHes
        if "POP1" in op:
            pop1 = stack.pop()
            printStack(stack, fout)
            #newOp = newOp.replace("POP1", pop1)
            if isUnaryOpAndShouldWrap(opCode):
                newOp = "(" + newOp + ")"
            if "POP2" in op:
                pop2 = stack.pop()
                printStack(stack, fout)
                if "==" in op and pop2 == "GetSpecial($FirstEntityModelId)":
                    modelId = pop1[1:] # remove leading "#" sign
                    modelIdName = getModelIdName(modelId)
                    pop1 = modelIdName
                    #print "Found: op=" + op + " and pop1=" + pop1 + " and POP2=" + pop2
                    #m = re.search("GetSpecial\\(\\$FirstEntityModelId\\) == #(\\d\\d\\d\\d)", newOp)
                    #if m is not None:
                    #    modelId = m.group(1)
                    #    modelIdName = getModelIdName(modelId)
                    #    print "Found check for modelId=" + modelId

                newOp = newOp.replace("POP2", pop2)
                if isBinaryOpAndShouldWrap(opCode):
                    newOp = "(" + newOp + ")"
                if "POP3" in op:
                    pop3 = stack.pop()
                    printStack(stack, fout)
                    newOp = newOp.replace("POP3", pop3)
                    if "POP4" in op:
                        pop4 = stack.pop()
                        printStack(stack, fout)
                        newOp = newOp.replace("POP4", pop4)
            newOp = newOp.replace("POP1", pop1)
        # handle PUSHes
        if isPushOp:
            #if newOp[0:1] == '#':
                #hexString = newOp[1:]
                #decimalString = str(int(newOp[1:], 16))
                #newOp = hexString
                #newOp = hexString + " /* " + decimalString + " */"  # replace "#XXXX" with "XXXX /* DDD */"
            pos = newOp.find("GetSpecial(")
            if (pos >= 0):
                pos = pos + 11
                endPos = newOp.find(")", pos)
                specialVarValue = newOp[pos:endPos]
                if not specialVarValue.startswith("$"):
                    specialVarName = getSpecialVarName(specialVarValue)
                    if (specialVarName is not None):
                        newOp = newOp[0:pos] + specialVarName + newOp[endPos:]
            stack.append(newOp)
            printStack(stack, fout)
            newOp = "" # "//" # EvaluateAndPush()
        if "JUMPZ" in newOp:
            newOp = newOp.replace("JUMPZ", "IF ")
            newOp = newOp[0:-5] + " {" # "{ // ELSE GOTO " + newOp[-4:]
            newIfBlock = IfBlock(0, opCode2, opCode2)
            ifBlockStack.append(newIfBlock)
        elif "JUMP" in newOp:
            newOp = newOp.replace("JUMP", "GOTO")
            #ifBlockStack[-1].endAddr = opCode2
            #ifBlockStack[-1].mode = 1
            #indent = len(ifBlockStack) - 1
            ##s = "%s\t%s\t%s\t%-40s\t%s%s\n" % ("", "", "", "", ('  ' * indent), "} else {")
            #s = "%s\t%s\t%s\t%-40s\t%s%s\n" % ("", "", "", "", ('  ' * indent), "}")
            #fout.write(s)
        if "CLEAR" in newOp:
            newOp = "" # "//"

        if "BANK " in newOp:
            newOp = newOp.replace("BANK ", "")

        pos = newOp.find("SetChocoboType(")
        if (pos >= 0):
            pos = pos + 15
            endPos = newOp.find(")", pos)
            chocoboTypeParam = newOp[pos:endPos]
            chocoboType = chocoboTypes[chocoboTypeParam]
            if (chocoboType is not None):
                newOp = newOp[0:pos] + chocoboType + newOp[endPos:]

        pos = newOp.find("SetSubmarineType(")
        if (pos >= 0):
            pos = pos + 17
            endPos = newOp.find(")", pos)
            varValue = newOp[pos:endPos]
            varName = submarineTypes[varValue]
            if (varName is not None):
                newOp = newOp[0:pos] + varName + newOp[endPos:]

        if "CALL Model" in newOp:
            m = re.search("CALL Model\\((.*?)\\).Function\\((.*?)\\)", newOp)
            modelIdHex = m.group(1)
            if modelIdHex.startswith("#"):
                modelIdHex = modelIdHex[1:]
                functionIdHex = m.group(2)
                funcIdName = getModelFunctionIdName(funcIdHex)
                modelIdName = getModelIdName(modelIdHex)
                newOp = "CALL Model(" + modelIdName + ").Function(" + funcIdName + ")"

        if "SetWindowMessage" in newOp:
            m = re.search("SetWindowMessage\\((.*?)\\)", newOp)
            msgId = m.group(1)
            #print "Trying to get message for msgId=" + msgId
            message = messages[msgId]
            newOp = "SetWindowMessage({MSG}" + message + "{/MSG})"

        if "SetWindowPrompt" in newOp:
            m = re.search("SetWindowPrompt\\((.*?), (.*?), (.*?)\\)", newOp)
            msgId = m.group(1)
            firstChoice = m.group(2)
            lastChoice = m.group(3)
            #print "Trying to get message for msgId=" + msgId
            message = messages[msgId]
            newOp = "SetWindowPrompt({MSG}%s{/MSG}, %s, %s" % (message, firstChoice, lastChoice)
            
        while (len(ifBlockStack) > 0) and (ifBlockStack[-1].nextElseAddr == opAddr):
            ifBlockStack.pop()
            rowClass = "r1"
            s = "<tr class='%s'><td class='adr'>%s</td><td class='op ass'>%s</td><td class='op2 ass'>%s</td><td class='asm1 ass'>%-40s</td><td class='asm2'>%s%s</td></tr>\n" % (rowClass, "", "", "", "", ('  ' * len(ifBlockStack)), "}") # end if block
            #s = "<tr class='%s'><td>%s</td>\t<td>%s</td>\t<td>%s</td>\t<td>%-40s</td>\t<td>%s%s</td></tr>\n" % (rowClass, "", "", "", "", ('  ' * len(ifBlockStack)), "}") # end if block
            #s = "<span>%s</span>\t<span>%s</span>\t<span>%s</span>\t<span>%-40s</span>\t<span>%s%s</span><br/>\n" % ("", "", "", "", ('  ' * len(ifBlockStack)), "}") # end if block
            fout.write(s)

        rowClass = ""
        if len(newOp) == 0:
            rowClass = "ass"

        indent = len(ifBlockStack)
        if "JUMPZ" in op:
            indent = indent - 1
        s = "<tr class='%s'><td class='adr'>%s</td><td class='op ass'>%s</td><td class='op2 ass'>%s</td><td class='asm1 ass'>%-40s</td><td class='asm2'>%s%s</td></tr>\n" % (rowClass, opAddrString, opCodeString, opCode2String, htmlEscape(op), ('  ' * indent), htmlEscape(newOp))
        #s = "<tr class='%s'><td>%s</td>\t<td>%s</td>\t<td>%s</td>\t<td>%-40s</td>\t<td>%s%s</td></tr>\n" % (rowClass, opAddrString, opCodeString, opCode2String, htmlEscape(op), ('  ' * indent), htmlEscape(newOp))
        #s = "<span>%s</span>\t<span>%s</span>\t<span>%s</span>\t<span>%-40s</span>\t<span>%s%s</span><br/>\n" % (opAddrString, opCodeString, opCode2String, htmlEscape(op), ('  ' * indent), htmlEscape(newOp))
        #print s
        #s = s.partition('//')[0]
        #s = s + "\n"
        fout.write(s)
    
        lastOp = op
    
    fout.write("</table></body></html>\n")
    fout.close()

# MAIN PROGRAM

messages = getMessages()

###worldMapNames = ["WM%X" % i for i in xrange(13)]
###worldMapNames += ["WM%XS" % i for i in xrange(11)]
worldMapNames = ["wm0", "wm2", "wm3"]
for worldMapName in worldMapNames:
    print worldMapName
    decodeWorldMapAssembly(worldMapName, messages)
