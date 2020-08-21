const zlib = require('zlib')
const fs = require('fs-extra')
const path = require('path')

const LzsDecompressor = require("../lzs/lzs-decompressor.js")
const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js")
const { getTextSectionData,
    getItemSectionData,
    getWeaponSectionData,
    getArmorSectionData,
    getAccessorySectionData,
    getMateriaSectionData,
    extractWindowBinElements } = require('./kernel-sections.js')
const { getInitSectionData } = require('./kernel-section-init-data')
const { TimFile } = require('./tim-file.js')

/*

All but 4 sections from kernel.bin and kernel2.bin complete
- commandData
- attackData
- battleAndGrowthData
- initData - COMPLETE

A few more details required for materiaData - as per http://wiki.ffrtt.ru/index.php?title=FF7/Materia_data

A little alignment required on status and elements, and some consistent naming convertions

*/
const decompressBinGzip = (binPath, sectionCount) => {
    let buffer = fs.readFileSync(binPath)
    let r = new FF7BinaryDataReader(buffer)

    let sections = []
    for (let i = 0; i < sectionCount; i++) {
        const sectionCompressedLength = r.readUShort()
        const sectionDecompressedLength = r.readUShort()
        const fileType = r.readUShort()
        const sectionStart = r.offset
        const sectionData = r.readUByteArray(sectionCompressedLength)
        const sectionEnd = r.offset
        const sectionBuffer = buffer.slice(sectionStart, sectionEnd)
        const decompressedSection = zlib.gunzipSync(sectionBuffer)
        // console.log('section ', i, sectionCompressedLength, sectionDecompressedLength, fileType,
        //     '-', sectionStart, 'for', sectionCompressedLength, 'bytes to', sectionEnd, '->'
        //     , sectionBuffer.length, decompressedSection.length)
        sections.push({ type: fileType, buffer: decompressedSection })
    }
    return sections
}
const decompressKernel2 = (kernel2Path) => {
    let buffer = fs.readFileSync(kernel2Path)
    buffer = new LzsDecompressor().decompress(buffer)
    let r = new FF7BinaryDataReader(buffer)

    let sections = [{}, {}, {}, {}, {}, {}, {}, {}, {}] // Pad this out for the positions match the decompressed kernel.bin
    r.offset = 0
    for (let i = 9; i < 27; i++) { // should be 27 sections
        const sectionLength = r.readUInt()
        const sectionStart = r.offset
        const sectionEnd = r.offset + sectionLength
        // console.log('section', i, r.offset, sectionLength)
        const sectionBuffer = buffer.slice(sectionStart, sectionEnd)
        r.offset = sectionEnd
        sections.push({ id: i, buffer: sectionBuffer })
    }
    return sections
}

const saveKernelData = async (outputKernelDirectory, data) => {

    // Note: Chosen to claim the kernel.bin.json as previously defined in parse-kernel.js
    const outputPath = path.join(outputKernelDirectory, 'kernel.bin.json')

    console.log('kernel.bin.json successfully extracted to', outputPath)
    await fs.writeJson(outputPath, data, { spaces: '\t' })

}
const extractKernelKernel2Bin = async (inputKernelDirectory, outputKernelDirectory) => {

    console.log('Extract kernel.bin and kernel2.bin: START')
    const kernelBinPath = path.join(inputKernelDirectory, 'KERNEL.BIN')
    const kernel2BinPath = path.join(inputKernelDirectory, 'kernel2.bin')

    let kernelData = decompressBinGzip(kernelBinPath, 27)
    let kernel2Data = decompressKernel2(kernel2BinPath)
    const data = {}

    // Get texts first
    data.commandDescriptions = getTextSectionData(kernel2Data[9])
    data.magicDescriptions = getTextSectionData(kernel2Data[10])
    data.itemDescriptions = getTextSectionData(kernel2Data[11])
    data.weaponDescriptions = getTextSectionData(kernel2Data[12])
    data.armorDescriptions = getTextSectionData(kernel2Data[13])
    data.accessoryDescriptions = getTextSectionData(kernel2Data[14])
    data.materiaDescriptions = getTextSectionData(kernel2Data[15])
    data.keyitemDescriptions = getTextSectionData(kernel2Data[16])
    data.commandNames = getTextSectionData(kernel2Data[17])
    data.magicNames = getTextSectionData(kernel2Data[18])
    data.itemNames = getTextSectionData(kernel2Data[19])
    data.weaponNames = getTextSectionData(kernel2Data[20])
    data.armorNames = getTextSectionData(kernel2Data[21])
    data.accessoryNames = getTextSectionData(kernel2Data[22])
    data.materiaNames = getTextSectionData(kernel2Data[23])
    data.keyitemNames = getTextSectionData(kernel2Data[24])
    data.battleText = getTextSectionData(kernel2Data[25])
    data.summonAttackNames = getTextSectionData(kernel2Data[26])


    // Combine descriptions and names with kernel data
    data.itemData = getItemSectionData(kernelData[4], data.itemNames, data.itemDescriptions)
    data.weaponData = getWeaponSectionData(kernelData[5], data.weaponNames, data.weaponDescriptions)
    data.armorData = getArmorSectionData(kernelData[6], data.armorNames, data.armorDescriptions)
    data.accessoryData = getAccessorySectionData(kernelData[7], data.accessoryNames, data.accessoryDescriptions)
    data.materiaData = getMateriaSectionData(kernelData[8], data.materiaNames, data.materiaDescriptions)

    // TODO - General game data
    // data.commandData = getTextSectionData(kernelData[0])
    // data.attackData = getTextSectionData(kernelData[1])
    // data.battleAndGrowthData = getTextSectionData(kernelData[2])
    data.initData = getInitSectionData(kernelData[3],
        data.itemNames, data.itemDescriptions,
        data.materiaNames, data.materiaDescriptions
    )

    await saveKernelData(outputKernelDirectory, data)
    // console.log('Final data', data.initData)
    console.log('Extract kernel.bin and kernel2.bin: END')
}

const extractWindowBin = async (inputKernelDirectory, outputKernelDirectory, metadataDirectory) => {
    console.log('Extract window.bin: START')
    const windowBinPath = path.join(inputKernelDirectory, 'WINDOW.BIN')

    let windowData = decompressBinGzip(windowBinPath, 3)
    const outputDirMetaDataWindow = path.join(metadataDirectory, 'window-assets')
    fs.emptyDirSync(outputDirMetaDataWindow)
    let windowBinMetaData = {}
    for (let i = 0; i < windowData.length; i++) {
        const windowSection = windowData[i]
        if (windowSection.type === 0) {
            const tim = new TimFile().loadTimFileFromBuffer(windowSection.buffer)
            await tim.saveAllPalettesAsPngs(path.join(outputKernelDirectory, `window.bin_${i}.png`))


            // Apparently we know nothing of the type 1 file, I imagine that it contains the references
            // to the x,y,w,h positions and palette colours for the assets to be used in the game
            // In the mean time, lets build the paletted pngs and extract them one by one
            const windowBinSectionAssetMap = await extractWindowBinElements(i, outputKernelDirectory, metadataDirectory)
            for (var assetType in windowBinSectionAssetMap) {
                windowBinMetaData[assetType] = windowBinSectionAssetMap[assetType]
            }
        } else if (windowSection.type === 1) {
            // No idea what to do here in lieu of above
        }

    }

    await fs.writeJson(path.join(outputDirMetaDataWindow, 'window.bin.metadata.json'), windowBinMetaData)

    console.log('Extract window.bin: END')
}
module.exports = {
    extractKernelKernel2Bin,
    extractWindowBin
}