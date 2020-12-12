const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js")
const { Enums, parseKernelEnums, parseMateriaData } = require('./kernel-enums')
const path = require('path')
const fs = require('fs-extra')
const sharp = require("sharp")

const dec2bin = (dec) => { // For debug only
    return (dec >>> 0).toString(2)
}
const dec2hex = (dec) => { // For debug only
    return `0x${parseInt(dec).toString(16)}`
}

const getTextSectionData = (sectionData) => {
    let strings = []

    let r = new FF7BinaryDataReader(sectionData.buffer)
    let firstItem = r.readUShort()
    let addresses = []
    for (let i = 0; i < firstItem; i += 2) {
        addresses.push(r.readUShort())
    }

    const offset = r.offset
    addresses.unshift(offset - 2) // Ensure first word is in addressses

    r.offset = offset
    for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i]
        if (i + 1 < addresses.length) {
            const nextAddress = addresses[i + 1]
            r.offset = address
            const addressText = r.readKernelString(nextAddress - address) // or r.readDialogString
            // console.log('address', i, 'to', i + 1, '->', address, nextAddress, '->', addressText)
            strings.push(addressText)
        }
        // There are some lookups here for a few items, not sure what to do yet:
        // https://github.com/Shojy/Elena/blob/master/Shojy.FF7.Elena/Sections/TextSection.cs
    }
    return strings
}

const getItemSectionData = (sectionData, names, descriptions) => {
    let r = new FF7BinaryDataReader(sectionData.buffer)
    const objectSize = 28
    // console.log('getItemSectionData', r.length, r.length / objectSize, names.length, descriptions.length)
    let objects = []

    for (let i = 0; i < r.length / objectSize; i++) {
        // const sectionOffset = i * objectSize
        // r.offset = sectionOffset
        const unknown1 = r.readUByteArray(8)
        const cameraMovementId = r.readUShort()
        const restrictions = r.readUShort()
        const targetData = r.readUByte()
        const attackEffectId = r.readUByte()
        const damageCalculationId = r.readUByte()
        const attackPower = r.readUByte()
        const conditionSubMenu = r.readUByte()
        const statusEffectChance = r.readUByte() // Some calculation required here. 3Fh	Chance to Inflict/Heal status (out of 63). 40h Cure if inflicted. 80h Cure if inflicted, Inflict if not
        const attackSpecialEffects = r.readUByte() // http://wiki.ffrtt.ru/index.php?title=FF7/Battle/Attack_Special_Effects
        const additionalEffectsModifier = r.readUByte()
        const status = r.readUInt()
        const element = r.readUShort()
        const specialAttack = r.readUShort()
        let object = {
            index: i,
            name: names[i],
            description: descriptions[i],
            cameraMovement: cameraMovementId,
            restrictions: parseKernelEnums(Enums.Restrictions, restrictions),
            targetData: parseKernelEnums(Enums.TargetData, targetData),
            attackEffectId: attackEffectId,
            damageCalculationId: damageCalculationId,
            attackPower: attackPower,
            conditionSubMenu: conditionSubMenu,
            statusEffectChance: statusEffectChance, // TODO
            attackSpecialEffects: attackSpecialEffects, // TODO 
            additionalEffectsModifier: additionalEffectsModifier,
            status: parseKernelEnums(Enums.Statuses, status), // Not sure if this is right, or if it should be inversed
            element: parseKernelEnums(Enums.Elements, element),
            specialAttack: parseKernelEnums(Enums.SpecialEffects, specialAttack),
            // unknown: {
            //     unknown1
            // }
        }
        objects.push(object)
        // if (i < 2) {
        //     console.log('weapon', object)
        // }
    }
    return objects
}
const getWeaponSectionData = (sectionData, names, descriptions) => {
    let r = new FF7BinaryDataReader(sectionData.buffer)
    const objectSize = 44
    let objects = []

    for (let i = 0; i < r.length / objectSize; i++) {
        const targetData = r.readUByte()
        const attackEffectId = r.readUByte() // Attack effect id, always 0xFF. Isn't used for weapon in game
        const damageCalculationId = r.readUByte()
        const unknown1 = r.readUByte()
        const attackStrength = r.readUByte() //?
        const status = r.readUByte()
        const growthRate = r.readUByte()
        const criticalRate = r.readUByte()
        const accuracyRate = r.readUByte()
        const weaponModelId = r.readUByte() // Upper nybble, attack animation modifier (for Barret & Vincent only). Lower nybble, weapon model index
        const alignment = r.readUByte() // Alignment. Always 0xFF
        const highSoundId = r.readUByte() // Mask for access high sound id (0x100+)
        const cameraMovementId = r.readUShort() // Camera movement id, Always 0xFFFF
        const equipableBy = r.readUShort()
        const attackElements = r.readUShort()
        const unknown2 = r.readUShort()

        const boostedStat1 = r.readUByte()
        const boostedStat2 = r.readUByte()
        const boostedStat3 = r.readUByte()
        const boostedStat4 = r.readUByte()
        const boostedStat1Bonus = r.readUByte()
        const boostedStat2Bonus = r.readUByte()
        const boostedStat3Bonus = r.readUByte()
        const boostedStat4Bonus = r.readUByte()

        let materiaSlots = []
        for (let slot = 0; slot < 8; slot++) {
            const materiaSlotByte = r.readUByte()
            const materiaSlot = parseKernelEnums(Enums.MateriaSlot, materiaSlotByte)
            materiaSlots.push(materiaSlot)
        }

        const soundEffectIdNormalHit = r.readUByte() // These seem to match some common sounds, but not others, need to check. This goes to 0-255, but frog attack is 363,364 etc 
        const soundEffectIdNormalCritical = r.readUByte()
        const soundEffectIdNormalMiss = r.readUByte()
        const impactEffectId = r.readUByte()
        const specialAttack = r.readUShort() // Always 0xFFFF
        const restrictions = r.readUShort()


        let object = {
            index: i,
            itemId: i + 128,
            name: names[i],
            description: descriptions[i],
            targets: parseKernelEnums(Enums.TargetData, targetData),
            damageCalculationId: damageCalculationId,
            attackStrength: attackStrength,
            status: parseKernelEnums(Enums.EquipmentStatus, status), // Not sure if this is right, or if it should be inversed
            growthRate: parseKernelEnums(Enums.GrowthRate, growthRate),
            criticalRate: criticalRate,
            accuracyRate: accuracyRate,
            weaponModelId: weaponModelId, // Maybe split into nybbles if required
            highSoundId: highSoundId,
            equipableBy: parseKernelEnums(Enums.EquipableBy, equipableBy),
            attackElements: parseKernelEnums(Enums.Elements, attackElements), // Is this array of single?
            boostedStat1: parseKernelEnums(Enums.CharacterStat, boostedStat1),
            boostedStat2: parseKernelEnums(Enums.CharacterStat, boostedStat2),
            boostedStat3: parseKernelEnums(Enums.CharacterStat, boostedStat3),
            boostedStat4: parseKernelEnums(Enums.CharacterStat, boostedStat4),
            boostedStat1Bonus: boostedStat1Bonus,
            boostedStat2Bonus: boostedStat2Bonus,
            boostedStat3Bonus: boostedStat3Bonus,
            boostedStat4Bonus: boostedStat4Bonus,
            materiaSlots: materiaSlots,
            soundEffectIdNormalHit: soundEffectIdNormalHit,
            soundEffectIdNormalCritical: soundEffectIdNormalCritical,
            soundEffectIdNormalMiss: soundEffectIdNormalMiss,
            impactEffectId: impactEffectId,
            restrictions: parseKernelEnums(Enums.Restrictions, restrictions),
            specialAttack: parseKernelEnums(Enums.SpecialEffects, specialAttack),
            // unknown: {
            //     attackEffectId, unknown1, alignment, cameraMovementId, unknown2
            // }
        }
        // if (i < 2) {
        //     console.log('weapon', object)
        // }
        objects.push(object)
    }
    return objects
}
const getArmorSectionData = (sectionData, names, descriptions) => {
    let r = new FF7BinaryDataReader(sectionData.buffer)
    const objectSize = 36
    let objects = []

    for (let i = 0; i < r.length / objectSize; i++) {
        const unknown1 = r.readUByte()
        const elementDamageModifier = r.readUByte()
        const defense = r.readUByte()
        const magicDefense = r.readUByte()
        const evade = r.readUByte()
        const magicEvade = r.readUByte()
        const status = r.readUByte()
        const unknown2 = r.readUShort()
        let materiaSlots = []
        for (let slot = 0; slot < 8; slot++) {
            const materiaSlotByte = r.readUByte()
            const materiaSlot = parseKernelEnums(Enums.MateriaSlot, materiaSlotByte)
            materiaSlots.push(materiaSlot)
        }
        const growthRate = r.readUByte()
        const equipableBy = r.readUShort()
        const elementalDefense = r.readUShort()
        const unknown3 = r.readUShort()
        const boostedStat1 = r.readUByte()
        const boostedStat2 = r.readUByte()
        const boostedStat3 = r.readUByte()
        const boostedStat4 = r.readUByte()
        const boostedStat1Bonus = r.readUByte()
        const boostedStat2Bonus = r.readUByte()
        const boostedStat3Bonus = r.readUByte()
        const boostedStat4Bonus = r.readUByte()
        const restrictions = r.readUShort()
        const unknown4 = r.readUShort()

        let object = {
            index: i,
            itemId: i + 256,
            name: names[i],
            description: descriptions[i],
            elementDamageModifier: parseKernelEnums(Enums.DamageModifier, elementDamageModifier),//?
            defense: defense,
            magicDefense: magicDefense,
            evade: evade,
            magicEvade: magicEvade,
            status: parseKernelEnums(Enums.Statuses, status),
            materiaSlots: materiaSlots,
            growthRate: parseKernelEnums(Enums.GrowthRate, growthRate),
            equipableBy: parseKernelEnums(Enums.EquipableBy, equipableBy),
            elementalDefense: parseKernelEnums(Enums.Elements, elementalDefense),
            boostedStat1: parseKernelEnums(Enums.CharacterStat, boostedStat1),
            boostedStat2: parseKernelEnums(Enums.CharacterStat, boostedStat2),
            boostedStat3: parseKernelEnums(Enums.CharacterStat, boostedStat3),
            boostedStat4: parseKernelEnums(Enums.CharacterStat, boostedStat4),
            boostedStat1Bonus: boostedStat1Bonus,
            boostedStat2Bonus: boostedStat2Bonus,
            boostedStat3Bonus: boostedStat3Bonus,
            boostedStat4Bonus: boostedStat4Bonus,
            restrictions: parseKernelEnums(Enums.Restrictions, restrictions),
            // unknown: {
            //     unknown1, unknown2, unknown3, unknown4
            // }
        }
        objects.push(object)
    }
    return objects
}
const getAccessorySectionData = (sectionData, names, descriptions) => {
    let r = new FF7BinaryDataReader(sectionData.buffer)
    const objectSize = 16
    let objects = []

    for (let i = 0; i < r.length / objectSize; i++) {
        const boostedStat1 = r.readUByte()
        const boostedStat2 = r.readUByte()
        const boostedStat1Bonus = r.readUByte()
        const boostedStat2Bonus = r.readUByte()
        const elementDamageModifier = r.readUByte()
        const accessoryEffect = r.readUByte()
        const elements = r.readUShort()
        const status = r.readUInt() // 4 bytes? normally 2
        const equipableBy = r.readUShort()
        const restrictions = r.readUShort()

        let object = {
            index: i,
            itemId: i + 288,
            name: names[i],
            description: descriptions[i],
            boostedStat1: parseKernelEnums(Enums.CharacterStat, boostedStat1),
            boostedStat2: parseKernelEnums(Enums.CharacterStat, boostedStat2),
            boostedStat1Bonus: boostedStat1Bonus,
            boostedStat2Bonus: boostedStat2Bonus,
            elementDamageModifier: parseKernelEnums(Enums.DamageModifier, elementDamageModifier),
            accessoryEffect: parseKernelEnums(Enums.AccessoryEffect, accessoryEffect),
            elements: parseKernelEnums(Enums.Elements, elements),
            status: parseKernelEnums(Enums.Statuses, status),
            equipableBy: parseKernelEnums(Enums.EquipableBy, equipableBy),
            restrictions: parseKernelEnums(Enums.Restrictions, restrictions),

        }
        objects.push(object)
    }
    return objects
}
const getMateriaSectionData = (sectionData, names, descriptions) => {
    let r = new FF7BinaryDataReader(sectionData.buffer)
    const objectSize = 20
    let objects = []

    for (let i = 0; i < r.length / objectSize; i++) {
        if (i < 2) {
            // console.log('offset start', r.offset)
        }
        // const apLimits = r.readUShortArray(4)
        const level2Ap = r.readUShort()
        const level3Ap = r.readUShort()
        const level4Ap = r.readUShort()
        const level5Ap = r.readUShort()
        const equipEffect = r.readUByte()
        const statusEffect = r.readUInt() >>> 8 // Should only read first 24 bits
        r.offset = r.offset - 1
        const element = r.readUByte()
        const materiaType = r.readUByte()
        const materiaAttribute = r.readUByteArray(6)
        const materiaData = parseMateriaData(materiaType, materiaAttribute, equipEffect)

        let object = {
            index: i,
            name: names[i],
            description: descriptions[i],

            level2Ap: level2Ap * 100, // Some materia can't be levelled, master summon etc, think of a way to flag this, probably here
            level3Ap: level3Ap * 100,
            level4Ap: level4Ap * 100,
            level5Ap: level5Ap * 100,
            statusEffect: parseKernelEnums(Enums.Statuses, statusEffect), // Not sure this is really giving what we want, eg Fire === 0
            element: parseKernelEnums(Enums.MateriaElements, element),

            type: materiaData.type
            // TODO - Lots more materiaData based attributes, see `kernel-enums.parseMateriaData(...)`
        }
        objects.push(object)
        // if (i < 2) {
        //     console.log('----')
        //     console.log(object)
        // }
    }
    return objects
}

const extractWindowBinElements = async (fileId, outputKernelDirectory, metadataDirectory) => {

    // console.log('extractWindowBinElements: START', fileId)

    const basePalette = 1
    const baseFile = path.join(outputKernelDirectory, `window.bin_${fileId}_${basePalette}.png`)
    let metadata = await (sharp(baseFile).metadata())
    // console.log('metadata', metadata)
    const outputDirMetaDataWindow = path.join(metadataDirectory, 'window-assets')

    if (!fs.existsSync(outputDirMetaDataWindow)) {
        fs.ensureDirSync(outputDirMetaDataWindow)
    }
    let img = sharp({
        create: {
            width: metadata.width,
            height: metadata.height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    }).png()


    const windowBinAssetMap = await fs.readJson(`../metadata/kernel/window.bin_${fileId}_asset-map.json`)
    // console.log('windowBinAssetMap', windowBinAssetMap)

    // console.log('created', metadata)
    let overviewCompositionActions = []
    for (var assetType in windowBinAssetMap) {
        // I was going to simply loop, but need to deal with variable width fonts, plus having the metadata to get the correct widths
        // I'll leave this in, but it's not triggered by the data as I pregenerated it
        if (!Array.isArray(windowBinAssetMap[assetType]) && windowBinAssetMap[assetType].type && windowBinAssetMap[assetType].type === 'text') {
            const textConfig = windowBinAssetMap[assetType]
            let elements = []
            let i = 0

            for (let col = 0; col < textConfig.cols; col++) {
                for (let row = 0; row < textConfig.rows; row++) {
                    let x = textConfig.x + (row * textConfig.w)
                    let y = textConfig.y + (col * textConfig.h)
                    // console.log({ "id": 0, "description": "battle menu text 192", "x": 128, "y": 248, "w": 8, "h": 8, "palette": 8 })
                    i++
                }
            }
            windowBinAssetMap[assetType] = elements
        }
        if (assetType === 'battle-menu-text-large') {
            // console.log('battle-menu-text-large')
            const colorElements = []
            for (let i = 0; i < windowBinAssetMap[assetType].length; i++) {
                const element = windowBinAssetMap[assetType][i]
                // console.log('element for color', element)
                for (let j = 0; j < element.colors.length; j++) {
                    const color = element.colors[j][0]
                    const palette = element.colors[j][1]
                    const colorElement = { ...element }
                    delete colorElement.colors
                    colorElement.palette = palette
                    colorElement.description = `${colorElement.description} ${color}`
                    colorElement.color = color
                    colorElements.push(colorElement)
                    // console.log('colorElements', colorElements)
                }
            }
            windowBinAssetMap[assetType] = colorElements
        }

        for (let i = 0; i < windowBinAssetMap[assetType].length; i++) {
            const element = windowBinAssetMap[assetType][i]
            // console.log('element', element)
            const elementFile = path.join(outputKernelDirectory, `window.bin_${fileId}_${element.palette}.png`)
            const elementFileExtract = sharp(elementFile).extract({ left: element.x, top: element.y, width: element.w, height: element.h })
            const elementFileBuffer = await elementFileExtract.toBuffer()
            overviewCompositionActions.push({ input: elementFileBuffer, left: element.x, top: element.y })


            const assetFolder = path.join(outputDirMetaDataWindow, assetType)
            if (!fs.existsSync(assetFolder)) {
                fs.ensureDirSync(assetFolder)
            }
            elementFileExtract.resize({ width: element.w * 4, height: element.h * 4, kernel: sharp.kernel.nearest })
            await elementFileExtract.toFile(path.join(assetFolder, `${element.description}.png`))

            if (overviewCompositionActions.length === 100) { // For some reason 150+ layers is causing issues <- nope, just nodemon
                img.composite(overviewCompositionActions)
                let compositeAppliedImg = await img.toBuffer()
                img = sharp(compositeAppliedImg)
                overviewCompositionActions = []
            }
        }
    }

    // Some layers missing black textures
    img.composite(overviewCompositionActions)

    await img.toFile(path.join(outputDirMetaDataWindow, `window.bin_${fileId}_overview.png`))
    // console.log('extractWindowBinElements: END')
    return windowBinAssetMap
}
module.exports = {
    getTextSectionData,
    getItemSectionData,
    getWeaponSectionData,
    getArmorSectionData,
    getAccessorySectionData,
    getMateriaSectionData,
    extractWindowBinElements,
    dec2bin,
    dec2hex
}