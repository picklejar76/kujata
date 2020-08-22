
const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js")

const { Enums, parseKernelEnums } = require('./kernel-enums')
const { dec2hex, dec2bin } = require('./kernel-sections')

const getCharacterRecord = (r) => {
    const id = r.readByte()

    const currentLevel = r.readByte()
    const strength = r.readByte()
    const vitality = r.readByte()
    const magic = r.readByte()
    const spirit = r.readByte()
    const dexterity = r.readByte()
    const luck = r.readByte()

    const strengthBonus = r.readByte()
    const vitalityBonus = r.readByte()
    const magicBonus = r.readByte()
    const spiritBonus = r.readByte()
    const dexterityBonus = r.readByte()
    const luckBonus = r.readByte()

    const currentLimitLevel = r.readByte() //1-4
    const currentLimitBar = r.readByte()
    const name = r.readKernelString(12)
    r.offset = r.offset + 12 // readKernelString doesn't move the buffer position
    const weapon = r.readByte()
    const armor = r.readByte()
    const accessory = r.readByte()

    const statusFlags = parseKernelEnums(Enums.Character.Flags, r.readByte()) // 0x10-Sadness 0x20-Fury 
    const battleOrder = parseKernelEnums(Enums.Character.Order, r.readByte()) // 0xFF-Normal 0xFE-Back row 
    const levelProgressBar = r.readByte() // (0-63) Games Gui Hides Values <4 4-63 are visible as "progress"
    const learnedLimitSkils = parseKernelEnums(Enums.Character.LearnedLimits, r.readShort())
    const noOfKills = r.readShort()
    const limit11Used = r.readShort()
    const limit21Used = r.readShort()
    const limit31Used = r.readShort()

    const currentHP = r.readShort()
    const baseHP = r.readShort()
    const currentMP = r.readShort()
    const baseMP = r.readShort()
    const unknown1 = r.readInt()
    const maximumHP = r.readShort()
    const maximumMP = r.readShort()
    const currentEXP = r.readInt()

    const weaponMateria1 = r.readInt()
    const weaponMateria2 = r.readInt()
    const weaponMateria3 = r.readInt()
    const weaponMateria4 = r.readInt()
    const weaponMateria5 = r.readInt()
    const weaponMateria6 = r.readInt()
    const weaponMateria7 = r.readInt()
    const weaponMateria8 = r.readInt()

    const armorMateria1 = r.readInt()
    const armorMateria2 = r.readInt()
    const armorMateria3 = r.readInt()
    const armorMateria4 = r.readInt()
    const armorMateria5 = r.readInt()
    const armorMateria6 = r.readInt()
    const armorMateria7 = r.readInt()
    const armorMateria8 = r.readInt()

    const nextLevelEXP = r.readInt()

    const characterRecord = {
        id: id,
        name: name,
        level: {
            current: currentLevel,
            progressBar: levelProgressBar,
            currentEXP,
            nextLevelEXP
        },
        stats: {
            hp: {
                current: currentHP,
                base: baseHP,
                max: maximumHP
            },
            mp: {
                current: currentMP,
                base: baseMP,
                max: maximumMP
            },
            strength,
            vitality,
            magic,
            spirit,
            dexterity,
            luck,
            strengthBonus,
            vitalityBonus,
            magicBonus,
            spiritBonus,
            dexterityBonus,
            luckBonus,
        },
        limit: {
            level: currentLimitLevel,
            bar: currentLimitBar,
            learnedLimitSkils,
            limit11Used,
            limit21Used,
            limit31Used
        },
        equip: {
            weapon,
            armor,
            accessory
        },
        materia: {
            weaponMateria1,
            weaponMateria2,
            weaponMateria3,
            weaponMateria4,
            weaponMateria5,
            weaponMateria6,
            weaponMateria7,
            weaponMateria8,
            armorMateria1,
            armorMateria2,
            armorMateria3,
            armorMateria4,
            armorMateria5,
            armorMateria6,
            armorMateria7,
            armorMateria8
        },
        status: {
            statusFlags,
            battleOrder,
            noOfKills
        }
    }
    // console.log('characterRecord', characterRecord)
    return characterRecord
}
const getItemStock = (r, itemNames, itemDescriptions) => { // 320 x 2 bytes
    let items = []
    for (let i = 0; i < 320; i++) {
        const itemBinary = r.readShort()
        const id = itemBinary & 0b1111111
        const quantity = itemBinary >> 9
        const item = {
            id,
            quantity,
            name: itemNames[id],
            description: itemDescriptions[id]
        }
        items.push(item)
    }
    return items
}
const getMateria = (r, materiaNames, materiaDescriptions) => {
    // console.log('getMateria', r.offset, dec2hex(r.offset + 84))
    const id = r.readUByte()
    const ap = r.read24bitInteger()
    const materia = {
        id,
        ap,
        name: materiaNames[id],
        description: materiaDescriptions[id]
    }
    // materia.id = 44 // Enemy Skills materia uses the 24 bits as flags for each skill, should consider adding this here
    // if (materia.id === 0x2C) {
    //     console.log('enemy skill')
    //     materia.skillFlags = dec2bin(ap)
    // }
    // console.log('materia', materia)
    return materia
}
const getMateriaStock = (r, count, materiaNames, materiaDescriptions) => { // 200 x 4 bytes
    let materias = []
    for (let i = 0; i < count; i++) {
        const materia = getMateria(r, materiaNames, materiaDescriptions)
        materias.push(materia)
    }
    return materias
}
const getInitSectionData = (sectionData, itemNames, itemDescriptions, materiaNames, materiaDescriptions) => {
    // Output the raw kernel data as the different consumers might want the data stored differently as this will be opinionated
    // 2876 bytes, although, I believe it should be 0x0BA4 - 0x0054 (2896 bytes), investigate when putting the data together
    const raw = sectionData.buffer.toString('base64')

    const savePreview = {
        level: 0,
        portrait1: 0,
        portrait2: 0,
        portrait3: 0,
        name: '',
        currentHP: 0,
        maximumHP: 0,
        currentMP: 0,
        maximumMP: 0,
        gil: 0,
        seconds: 0,
        location: ''
    }
    const r = new FF7BinaryDataReader(sectionData.buffer)

    const windowColorTL = [0, 88, 176]
    const windowColorTR = [0, 0, 80]
    const windowColorBL = [0, 0, 128]
    const windowColorBR = [0, 0, 32]

    const cloud = getCharacterRecord(r)
    const barret = getCharacterRecord(r)
    const tifa = getCharacterRecord(r)
    const aeris = getCharacterRecord(r)
    const redxiii = getCharacterRecord(r)
    const yuffie = getCharacterRecord(r)
    const caitsith = getCharacterRecord(r)
    const vincent = getCharacterRecord(r)
    const cid = getCharacterRecord(r)

    const partySlot1 = r.readUByte()
    const partySlot2 = r.readUByte()
    const partySlot3 = r.readUByte()
    const alignment = r.readUByte()

    // console.log('items', r.offset, dec2hex(r.offset + 84))
    const items = getItemStock(r, itemNames, itemDescriptions)
    // console.log('materia', r.offset, dec2hex(r.offset + 84))
    const materia = getMateriaStock(r, 200, materiaNames, materiaDescriptions)
    // console.log('stolenMateria', r.offset, dec2hex(r.offset + 84))
    const stolenMateria = getMateriaStock(r, 48, materiaNames, materiaDescriptions)

    // console.log('z_3', r.offset, dec2hex(r.offset + 84))
    const z_3 = r.readUByteArray(32)
    const gil = r.readUInt()
    const secondsPlayed = r.readUInt()
    const countdownSeconds = r.readUInt()


    // Not enough bytes left to complete from initial data ???!!!

    // console.log('z_40', r.offset, dec2hex(r.offset + 84), r.length - r.offset)
    const z_4 = r.readUByteArray(8) // Should be 12 according to http://wiki.ffrtt.ru/index.php?title=FF7/Savemap
    const secondsPlayedFractions = 0xFFFFFFFF
    const countdownSecondsFractions = 0xFFFFFFFF
    const currentMapValue = 2 // Field 2, world map 0
    const currentModule = 1 // Field 1, world map 2
    const currentLocation = 0
    const alignment2 = 0
    const fieldXPos = 0
    const fieldYPos = 0
    const fieldTriangle = 0
    const fieldDirection = 0
    const z_6 = 0
    const fieldEncounterTimer = 0 // http://forums.qhimm.com/index.php?topic=6431
    const fieldEncounterOffset = 0
    const alignment3 = 0

    // Lots of field script memory 0x0BA4 -> 0x0FA4
    const banks = { // Need to think how we should initialise these / access it with bytes and shorts in the same data structure
        bank1: new Uint8Array(256).fill(0), //  1/2
        bank2: new Uint8Array(256).fill(0), //  3/4
        bank3: new Uint8Array(256).fill(0), //  B/C
        bank4: new Uint8Array(256).fill(0), //  D/E
        bank5: new Uint8Array(256).fill(0) //  7/F
    }

    // Then 0x10A4 - These can all be done in a better way
    const PHSLockingMask = [0, 0, 0, 0, 0, 0, 0, 0, 0]
    const PHSVisibilityMask = [0, 0, 0, 0, 0, 0, 0, 0, 0]
    const z_39 = 0

    const battleSpeed = 0x7E
    const battleMessageSpeed = 0x7E
    const sound = { Mono: false, Stereo: true }
    const controller = { Normal: true, Customise: false }
    const cursor = { Initial: true, Memory: false }
    const atb = { Active: true, Recommended: false, Wait: false }
    const cameraAngle = { Auto: true, Fixed: false }
    const magicOrder = {
        RestoreAttackIndirect: true,
        RestoreIndirectAttack: false,
        AttackIndirectRestore: false,
        AttackRestoreIndirect: false,
        IndirectRestoreAttack: false,
        IndirectAttackRestore: false
    }
    const battleDescriptions = { Inactive: true, Active: false }
    const fieldMessageSpeed = 0x7E

    const z_40 = 0

    const data = {
        savePreview,
        characterRecords: {
            cloud,
            barret,
            tifa,
            aeris,
            redxiii,
            yuffie,
            caitsith,
            vincent,
            cid
        },
        party: {
            slot1: partySlot1,
            slot2: partySlot2,
            slot3: partySlot3,
            PHSLockingMask,
            PHSVisibilityMask
        },
        gil,
        items,
        materia,
        stolenMateria,
        time: {
            secondsPlayed,
            countdownSeconds,
            secondsPlayedFractions,
            countdownSecondsFractions
        },
        location: {
            currentMapValue,
            currentModule,
            currentLocation,
            fieldXPos,
            fieldYPos,
            fieldTriangle,
            fieldDirection,
            fieldEncounterTimer,
            fieldEncounterOffset
        },
        config: {
            windowColorTL,
            windowColorTR,
            windowColorBL,
            windowColorBR,
            battleSpeed,
            battleMessageSpeed,
            fieldMessageSpeed,
            sound,
            controller,
            cursor,
            atb,
            cameraAngle,
            magicOrder,
            battleDescriptions
        },
        banks
    }

    for (let i = 0; i < 2; i++) {

    }

    return { raw, data }
}
module.exports = {
    getInitSectionData
}