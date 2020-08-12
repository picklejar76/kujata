const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js")
const fs = require('fs-extra')
const sharp = require('sharp')

class TexFile {
    constructor() { }
    loadTexFileFromPath(path) {
        return this.loadTexFileFromBuffer(fs.readFileSync(path))
    }
    loadTexFileFromBuffer(buffer) {
        let r = new FF7BinaryDataReader(buffer)
        this.tex = {
            header: {
                version: r.readUInt(),
                unknown1: r.readUInt(),
                colorKeyFlag: r.readUInt(),
                unknown2: r.readUInt(),
                unknown3: r.readUInt(),
                minBitsPerColor: r.readUInt(),
                maxBitsPerColor: r.readUInt(),
                minAlphaBits: r.readUInt(),
                maxAlphaBits: r.readUInt(),
                minBitsPerPixel: r.readUInt(),
                maxBitsPerPixel: r.readUInt(),
                unknown4: r.readUInt(),
                noOfPalettes: r.readUInt(),
                noColorsPerPalettes: r.readUInt(),
                bitDepth: r.readUInt(),
                width: r.readUInt(),
                height: r.readUInt(),
                bytesPerRow: r.readUInt(),
                unknown5: r.readUInt(),
                paletteFlag: r.readUInt(),
                bitsPerIndex: r.readUInt(),
                indexedTo8bitFlag: r.readUInt(),
                paletteSize: r.readUInt(),
                noColorsPerPalettes2: r.readUInt(),
                runtimeData: r.readUInt(),
                bitsPerPixel: r.readUInt(),
                bytesPerPixel: r.readUInt()
            },
            pixelFormat: {
                noRedBits: r.readUInt(),
                noGreenBits: r.readUInt(),
                noBlueBits: r.readUInt(),
                noAlphaBits: r.readUInt(),
                redBitmask: r.readUInt(),
                greenBitmask: r.readUInt(),
                blueBitmask: r.readUInt(),
                alphaBitmask: r.readUInt(),
                redShift: r.readUInt(),
                greenShift: r.readUInt(),
                blueShift: r.readUInt(),
                alphaShift: r.readUInt(),
                noRedBits8: r.readUInt(),
                noGreenBits8: r.readUInt(),
                noBlueBits8: r.readUInt(),
                noAlphaBits8: r.readUInt(),
                redMax: r.readUInt(),
                greenMax: r.readUInt(),
                blueMax: r.readUInt(),
                alphaMax: r.readUInt(),
            },
            misc: {
                bolorKeyArrayFlag: r.readUInt(),
                runtimeData1: r.readUInt(),
                referenceAlpha: r.readUInt(),
                runtimeData2: r.readUInt(),
                unknown6: r.readUInt(),
                paletteIndex: r.readUInt(),
                runtimeData3: r.readUInt(),
                runtimeData4: r.readUInt(),
                unknown7: r.readUInt(),
                unknown8: r.readUInt(),
                unknown9: r.readUInt(),
                unknown10: r.readUInt()
            }
        }

        this.tex.paletteData = r.readUByteArray(this.tex.header.paletteSize * 4)
        this.tex.pixelData = r.readUByteArray(this.tex.header.width * this.tex.header.height * this.tex.header.bytesPerPixel)
        if (r.length <= r.offset) { // This seems to be out of range in some cases
            this.tex.colorKeyArray = []
        } else {
            this.tex.colorKeyArray = r.readUByteArray(this.tex.header.noOfPalettes * 1)
        }
        // For debugging only
        // delete this.tex.paletteData
        // delete this.tex.pixelData

        // console.log('tex', this.tex) 
        // console.log(r.length, 'r.offset', r.offset, this._dec2bin(r.offset), this._dec2hex(r.offset))
        // console.log('tex.header.version', this.tex.header.version, this._dec2hex(this.tex.header.version), this._dec2bin(this.tex.header.version))
        // console.log('tex.header.paletteSize', tex.header.paletteSize, tex.header.paletteSize * 4)
        // console.log('tex.header.pixelData', tex.header.width, tex.header.height, tex.header.bytesPerPixel, '->', tex.header.width * tex.header.height * tex.header.bytesPerPixel, 'pixels')

        return this
    }

    getImageWidth() { return this.tex.header.width }
    getImageHeight() { return this.tex.header.height }

    /*
    Something just doesn't sit right with me for this as there is no ability to select a palette offset
    or multiplier that allows me to get more than the first 1024 pixels from the paletteData

    Although, this DOES give the same output as the TexTool 0.10, so I guess it's right.
    
    I will add an offset value in here when I further understand what to do

    It also assumes 4 bytes for RGBA. RGB555 is used when bitDepth === 16,
    but is assumed this doesnt happen in FF7 for .tex
    - http://wiki.ffrtt.ru/index.php?title=FF7/TEX_format

    */
    async saveAsPng(outputPath) {
        await this.saveAsPngWithPaletteOffset(outputPath, 0)
    }
    async saveAsPngWithPaletteOffset(outputPath, paletteOffset) {
        let n = this.tex.header.height * this.tex.header.width * 4

        let data = new Uint8Array(n)
        for (let i = 0; i < n; i++) {
            data[i] = 0xFF // Fill with transparent
        }
        for (let i = 0; i < this.tex.header.height * this.tex.header.width; i++) {
            const pixelId = paletteOffset + this.tex.pixelData[i]

            for (let channelOffset = 0; channelOffset < 4; channelOffset++) {
                const colorId = (pixelId * 4) + channelOffset
                const color = this.tex.paletteData[colorId]
                const pixelPosition = (i * 4) + channelOffset
                data[pixelPosition] = color
                // if (4010 < i && i < 4015) { // For debug
                //     console.log(i, channelOffset, pixelId, colorId, color, pixelPosition, data[pixelPosition])
                // }
            }
        }

        await sharp(
            Buffer.from(data.buffer),
            { raw: { width: this.tex.header.width, height: this.tex.header.height, channels: 4 } })
            .toFile(outputPath)
    }

    _dec2hex(dec) { // For debug only
        return `0x${parseInt(dec).toString(16)}`
    }
    _dec2bin(dec) { // For debug only
        return (dec >>> 0).toString(2)
    }
}

module.exports = {
    TexFile
}