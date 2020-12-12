const fs = require('fs-extra')
const path = require('path')
let config = JSON.parse(fs.readFileSync('../../config.json', 'utf-8'));

let soundList = []

const addSound = (fieldName, entityId, entityName, scriptIndex, scriptType, lineNo, opType, soundId, direction) => {
    // console.log('addSound', fieldName, entityId, entityName, scriptIndex, scriptType, opType, soundId, direction)
    soundList.push({ fieldName, entityId, entityName, scriptIndex, scriptType, lineNo, opType, soundId, direction })
}
const writeSoundList = async () => {
    fs.writeJSON(path.join(config.metadataDirectory, 'sound-list.json'), soundList, { spaces: '\t' })
    console.log(`Identified ${soundList.length} sound invocations`)
}

const createSoundList = async () => {
    const fields = await fs.readdir(config.outputFieldFLevelDirectory)

    for (let i = 0; i < fields.length; i++) {
        const fieldFile = fields[i]
        console.log(`Processing field - ${fieldFile} - ${i + 1} of ${fields.length}`)
        const field = await fs.readJSON(path.join(config.outputFieldFLevelDirectory, fieldFile))
        if (field.script) {
            const entities = field.script.entities
            for (let j = 0; j < entities.length; j++) {
                const entity = entities[j]
                const scripts = entity.scripts
                for (let k = 0; k < scripts.length; k++) {
                    const script = scripts[k]
                    const ops = script.ops
                    for (let l = 0; l < ops.length; l++) {
                        const op = ops[l]
                        if (op.op === 'SOUND') {
                            // console.log('SOUND', op)
                            addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.i, op.d)
                        }
                        if (op.op === 'AKAO' || op.op === 'AKAO2') {
                            // console.log(op)
                            switch (op.akaoOp) {
                                case 32: case 36: // 0x20 0x24
                                    // Play one sound effect [param1=Panning, param2=Effect ID on channel #1]
                                    // playSound(p2, (p1 / 64) - 1, config.channel1)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p2, op.p1)
                                    break
                                case 33: case 37: // 0x21 0x25
                                    // Play two sound effects [param1=Panning, param2=Effect ID on channel #1, param3=Effect ID on channel #2]
                                    // playSound(p2, (p1 / 64) - 1, config.channel1)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p2, op.p1)
                                    // playSound(p3, (p1 / 64) - 1, config.channel2)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p3, op.p1)
                                    break
                                case 34: case 38: // 0x22 0x26 // Not used in fields
                                    // Play three sound effects [param1=Panning, param2=Effect ID on channel #1, param3=Effect ID on channel #2, param4=Effect ID on channel #3]
                                    // playSound(p2, (p1 / 64) - 1, config.channel1)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p2, op.p1)
                                    // playSound(p3, (p1 / 64) - 1, config.channel2)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p3, op.p1)
                                    // playSound(p4, (p1 / 64) - 1, config.channel3)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p4, op.p1)
                                    break
                                case 35: case 39: // 0x23 0x27
                                    // Play four sound effects [param1=Panning, param2=Effect ID on channel #1, param3=Effect ID on channel #2, param4=Effect ID on channel #3, param5=Effect ID on channel #4]
                                    // playSound(p2, (p1 / 64) - 1, config.channel1)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p2, op.p1)
                                    // playSound(p3, (p1 / 64) - 1, config.channel2)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p3, op.p1)
                                    // playSound(p4, (p1 / 64) - 1, config.channel3)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p4, op.p1)
                                    // playSound(p5, (p1 / 64) - 1, config.channel4)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p5, op.p1)
                                    break
                                case 40: // 0x28
                                    // Play a sound effect on channel #1 [param1=Panning, param2=Effect ID]
                                    // playSound(p2, (p1 / 64) - 1, config.channel1)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p2, op.p1)
                                    break
                                case 41: // 0x29
                                    // Play a sound effect on channel #2 [param1=Panning, param2=Effect ID]
                                    // playSound(p2, (p1 / 64) - 1, config.channel2)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p2, op.p1)
                                    break
                                case 42: // 0x2A
                                    // Play a sound effect on channel #3 [param1=Panning, param2=Effect ID]
                                    // playSound(p2, (p1 / 64) - 1, config.channel3)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p2, op.p1)
                                    break
                                case 43: // 0x2B
                                    // Play a sound effect on channel #4 [param1=Panning, param2=Effect ID]
                                    // playSound(p2, (p1 / 64) - 1, config.channel4)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p2, op.p1)
                                    break
                                case 48: // 0x30 // Not used in fields
                                    // Play a sound effect on channel #5 with centre panning
                                    // playSound(p1, 0, config.channel5)
                                    addSound(field.script.header.name, entity.entityId, entity.entityName, script.index, script.scriptType, l, op.op, op.p2, 64)
                                    break
                            }
                        }
                    }
                }
            }
        }


    }

    await writeSoundList()
}
createSoundList()