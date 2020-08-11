const Enums = {
    SpecialEffects: {
        DamageMP: 0x1, // Damage is dealt to targets MP instead of HP.
        ForcePhysical: 0x4,// The attack is always considered to be physical for damage calculation.
        DrainPartialInflictedDamage: 0x10,// The user should recover some HP based on the damage dealt.
        DrainHPAndMP: 0x20, // The user should recover some HP and MP based on damage dealt.
        DiffuseAttack: 0x40, // The attack should diffuse into other targets after hitting. This is no longer used and is thought to only have been used with Blade Beam.
        IgnoreStatusDefense: 0x80, // Ignores the target's status defense when calculating infliction chance.
        MissWhenTargetNotDead: 0x100, // For targetting dead or undead characters only. (Phoenix Down/Life/etc)
        CanReflect: 0x200, // This ability can be reflected using the Reflect status
        BypassDefense: 0x400, // Piercing damage that ignores the normal damage calculation
        DontAutoRetargetWhenOriginalTargetKilled: 0x800,// The ability should not automatically move to the next viable target if the intended target is no longer viable.
        AlwaysCritical: 0x2000 // This attack is always a critical hit. (Death Blow)
    },
    Elements: {
        Fire: 0x0001,
        Ice: 0x0002,
        Bolt: 0x0004,
        Earth: 0x0008,
        Poison: 0x0010,
        Gravity: 0x0020,
        Water: 0x0040,
        Wind: 0x0080,
        Holy: 0x0100,
        Restorative: 0x0200,
        Cut: 0x0400,
        Hit: 0x0800,
        Punch: 0x1000,
        Shoot: 0x2000,
        Shout: 0x4000,
        Hidden: 0x8000,
    },
    MateriaElements: {
        Fire: 0x00,
        Ice: 0x01,
        Bolt: 0x02,
        Earth: 0x03,
        Poison: 0x04,
        Gravity: 0x05,
        Water: 0x06,
        Wind: 0x07,
        Holy: 0x08,
        Restorative: 0x09,
        Cut: 0x0A,
        Hit: 0x0B,
        Punch: 0x0C,
        Shoot: 0x0D,
        Shout: 0x0E,
        Hidden: 0x0F,
    },
    Statuses: {
        Death: 0x00000001,
        NearDeath: 0x00000002,
        Sleep: 0x00000004,
        Poison: 0x00000008,
        Sadness: 0x00000010,
        Fury: 0x00000020,
        Confusion: 0x00000040,
        Silence: 0x00000080,
        Haste: 0x00000100,
        Slow: 0x00000200,
        Stop: 0x00000400,
        Frog: 0x00000800,
        Small: 0x00001000,
        SlowNumb: 0x00002000,
        Petrify: 0x00004000,
        Regen: 0x00008000,
        Barrier: 0x00010000,
        MBarrier: 0x00020000,
        Reflect: 0x00040000,
        Dual: 0x00080000,
        Shield: 0x00100000,
        DeathSentence: 0x00200000,
        Manipulate: 0x00400000,
        Berserk: 0x00800000,
        Peerless: 0x01000000,
        Paralysis: 0x02000000,
        Darkness: 0x04000000,
        DualDrain: 0x08000000,
        DeathForce: 0x10000000,
        Resist: 0x20000000,
        LuckyGirl: 0x40000000,
        Imprisoned: 0x80000000,
    },

    EquipmentStatus: {
        Death: 0x00,
        NearDeath: 0x01,
        Sleep: 0x02,
        Poison: 0x03,
        Sadness: 0x04,
        Fury: 0x05,
        Confusion: 0x06,
        Silence: 0x07,
        Haste: 0x08,
        Slow: 0x09,
        Stop: 0x0A,
        Frog: 0x0B,
        Small: 0x0C,
        SlowNumb: 0x0D,
        Petrify: 0x0E,
        Regen: 0x0F,
        Barrier: 0x10,
        MBarrier: 0x11,
        Reflect: 0x12,
        Dual: 0x13,
        Shield: 0x14,
        DeathSentence: 0x15,
        Manipulate: 0x16,
        Berserk: 0x17,
        Peerless: 0x18,
        Paralysis: 0x19,
        Darkness: 0x1A,
        DualDrain: 0x1B,
        DeathForce: 0x1C,
        Resist: 0x1D,
        LuckyGirl: 0x1E,
        Imprisoned: 0x1F,
    },
    TargetData: {
        EnableSelection: 0x01, // Cursor will move to the battle field and a target can be selected from valid targets as per additional constraints
        StartCursorOnEnemyRow: 0x02, // Cursor will start on the first enemy row.
        DefaultMultipleTargets: 0x04, // Cursor will select all targets in a given row.
        ToggleSingleMultiTarget: 0x08, // Caster can switch cursor between multiple targets or single targets. (Also indicates if damage will be split among targets)
        SingleRowOnly: 0x10, // Cursor will only target allies or enemies as defined in <see cref="StartCursorOnEnemyRow"/> and cannot be moved from the row.
        ShortRange: 0x20, // If the target or the caster is not in the front of their row, the target will take half damage. For every attack this is enabled, they are constrained by the Binary "Cover Flags"
        AllRows: 0x40, // Cursor will select all viable targets
        RandomTarget: 0x80// When multiple targets are selected, one will be selected at random to be the receiving target. Cursor will cycle among all viable targets.
    },
    ConditionSubMenu: {
        PartyHP: 0x00,
        PartyMP: 0x01,
        PartyStatus: 0x02,
        None: 0xFF
    },
    AccessoryEffect: {
        None: 0xFF,
        Haste: 0x0,
        Berserk: 0x1,
        CurseRing: 0x2,
        Reflect: 0x3,
        IncreasedStealingRate: 0x4,
        IncreasedManipulationRate: 0x5,
        Wall: 0x6
    },
    CharacterStat: {
        None: 0xFF,
        Strength: 0,
        Vitality: 1,
        Magic: 2,
        Spirit: 3,
        Dexterity: 4,
        Luck: 5
    },
    DamageModifier: {
        Absorb: 0x0,
        Nullify: 0x1,
        Halve: 0x2,
        Normal: 0xFF
    },
    EquipableBy: {
        Cloud: 0x0001,
        Barret: 0x0002,
        Tifa: 0x0004,
        Aeris: 0x0008,
        RedXIII: 0x0010,
        Yuffie: 0x0020,
        CaitSith: 0x0040,
        Vincent: 0x0080,
        Cid: 0x0100,
        YoungCloud: 0x0200,
        Sephiroth: 0x0400
    },
    GrowthRate: {
        None: 0,
        Normal: 1,
        Double: 2,
        Triple: 3
    },
    MateriaSlot: {
        None: 0, // No materia slot.
        EmptyUnlinkedSlot: 1, // Unlinked slot without materia growth.
        EmptyLeftLinkedSlot: 2, // Left side of a linked slot without materia growth.
        EmptyRightLinkedSlot: 3, // Right side of a linked slot without materia growth.
        NormalUnlinkedSlot: 5, // Unlinked slot with materia growth.
        NormalLeftLinkedSlot: 6, // Left side of a linked slot with materia growth.
        NormalRightLinkedSlot: 7 // Right side of a linked slot with materia growth.
    },

    Restrictions: {
        CanBeSold: 1,
        CanBeUsedInBattle: 2,
        CanBeUsedInMenu: 4
    },
    MateriaType: {
        Independent: 'Independent',
        Support: 'Support',
        Magic: 'Magic',
        Summon: 'Summon',
        Command: 'Command'
    }
}

const getMateriaType = (materiaTypeData) => {
    const lowerNybble = (materiaTypeData & 0x0F)
    let baseType
    switch (lowerNybble) {
        case 0x2: case 0x3: case 0x6: case 0x7: case 0x8:
            baseType = Enums.MateriaType.Command
            break
        case 0x5:
            baseType = Enums.MateriaType.Support
            break
        case 0x9: case 0xA:
            baseType = Enums.MateriaType.Magic
            break
        case 0xB: case 0xC:
            baseType = Enums.MateriaType.Summon
            break
        case 0x0: case 0x1: case 0x4: case 0xD: case 0xE: case 0xF: default:
            baseType = Enums.MateriaType.Independent
            break
    }
    return baseType
}
const parseMateriaData = (materiaType, materiaAttribute, equipEffect) => {
    const type = getMateriaType(materiaType)

    // TODO - There are a lot more options that should also be included - http://wiki.ffrtt.ru/index.php?title=FF7/Materia_Types

    return {
        type
    }
}
const parseKernelEnums = (type, val) => {

    const singleResultTypes = [Enums.GrowthRate, Enums.MateriaSlot, Enums.CharacterStat, Enums.ConditionSubMenu, Enums.Elements, Enums.MateriaElements, Enums.DamageModifier, Enums.AccessoryEffect]
    const inverseBitTypes = [Enums.SpecialEffects, Enums.Restrictions]

    if (type === Enums.MateriaType) {
        return getMateriaType(val) // Specific behaviour required, but it is nice to abstract it behind parseKernelEnums
    } else if (singleResultTypes.includes(type)) { // Is this exhaustive? Restrictions, CharacterStat, MateriaType?
        let text = 'None'
        for (var prop in type) {
            if (val === type[prop]) { // Id matching
                text = prop
            }
        }
        return text
    } else {
        let enums = []
        for (var prop in type) {

            if (inverseBitTypes.includes(type)) {
                if ((val & type[prop]) !== type[prop]) { // Bitwise matching, but inverse, eg 0 is on
                    enums.push(prop)
                }
            } else {
                if ((val & type[prop]) === type[prop]) { // Bitwise matching
                    enums.push(prop)
                }
            }

        }
        return enums
    }
}

module.exports = {
    Enums,
    parseKernelEnums,
    parseMateriaData
}