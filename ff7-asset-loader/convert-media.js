const fs = require('fs-extra')
const path = require('path')
const util = require('util')
const execFile = util.promisify(require('child_process').execFile)
let config = JSON.parse(fs.readFileSync('../config.json', 'utf-8'))
let musicList = JSON.parse(fs.readFileSync('../metadata/music-list.json', 'utf-8'))


const extractSounds = async () => {
    console.log('Extract Sounds - START')
    // Extract .wav from audio.dat & audio.fmt
    // D:\code\ff7\sfxedit_0.3\sfxdump.exe 'D:\Steam\steamapps\common\FINAL FANTASY VII\data\sound\audio.fmt' 'D:\Steam\steamapps\common\FINAL FANTASY VII\data\sound\audio.dat' D:\code\ff7\kujata-data-dg\data\media\sounds\


    let inputDir = config.inputSoundsDirectory

    // Check directories
    const sfxDumpPath = path.join('..', 'sfxedit-0.3', 'sfxdump.exe')
    const audioFmtPath = path.join(config.inputSoundsDirectory, 'audio.fmt')
    const audioDatPath = path.join(config.inputSoundsDirectory, 'audio.dat')
    const soundsOutputPath = path.join(config.outputSoundsDirectory)

    if (!fs.existsSync(sfxDumpPath)) { throw new Error('Unable to locate sfxdump.exe - ' + sfxDumpPath) }
    if (!fs.existsSync(audioFmtPath)) { throw new Error('Unable to locate audio.fmt - ' + audioFmtPath) }
    if (!fs.existsSync(audioDatPath)) { throw new Error('Unable to locate audio.dat - ' + audioDatPath) }

    // Ensure output folder exists and is empty
    await fs.emptyDir(soundsOutputPath)

    // Extract wavs using sfxdump
    const { stdout } = await execFile(sfxDumpPath, [audioFmtPath, audioDatPath, soundsOutputPath])
    // console.log(stdout)
    let wavs = (await fs.readdir(soundsOutputPath)).filter(f => f.includes('.wav'))

    // Convert .wav into .ogg
    for (let i = 0; i < wavs.length; i++) {
        const wav = wavs[i]
        const wavPath = path.join(soundsOutputPath, wav)
        const oggPath = path.join(soundsOutputPath, wav.replace('.wav', '.ogg'))

        console.log('Converting sounds', i + 1, 'of', wavs.length)
        const { stdout, stderr } = await execFile('ffmpeg', ['-i', wavPath, '-acodec', 'libvorbis', oggPath])
        // console.log('wav', wav, ogg, stdout, stderr)
        await fs.remove(wavPath)
    }
    console.log('Extract Sounds - END')
}
const extractMusic = async () => {
    console.log('Extract Music - START')
    const inputMusicDirectory = path.join(config.inputMusicDirectory)
    const outputMusicDirectory = path.join(config.outputMusicDirectory)

    // Check directories
    if (!fs.existsSync(inputMusicDirectory)) { throw new Error('Unable to locate inputMusicDirectory - ' + config.inputMusicDirectory) }
    let oggs = (await fs.readdir(inputMusicDirectory)).filter(f => f.includes('.ogg'))
    if (oggs.length === 0) { throw new Error('No music files in inputMusicDirectory - ' + config.inputMusicDirectory) }

    // Ensure output folder exists and is empty
    await fs.emptyDir(outputMusicDirectory)

    // Move .ogg files
    for (let i = 0; i < oggs.length; i++) {
        const ogg = oggs[i]
        const originPath = path.join(inputMusicDirectory, ogg)
        const targetPath = path.join(outputMusicDirectory, ogg)
        await fs.copy(originPath, targetPath)
    }

    console.log('Extract Music - END')
}
const extractMovies = async () => {
    console.log('Extract Movies - START')
    const inputMoviesDirectory = path.join(config.inputMoviesDirectory)
    const outputMoviesDirectory = path.join(config.outputMoviesDirectory)

    // Check directories
    if (!fs.existsSync(inputMoviesDirectory)) { throw new Error('Unable to locate inputMoviesDirectory - ' + config.inputMoviesDirectory) }
    let oggs = (await fs.readdir(inputMoviesDirectory)).filter(f => f.includes('.avi'))
    if (oggs.length === 0) { throw new Error('No Movies files in inputMoviesDirectory - ' + config.inputMoviesDirectory) }

    // Ensure output folder exists and is empty
    await fs.emptyDir(outputMoviesDirectory)

    // Move .avi files
    for (let i = 0; i < oggs.length; i++) {
        const ogg = oggs[i]
        const originPath = path.join(inputMoviesDirectory, ogg)
        const targetPath = path.join(outputMoviesDirectory, ogg)
        await fs.copy(originPath, targetPath)
    }

    console.log('Extract Movies - END')
}
const extractMedias = async () => {

    await extractSounds()
    await extractMusic()
    await extractMovies()
}
const init = async () => {
    extractAllMedias()
}
init()
module.exports = [
    extractMedias
]