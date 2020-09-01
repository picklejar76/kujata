const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js")
const stringUtil = require("./string-util.js")
const fs = require('fs-extra')
const sharp = require('sharp')
const { getColorForPalette } = require('./background-layer-renderer')

class TimFile { // https://github.com/myst6re/makoureactor/blob/4645b4b0595626b04163d3d0fa2d4b7569d6b440/core/TimFile.cpp
    constructor() { }
    loadTimFileFromPath(path) {
        return this.loadTimFileFromBuffer(fs.readFileSync(path))
    }
    loadTimFileFromBuffer(buffer) {
        let r = new FF7BinaryDataReader(buffer)

        const tag = r.readUByte()
        this.tim = {
            header: {
                version: r.readUByte()
            }
        }
        r.offset = 4
        const marker = r.readUByte()

        this.tim.header.bpp = this._getBPPType(marker & 3) // Different types of Bits Per Pixel:
        this.tim.header.isCLUT = ((marker >> 3) & 1) === 1 // Is there a CLUT in this file

        r.offset = 8
        if (this.tim.header.isCLUT) {
            this.tim.clut = { // Colour Lookup Table
                length: r.readUInt(),
                x: r.readUShort(),
                y: r.readUShort(),
                width: r.readUShort(),
                height: r.readUShort(),
                colorTables: []
            }
            this.tim.clut.paletteSize = (this.tim.header.bpp === '4bit' ? 16 : 256)
            this.tim.clut.noOfPalettes = (this.tim.clut.length - 12) / (this.tim.clut.paletteSize * 2)
            if ((this.tim.clut.length - 12) % (this.tim.clut.paletteSize * 2) != 0) {
                this.tim.clut.noOfPalettes = this.tim.clut.noOfPalettes * 2
            }
            // console.log('tim.clut', this.tim.clut, 'r.offset', r.offset)
            // const totalClut = this.tim.clut.width * this.tim.clut.height
            for (let i = 0; i < this.tim.clut.noOfPalettes; i++) {
                let palettePage = []
                for (let j = 0; j < this.tim.clut.paletteSize; j++) {
                    const colorBytes = r.readUShort()
                    let color = getColorForPalette(colorBytes)
                    palettePage.push(color)
                }
                this.tim.clut.colorTables.push(palettePage)
            }
            // console.log('totalClut', this.tim.clut.width, this.tim.clut.height, totalClut, r.length, this.tim.clut.colors.length)
        }
        // console.log('tim.clut', 'end r.offset', r.offset)


        this.tim.imageData = { // Image Data
            length: r.readUInt(),
            x: r.readUShort(),
            y: r.readUShort(),
            width: r.readUShort(),
            height: r.readUShort(),
            data: []
        }
        if (this.tim.header.bpp === '4bit') { this.tim.imageData.width = this.tim.imageData.width * 4 }
        if (this.tim.header.bpp === '8bit') { this.tim.imageData.width = this.tim.imageData.width * 2 }

        let remainingImageDataSize = r.length - r.offset
        // console.log('tim.imageData', this.tim.imageData, 'r.offset', r.offset, remainingImageDataSize, this.tim.imageData.length - 12)

        // let totalImageData
        switch (this.tim.header.bpp) {
            case '4bit': case '8bit':
                // console.log('4bit')
                while (r.length > r.offset) {
                    this.tim.imageData.data.push(r.readUByte())
                }
                break
            case '16bit':
                // console.log('16bit')
                while (r.length > r.offset) {
                    let color = getColorForPalette(r.readUShort())
                    this.tim.imageData.data.push(color)
                }
                break
            case '24bit': // Should validate this
                // console.log('24bit')
                totalImageData = this.tim.imageData.width * this.tim.imageData.height * 2 // Not sure about 2
                for (let i = 0; i < totalImageData; i++) {
                    let color = {
                        r: r.readUShort(),
                        g: r.readUShort(),
                        b: r.readUShort()
                    }
                    color.hex = `${stringUtil.toHex2(color.r)}${stringUtil.toHex2(color.g)}${stringUtil.toHex2(color.b)}`
                    this.tim.imageData.data.push(color)
                }
                break

            default:
                break;
        }



        // console.log('tim', this.tim.imageData)
        // console.log('tim.header', this.tim.header)
        // console.log('tim.clut', this.tim.clut.paletteSize, this.tim.clut.noOfPalettes, '->', this.tim.clut.colorTables.map(t => t.length).reduce((t, v) => t + v))
        // console.log('tim.totalImageData', this.tim.imageData.width, this.tim.imageData.height, '->', this.tim.imageData.data.length)
        // console.log('tim.offset', r.offset, r.length, 'file processed completely', r.offset === r.length)
        return this
    }
    async saveAllPalettesAsPngs(outputPath) {
        for (let i = 0; i < this.tim.clut.noOfPalettes; i++) {
            const paletteOutputPath = outputPath.replace('.png', `_${i + 1}.png`)
            // console.log('paletteOutputPath', paletteOutputPath)
            await this.saveAsPngWithPalette(paletteOutputPath, i)
        }
    }
    async saveAsPngWithPalette(outputPath, paletteId) {

        const channels = 4
        let n = this.tim.imageData.width * this.tim.imageData.height * channels // Seems to require 2x width also
        // console.log('-----')
        // console.log('tim.imageData', this.tim.imageData.width, this.tim.imageData.height, channels, '->', n, '->', this.tim.imageData.data.length * channels * 2)
        // console.log('tim.clut', this.tim.clut.data.length)

        const palette = this.tim.clut.colorTables[paletteId] // Can have multiple palettes

        let data = new Uint8Array(n)
        for (let i = 0; i < n; i++) {
            data[i] = 0x00 // Fill with transparent
        }
        switch (this.tim.header.bpp) {
            case '4bit':
                for (let i = 0; i < this.tim.imageData.data.length; i++) {
                    const pixelIdA = this.tim.imageData.data[i] & 0xF
                    const pixelIdB = this.tim.imageData.data[i] >> 4
                    data[(i * 8) + 0] = palette[pixelIdA].r
                    data[(i * 8) + 1] = palette[pixelIdA].g
                    data[(i * 8) + 2] = palette[pixelIdA].b
                    data[(i * 8) + 3] = palette[pixelIdA].r === 0 && palette[pixelIdA].g === 0 && palette[pixelIdA].b === 0 ? 0x00 : palette[pixelIdA].a
                    data[(i * 8) + 4] = palette[pixelIdB].r
                    data[(i * 8) + 5] = palette[pixelIdB].g
                    data[(i * 8) + 6] = palette[pixelIdB].b
                    data[(i * 8) + 7] = palette[pixelIdB].r === 0 && palette[pixelIdB].g === 0 && palette[pixelIdB].b === 0 ? 0x00 : palette[pixelIdB].a
                }
                break
            case '8bit': // Untested
                for (let i = 0; i < this.tim.imageData.data.length; i++) {
                    const pixelId = this.tim.imageData.data[i]
                    data[(i * 4) + 0] = palette[pixelId].r
                    data[(i * 4) + 1] = palette[pixelId].g
                    data[(i * 4) + 2] = palette[pixelId].b
                    data[(i * 4) + 3] = palette[pixelId].r === 0 && palette[pixelId].g === 0 && palette[pixelId].b === 0 ? 0x00 : palette[pixelId].a
                }
                break
            case '16bit': // Untested
                for (let i = 0; i < this.tim.imageData.data.length; i++) {
                    const colorByte = this.tim.imageData.data[i]
                    const color = getColorForPalette(colorByte)
                    data[(i * 4) + 0] = color.r
                    data[(i * 4) + 1] = color.g
                    data[(i * 4) + 2] = color.b
                    data[(i * 4) + 3] = color.r === 0 && color.g === 0 && color.b === 0 ? 0x00 : color.a
                }
                break
            case '24bit': // Untested
                for (let i = 0; i < this.tim.imageData.data.length; i++) {
                    const color = this.tim.imageData.data[i]
                    data[(i * 4) + 0] = color.r
                    data[(i * 4) + 1] = color.g
                    data[(i * 4) + 2] = color.b
                    data[(i * 4) + 3] = color.r === 0 && color.g === 0 && color.b === 0 ? 0x00 : color.a
                }
                break
        }

        await sharp(
            Buffer.from(data.buffer),
            { raw: { width: this.tim.imageData.width, height: this.tim.imageData.height, channels: 4 } })
            .toFile(outputPath)
    }
    _getBPPType(bpp) {
        if (bpp === 0) { return '4bit' } // 00  4-bit (color indices)
        if (bpp === 1) { return '8bit' } // 01  8-bit (color indices)
        if (bpp === 2) { return '16bit' } // 10  16-bit (actual colors)
        if (bpp === 4) { return '24bit' } // 11  24-bit (actual colors)
    }
    _dec2hex(dec) { // For debug only
        return `0x${parseInt(dec).toString(16)}`
    }
    _dec2bin(dec) { // For debug only
        return (dec >>> 0).toString(2)
    }
}
module.exports = {
    TimFile
}