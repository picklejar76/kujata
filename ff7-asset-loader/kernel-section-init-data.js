
const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js")

const { Enums, parseKernelEnums } = require('./kernel-enums')
const { dec2hex, dec2bin } = require('./kernel-sections')

const getCharacterRecord = (r, materiaNames, materiaDescriptions, weaponNames, weaponDescriptions, armorNames, armorDescriptions, accessoryNames, accessoryDescriptions) => {
    const id = r.readUByte()

    const currentLevel = r.readUByte()
    const strength = r.readUByte()
    const vitality = r.readUByte()
    const magic = r.readUByte()
    const spirit = r.readUByte()
    const dexterity = r.readUByte()
    const luck = r.readUByte()

    const strengthBonus = r.readUByte()
    const vitalityBonus = r.readUByte()
    const magicBonus = r.readUByte()
    const spiritBonus = r.readUByte()
    const dexterityBonus = r.readUByte()
    const luckBonus = r.readUByte()

    const currentLimitLevel = r.readUByte() //1-4
    const currentLimitBar = r.readUByte()
    const name = r.readKernelString(12)
    r.offset = r.offset + 12 // readKernelString doesn't move the buffer position
    const weapon = getWeapon(r, weaponNames, weaponDescriptions)
    const armor = getWeapon(r, armorNames, armorDescriptions)
    const accessory = getWeapon(r, accessoryNames, accessoryDescriptions)

    const statusFlags = parseKernelEnums(Enums.Character.Flags, r.readUByte()) // 0x10-Sadness 0x20-Fury 
    const battleOrderRaw = r.readUByte() // 0xFF-Normal 0xFE-Back row
    const battleOrder = parseKernelEnums(Enums.Character.Order, battleOrderRaw) // 0xFF-Normal 0xFE-Back row 
    const levelProgressBar = r.readUByte() // (0-63) Games Gui Hides Values <4 4-63 are visible as "progress"
    const learnedLimitSkils = parseKernelEnums(Enums.Character.LearnedLimits, r.readUShort())
    const noOfKills = r.readUShort()
    const limit11Used = r.readUShort()
    const limit21Used = r.readUShort()
    const limit31Used = r.readUShort()

    const currentHP = r.readUShort()
    const baseHP = r.readUShort()
    const currentMP = r.readUShort()
    const baseMP = r.readUShort()
    const unknown1 = r.readUInt()
    const maximumHP = r.readUShort()
    const maximumMP = r.readUShort()
    const currentEXP = r.readUInt()

    const weaponMateria1 = getMateria(r, materiaNames, materiaDescriptions)
    const weaponMateria2 = getMateria(r, materiaNames, materiaDescriptions)
    const weaponMateria3 = getMateria(r, materiaNames, materiaDescriptions)
    const weaponMateria4 = getMateria(r, materiaNames, materiaDescriptions)
    const weaponMateria5 = getMateria(r, materiaNames, materiaDescriptions)
    const weaponMateria6 = getMateria(r, materiaNames, materiaDescriptions)
    const weaponMateria7 = getMateria(r, materiaNames, materiaDescriptions)
    const weaponMateria8 = getMateria(r, materiaNames, materiaDescriptions)

    const armorMateria1 = getMateria(r, materiaNames, materiaDescriptions)
    const armorMateria2 = getMateria(r, materiaNames, materiaDescriptions)
    const armorMateria3 = getMateria(r, materiaNames, materiaDescriptions)
    const armorMateria4 = getMateria(r, materiaNames, materiaDescriptions)
    const armorMateria5 = getMateria(r, materiaNames, materiaDescriptions)
    const armorMateria6 = getMateria(r, materiaNames, materiaDescriptions)
    const armorMateria7 = getMateria(r, materiaNames, materiaDescriptions)
    const armorMateria8 = getMateria(r, materiaNames, materiaDescriptions)

    const nextLevelEXP = r.readUInt()

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

const getWeapon = (r, weaponNames, weaponDescriptions) => {
    const id = r.readUByte()
    return {
        id,
        name: weaponNames[id],
        description: weaponDescriptions[id]
    }
}
const getArmor = (r, armorNames, armorDescriptions) => {
    const id = r.readUByte()
    return {
        id,
        name: armorNames[id],
        description: armorDescriptions[id]
    }
}
const getAccessory = (r, accessoryNames, accessoryDescriptions) => {
    const id = r.readUByte()
    return {
        id,
        name: accessoryNames[id],
        description: accessoryDescriptions[id]
    }
}
const getItem = (r, itemNames, itemDescriptions) => {
    const itemBinary = r.readUShort()
    const id = itemBinary & 0b1111111
    const quantity = itemBinary >> 9
    const item = {
        id,
        quantity,
        name: itemNames[id],
        description: itemDescriptions[id]
    }
    return item
}
const getItemStock = (r, itemNames, itemDescriptions) => { // 320 x 2 bytes
    let items = []
    for (let i = 0; i < 320; i++) {
        const item = getItem(r, itemNames, itemDescriptions)
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
const getInitSectionData = (sectionData, itemNames, itemDescriptions, materiaNames, materiaDescriptions, weaponNames, weaponDescriptions, armorNames, armorDescriptions, accessoryNames, accessoryDescriptions) => {
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

    const cloud = getCharacterRecord(r, materiaNames, materiaDescriptions, weaponNames, weaponDescriptions, armorNames, armorDescriptions, accessoryNames, accessoryDescriptions)
    const barret = getCharacterRecord(r, materiaNames, materiaDescriptions, weaponNames, weaponDescriptions, armorNames, armorDescriptions, accessoryNames, accessoryDescriptions)
    const tifa = getCharacterRecord(r, materiaNames, materiaDescriptions, weaponNames, weaponDescriptions, armorNames, armorDescriptions, accessoryNames, accessoryDescriptions)
    const aeris = getCharacterRecord(r, materiaNames, materiaDescriptions, weaponNames, weaponDescriptions, armorNames, armorDescriptions, accessoryNames, accessoryDescriptions)
    const redxiii = getCharacterRecord(r, materiaNames, materiaDescriptions, weaponNames, weaponDescriptions, armorNames, armorDescriptions, accessoryNames, accessoryDescriptions)
    const yuffie = getCharacterRecord(r, materiaNames, materiaDescriptions, weaponNames, weaponDescriptions, armorNames, armorDescriptions, accessoryNames, accessoryDescriptions)
    const caitsith = getCharacterRecord(r, materiaNames, materiaDescriptions, weaponNames, weaponDescriptions, armorNames, armorDescriptions, accessoryNames, accessoryDescriptions)
    const vincent = getCharacterRecord(r, materiaNames, materiaDescriptions, weaponNames, weaponDescriptions, armorNames, armorDescriptions, accessoryNames, accessoryDescriptions)
    const cid = getCharacterRecord(r, materiaNames, materiaDescriptions, weaponNames, weaponDescriptions, armorNames, armorDescriptions, accessoryNames, accessoryDescriptions)

    // Not sure why, but this initially this says Barret, Tifa and Cloud
    let partySlot1 = parseKernelEnums(Enums.Character.PartyMember, r.readUByte())
    let partySlot2 = parseKernelEnums(Enums.Character.PartyMember, r.readUByte())
    let partySlot3 = parseKernelEnums(Enums.Character.PartyMember, r.readUByte())
    const alignment = r.readUByte()

    // console.log('items', r.offset, dec2hex(r.offset + 84))
    const items = getItemStock(r, itemNames, itemDescriptions)
    // console.log('materia', r.offset, dec2hex(r.offset + 84))
    const materias = getMateriaStock(r, 200, materiaNames, materiaDescriptions)
    // console.log('stolenMateria', r.offset, dec2hex(r.offset + 84))
    const stolenMaterias = getMateriaStock(r, 48, materiaNames, materiaDescriptions)

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
    const PHSLockingMask = [1, 0, 0, 0, 0, 0, 0, 0, 0]
    const PHSVisibilityMask = [1, 0, 0, 0, 0, 0, 0, 0, 0]
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
        characters: {
            Cloud: cloud,
            Barret: barret,
            Tifa: tifa,
            Aeris: aeris,
            RedXIII: redxiii,
            Yuffie: yuffie,
            CaitSith: caitsith,
            Vincent: vincent,
            Cid: cid
        },
        party: {
            // Not 100% sure, but need to hold the menu order separately
            // or assume this is also the menu order and the leader is assumed from a list of current members
            // or that there is somewhere specifying the current leader
            members: [partySlot1, partySlot2, partySlot3],
            phsLocked: { // eg MMBLK,MMBUK
                Cloud: PHSLockingMask[0], // Should really be enabled by default, cant see where in md1stin
                Barret: PHSLockingMask[1],
                Tifa: PHSLockingMask[2],
                Aeris: PHSLockingMask[3],
                RedXIII: PHSLockingMask[4],
                Yuffie: PHSLockingMask[5],
                CaitSith: PHSLockingMask[6],
                Vincent: PHSLockingMask[7],
                Cid: PHSLockingMask[8]
            },
            phsVisibility: { // not sure what op code changes this
                Cloud: PHSVisibilityMask[0], // Should really be enabled by default, cant see where in md1stin
                Barret: PHSVisibilityMask[1],
                Tifa: PHSVisibilityMask[2],
                Aeris: PHSVisibilityMask[3],
                RedXIII: PHSVisibilityMask[4],
                Yuffie: PHSVisibilityMask[5],
                CaitSith: PHSVisibilityMask[6],
                Vincent: PHSVisibilityMask[7],
                Cid: PHSVisibilityMask[8]
            },
            characterAvailability: {  // eg MMBud, although, I can't see a memory location for this
                Cloud: 1, // Can't see that MMBud is ever called for cloud, setting it to 1 by default
                Barret: 0,
                Tifa: 0,
                Aeris: 0,
                RedXIII: 0,
                Yuffie: 0,
                CaitSith: 0,
                Vincent: 0,
                Cid: 0,
            },
        },
        gil,
        items,
        materias,
        stolenMaterias,
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