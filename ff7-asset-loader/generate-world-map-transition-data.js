const fs = require('fs-extra')
const path = require('path')
const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js")

let config = JSON.parse(fs.readFileSync('../config.json', 'utf-8'))

const generateWorldMapTransitionData = async () => {
    console.log('generateWorldMapTransitionData: START')
    const buffer = fs.readFileSync(path.join(config.inputWMWorldUSDirectory, 'FIELD.TBL'))
    const r = new FF7BinaryDataReader(buffer)
    const totalLocations = r.length / 24
    // console.log('r.length', r.length, r.offset, totalLocations)

    const locations = {}
    for (let i = 0; i < totalLocations; i++) {
        const wmFieldReference = `wm${i}`
        locations[wmFieldReference] = { wmFieldReference }
        const sections = ['sectionA', 'sectionB']
        sections.forEach(sectionType => {
            locations[wmFieldReference][sectionType] = {
                x: r.readShort(),
                y: r.readShort(),
                triangleId: r.readShort(),
                fieldId: r.readUShort(),
                direction: r.readUByte(), // 9-12 all the same
                direction2: r.readUByte(),
                direction3: r.readUByte(),
                direction4: r.readUByte(),
            }
            delete locations[wmFieldReference][sectionType].direction2
            delete locations[wmFieldReference][sectionType].direction3
            delete locations[wmFieldReference][sectionType].direction4
        })
    }

    // console.log('finished', r.offset, r.length, locations.wm0)
    await fs.ensureDir(path.join(config.outputWMWorldUSDirectory))
    await fs.writeJson(path.join(config.outputWMWorldUSDirectory, 'field.tbl.json'), locations, { spaces: '\t' })


    console.log('generateWorldMapTransitionData: END')
}
generateWorldMapTransitionData()