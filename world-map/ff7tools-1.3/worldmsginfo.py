# -*- coding: utf-8 -*-

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

import sys
reload(sys)
sys.setdefaultencoding('utf-8')

# Characters in range 0x00..0xdf directly map to Unicode characters.
# This is almost identical to the MacOS Roman encoding shifted down
# by 32 positions.
normalChars = (
    u" !\"#$%&'()*+,-./01234"
    u"56789:;<=>?@ABCDEFGHI"
    u"JKLMNOPQRSTUVWXYZ[\\]^"
    u"_`abcdefghijklmnopqrs"
    u"tuvwxyz{|}~ ÄÅÇÉÑÖÜáà"
    u"âäãåçéèêëíìîïñóòôöõúù"
    u"ûü♥°¢£↔→♪ßα  ´¨≠ÆØ∞±≤"  # '♥' (0x80), '↔' (0x84), '→' (0x85), '♪' (0x86), and 'α' (0x88) are additions
    u"≥¥µ∂ΣΠπ⌡ªºΩæø¿¡¬√ƒ≈∆«"
    u"»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄ ‹"
    u"›ﬁﬂ■‧‚„‰ÂÊÁËÈÍÎÏÌÓÔ Ò"
    u"ÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ       "
)

# Special characters of the field module (0xe0..0xff)
fieldSpecialChars = {

    # Not in Japanese version, where 0xe0..0xe6 are regular characters:
    '\xe0': u"{CHOICE}",    # choice tab (10 spaces)
    '\xe1': u"    ",        # tab (4 spaces)
    '\xe2': u", ",          # shortcut
    '\xe3': u'."',          # not very useful shortcut with the wrong quote character...
    '\xe4': u'..."',        # not very useful shortcut with the wrong quote character... # picklejar changed to ASCII

    # In all versions
    '\xe6': u"{(13)}",           # appears in the US version of BLACKBG6, presumably a mistake # picklejar changed to ASCII
    '\xe7': u"{EOL}",          # new line
    '\xe8': u"{NEW}",       # new page

    '\xea': u"{CLOUD}",
    '\xeb': u"{BARRET}",
    '\xec': u"{TIFA}",
    '\xed': u"{AERITH}",
    '\xee': u"{RED XIII}",
    '\xef': u"{YUFFIE}",
    '\xf0': u"{CAIT SITH}",
    '\xf1': u"{VINCENT}",
    '\xf2': u"{CID}",
    '\xf3': u"{PARTY #1}",
    '\xf4': u"{PARTY #2}",
    '\xf5': u"{PARTY #3}",

    '\xf6': u"{CIRCLE BUTTON}",          # controller button
    '\xf7': u"{TRIANGLE BUTTON}",           # controller button
    '\xf8': u"{SQUARE BUTTON}",           # controller button
    '\xf9': u"{X BUTTON}",           # controller button

    '\xfa': u"",            # kanji 1
    '\xfb': u"",            # kanji 2
    '\xfc': u"",            # kanji 3
    '\xfd': u"",            # kanji 4

    # '\xfe'                # extended control code, see below
    # '\xff'                # end of string
}

# Extended control codes of the field module (0xfe ..)
fieldControlCodes = {
    '\xd2': u"{GRAY}",
    '\xd3': u"{BLUE}",
    '\xd4': u"{RED}",
    '\xd5': u"{PURPLE}",
    '\xd6': u"{GREEN}",
    '\xd7': u"{CYAN}",
    '\xd8': u"{YELLOW}",
    '\xd9': u"{WHITE}",
    '\xda': u"{FLASH}",
    '\xdb': u"{RAINBOW}",

    '\xdc': u"{PAUSE}",   # pause until OK button is pressed
    # '\xdd'              # wait # of frames
    '\xde': u"{NUM}",     # decimal variable
    '\xdf': u"{HEX}",     # hex variable
    '\xe0': u"{SCROLL}",  # wait for OK butten, then scroll window
    '\xe1': u"{RNUM}",    # decimal variable, right-aligned
    # '\xe2'              # value from game state memory
    '\xe9': u"{FIXED}",   # fixed-width character spacing on/off
}

# Characters which must be escaped when decoding
escapeChars = u"\\{}"

# assume english for now
charset = normalChars
numNormalChars = '\xe0'
escapeChars = u"\\{}"

def getExtAsciiText(k):
    if k == 0xea:
        return "{Cloud}"
    if k == 0xe7:
        return "{EOL}"
    if k == 0xb2:
        return "``"
    if k == 0xb3:
        return "''"
    if k == 0xb4:
        return "`"
    if k == 0xb5:
        return "'"
    if k == 0xe0:
        return "{Choice}"
    if k == 0xe3:
        return ".\""
    if k == 0xe4:
        return "...\""
    if k == 0xa9:
        return "..."
    return "<%02x>" % k

def extractText2(data, offset):
        #print "Extracting text for offset " + str(offset) + ":"
        i = offset
        text = u""
        while (True): # i < len(data)
            #print "i=" + str(i)
            #k = data[i]
            #print "Code: " + str(v)
            c = data[i]
            #print str(c)
            #c = chr(c) ### experimental workaround
            #c = chr(k)
            i += 1
            #if c == '\xff':
            if c == 0xff:
                # End of string
                return text

            #print "v=" + str(v) + " and text=" + text
            #if k >= 255:
                ## End of string
                #return text + " [ERROR]"

            # # # elif c < numNormalChars:
            elif c < 0xe0:    ### 0x5f

                # Regular printable character
                #t = charset[k]
                #print ord(chr(c))
                if c < 0x5f:
                     t = charset[c]
                else:
                     t = getExtAsciiText(c)

                if t in escapeChars:
                    print "t was in escapeChars"
                    text += u"\\"

                text += t

            elif c == 0xfe:

                # Field module control code or kanji
                if i >= dataSize:
                    raise IndexError, "Spurious control code %02x at end of string %r" % (ord(c), data)

                k = data[i]
                i += 1

                # # # if k < '\xd2' and japanese:

                    # # # text += decodeKanji(c, ord(k))

                if k == 0xdd:

                    # WAIT <arg> command
                    if i >= dataSize - 1:
                        raise IndexError, "Spurious WAIT command at end of string %r" % data

                    arg = struct.unpack_from("<H", data, i)
                    i += 2

                    text += u"{WAIT %d}" % arg

                elif k == 0xe2:

                    # STR <offset> <length> command
                    if i >= dataSize - 3:
                        raise IndexError, "Spurious STR command at end of string %r" % data

                    offset, length = struct.unpack_from("<HH", data, i)
                    i += 4

                    text += u"{STR %04x %04x}" % (offset, length)

                else:

                    # Other control code
                    if not chr(k) in fieldControlCodes:
                        raise IndexError, "Illegal control code %02x" % (k)

                    text += fieldControlCodes[chr(k)]
                        
            #else:
                #text += getSpecialText(k)
                
            else:

                # Field module special character
                # print "special char = %02x = %d" % (c, c)
                t = fieldSpecialChars[chr(c)]

                if not t:
                    raise IndexError, "Illegal character %02x in field string %r" % (ord(c), data)

                #if c == '\xe8':  # newline after {NEW}
                #    t += '\n'

                text += t

            #print "[%02x] %02x | So far: %s" % (i, c, text)
        
        return "ERROR: Did not finish"

# Read the file data
dataSize = 4096
fin = open('C:\\Install\\FF7\\tools\\lgp\\worldmap_us\\mes', 'rb')
cmpData = fin.read(dataSize)
data = bytearray(cmpData)
offset = 0
numTexts = struct.unpack_from("<H", data, offset)[0]
offset = offset + 2
textIndex = 0
textInfo = []
while textIndex < numTexts:
    data_offset = struct.unpack_from("<H", data, offset)[0]
    #print "%2d. data_offset=%04x" % (textIndex, data_offset)
    text = extractText2(data, data_offset)
    print "%02x\t%s" % (textIndex, text)
    textIndex += 1
    offset += 2
