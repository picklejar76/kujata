const fs = require('fs-extra')
let config = JSON.parse(fs.readFileSync('../../config.json', 'utf-8'));

const createCombinedMusicList = async () => {
    const musicList1 = JSON.parse(fs.readFileSync(config.metadataDirectory + '/music-list.json', 'utf-8'))
    const musicList2 = JSON.parse(fs.readFileSync(config.metadataDirectory + '/music-list-2.json', 'utf-8'))
    let musicList = []
    for (let i = 0; i < musicList1.length; i++) {
        musicList.push({ id: i, name: musicList1[i], description: musicList2[i] })
    }
    await fs.writeJson('music-list-combined.json', musicList, { spaces: '\t' })
    console.log(musicList)
}
createCombinedMusicList()