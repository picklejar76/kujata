const stringUtil = require("./string-util.js")
const sharp = require('sharp')
const fs = require('fs')
const { timeEnd } = require("console")

/*
A layer is split out for every unique combination of:
- Layer ID
- Z index (eg distance from camera for occlusion culling)
- Param (eg moveable effect group)
- State (eg moveable effect layer)
- transType (eg blending mode)

This is not the required format for palmer etc, but it does provide ALL possible layers
with depths and configurations for graphic artists and developers etc

Problems still to resolve:
- Layer 0 - COMPLETE
- Layer 1 - COMPLETE apart from typeTrans=2 doesn't seem to display perfectly
- Layer 2 - COMPLETE, eg woa_3
- Layer 3 - COMPLETE, eg anfrst_1
*/

let COEFF_COLOR = 255 / 31 // eg translate 5 bit color to 8 bit
const getColorForPalette = (bytes) => { // abbbbbgggggrrrrr
    const color = {
        r: Math.round((bytes & 31) * COEFF_COLOR),
        g: Math.round((bytes >> 5 & 31) * COEFF_COLOR),
        b: Math.round((bytes >> 10 & 31) * COEFF_COLOR),
        m: (bytes >> 15 & 1) === 1 ? 0 : 255
    }
    color.a = 255 //color.r === 0 && color.g === 0 && color.b === 0 ? 0 : 255
    color.hex = `${stringUtil.toHex2(color.r)}${stringUtil.toHex2(color.g)}${stringUtil.toHex2(color.b)}`
    // console.log('color', bytes, color)
    return color
}
const getColorForDirect = (bytes) => { // rrrrrgggggabbbbb
    const color = {
        r: Math.round((bytes >> 11 & 31) * COEFF_COLOR),
        b: Math.round((bytes & 31) * COEFF_COLOR),
        g: Math.round((bytes >> 6 & 31) * COEFF_COLOR),
        a: 255
    }
    color.hex = `${stringUtil.toHex2(color.r)}${stringUtil.toHex2(color.g)}${stringUtil.toHex2(color.b)}`
    // console.log('color', bytes, color)
    return color
}

const allTiles = (flevel) => {
    let tiles = []
    let layerNames = Object.keys(flevel.background.tiles)
    for (let i = 0; i < layerNames.length; i++) {
        const layerName = layerNames[i]
        tiles = tiles.concat(flevel.background.tiles[layerName].tiles)
    }
    return tiles
}

const sortBy = (p, a) => a.sort((i, j) => p.map(v => i[v] - j[v]).find(r => r))

const getSizeMetaData = (tiles) => {
    let minX = 0
    let maxX = 0
    let minY = 0
    let maxY = 0
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]
        if (tile.destinationX < minX) { minX = tile.destinationX }
        if (tile.destinationX > maxX) { maxX = tile.destinationX }
        if (tile.destinationY < minY) { minY = tile.destinationY }
        if (tile.destinationY > maxY) { maxY = tile.destinationY }
    }
    let tileSize = 16
    const tile = tiles[0]
    if (tile.layerID >= 2) { // Layer 2 & 3 can have 32 pixel tiles 
        if (tile.width !== 16 && tile.height !== 16) {
            tileSize = 32
        }
    }
    let height = maxY - minY + tileSize
    let width = maxX - minX + tileSize
    // console.log('SIZE',
    //     'x', minX, maxX, '->', width,
    //     'y', minY, maxY, '->', height)

    let channels = 4
    return { minX, maxX, minY, maxY, height, width, channels }
}

// const blendColors = (baseCol, topColor, typeTrans) => {
//     switch (typeTrans) {
//         case 1:
//             return {
//                 r: Math.min(255, baseCol.r + topColor.r),
//                 g: Math.min(255, baseCol.g + topColor.g),
//                 b: Math.min(255, baseCol.b + topColor.b),
//                 a: 255
//             }
//         case 2:
//             return {
//                 r: Math.max(0, baseCol.r - topColor.r),
//                 g: Math.max(0, baseCol.g - topColor.g),
//                 b: Math.max(0, baseCol.b - topColor.b),
//                 a: 255
//             }
//         case 3:
//             return {
//                 r: Math.min(255, baseCol.r + (0.25 * topColor.r)),
//                 g: Math.min(255, baseCol.g + (0.25 * topColor.g)),
//                 b: Math.min(255, baseCol.b + (0.25 * topColor.b)),
//                 a: 255
//             }
//         default:
//             return {
//                 r: (baseCol.r + topColor.r) / 2,
//                 g: (baseCol.g + topColor.g) / 2,
//                 b: (baseCol.b + topColor.b) / 2,
//                 a: 255
//             }
//     }
// }

const saveTileGroupImage = (flevel, folder, name, tiles, sizeMeta, setBlackBackground) => {
    // console.log('sizeMeta', name, JSON.stringify(sizeMeta))
    let n = sizeMeta.height * sizeMeta.width * sizeMeta.channels
    let data = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
        data[i] = 0x00 // Fill with either black or transparent
        if (setBlackBackground && (i + 1) % sizeMeta.channels === 0) {
            data[i] = 0xFF
        }
    }
    for (let i = 0; i < tiles.length; i++) { // Loop through each tile
        const tile = tiles[i]
        let tileOverlayX = tile.destinationX - sizeMeta.minX // Get normalised coords for destination of top left of tile
        let tileOverlayY = tile.destinationY - sizeMeta.minY

        let texture = flevel.background.textures[`texture${tile.textureId}`]

        let sourceX = tile.sourceX
        let sourceY = tile.sourceY
        let textureId = tile.textureId

        if (tile.layerID > 0 && tile.textureId2 > 0 && tile.depth !== 0) { // This solves the blending tiles
            sourceX = tile.sourceX2
            sourceY = tile.sourceY2
            textureId = tile.textureId2
            texture = flevel.background.textures[`texture${tile.textureId2}`]
        }
        let textureBytes = texture.data // Get all bytes for texture

        let tileSize = 16
        if (tile.layerID >= 2) { // Layer 2 & 3 can have 32 pixel tiles 
            if (tile.width !== 16 && tile.height !== 16) {
                tileSize = 32
            }
        }
        // const DEBUG_NAME = 'mds5_4-4095-0-0-0-0.pngs'
        // if (name === DEBUG_NAME) {
        //     console.log('name:', name,
        //         'size:', tileSize,
        //         'sourceX:', sourceX,
        //         'sourceY:', sourceY,
        //         'destinationX:', tile.destinationX, tileOverlayX,
        //         'destinationY:', tile.destinationY, tileOverlayY)
        // }
        for (let j = 0; j < (tileSize * tileSize); j++) { // Loop througheach tile's pixels, eg 16x16
            let adjustY = Math.floor(j / tileSize)
            let adjustX = j - (adjustY * tileSize) // Get normalised offset position, eg each new 
            const posX = tileOverlayX + adjustX
            const posY = tileOverlayY + adjustY

            let textureBytesOffset = ((sourceY + adjustY) * 256) + ((sourceX + adjustX)) // Calculate offset based on pixel coords, eg, we have to skip to the next row every 16

            const textureByte = textureBytes[textureBytesOffset] // Get the byte for this pixel from the source image




            const shallPrintDebug = (x, y, setBlackBackground) => {
                return false // disable debug logging
                if (setBlackBackground) {
                    return false
                }
                const debugPixels = [
                    [10, 10],
                    [10, 30],
                ]
                for (let i = 0; i < debugPixels.length; i++) {
                    if (debugPixels[i][0] === x && debugPixels[i][1] === y) {
                        return true
                    }
                }
                return false
            }

            const isBlack = (paletteItem) => {
                // return paletteItem.r === 0 && paletteItem.g === 0 && paletteItem.b === 0
                const colorBlack = paletteItem.r === 0 && paletteItem.g === 0 && paletteItem.b === 0
                if (!colorBlack) {
                    return false
                }
                if (paletteItem.m === 0) {
                    return false
                } else {
                    return true
                }
            }

            const usePalette = flevel.palette.pages.length > 0 && flevel.palette.pages.length > tile.paletteId && tile.depth === 1
            const ignoreFirstPixel = flevel.background.palette.ignoreFirstPixel[tile.paletteId] === 1 && textureByte === 0

            let paletteItem

            if (usePalette) {
                const paletteColor = Object.assign({}, flevel.palette.pages[tile.paletteId][textureByte])
                paletteColor.isBlack = isBlack(paletteColor)
                paletteColor.type = 'palette'
                paletteItem = paletteColor
            } else {
                const directColor = getColorForDirect(textureByte)
                directColor.isBlack = isBlack(directColor)
                directColor.type = 'direct'
                paletteItem = directColor
            }

            if (paletteItem.isBlack && flevel.palette.pages[tile.paletteId] && flevel.palette.pages[tile.paletteId][0]) {
                const paletteFirstColor = Object.assign({}, flevel.palette.pages[tile.paletteId][0])
                paletteFirstColor.isBlack = isBlack(paletteFirstColor)
                paletteFirstColor.type = 'first'
                paletteItem = paletteFirstColor
            }
            if (ignoreFirstPixel) {
                if (shallPrintDebug(posX, posY, setBlackBackground)) {
                    console.log('ignoreFirstPixel', paletteItem)
                }
                paletteItem.noRender = 1 // eg, don't render show
            }

            if (!usePalette && paletteItem.isBlack) {
                paletteItem.noRender = 1
            }


            if (shallPrintDebug(posX, posY, setBlackBackground)) { // Just for logging
                console.log('Tile', i, tile,
                    'x', tile.destinationX, '->', tileOverlayX,
                    'y', tile.destinationY, '->', tileOverlayY,
                    'depth', tile.depth, 'z', tile.id,
                    'palette', tile.paletteId,
                    'texture', tile.sourceX, tile.sourceY, textureBytes.length,
                    'layer', tile.layerID,
                    'z', tile.z,
                    'id', tile.id, tile.idBig,
                    'param', tile.param, tile.state,
                    'blend', tile.blending, tile.typeTrans
                )

                console.log(' - ',
                    'x', sourceX, adjustX, '->', adjustX,
                    'y', sourceY, adjustY, '->', adjustY, '\n',
                    'pos', posX, posY, '\n',
                    'palette', tile.paletteId, flevel.background.palette.ignoreFirstPixel[tile.paletteId], '\n',
                    'bytes', textureByte, textureByte === 0, '\n',
                    'selection', usePalette, ignoreFirstPixel, paletteItem.isBlack === true, '\n',
                    // 'potential\n',
                    // JSON.stringify(directColor), '\n',
                    // JSON.stringify(paletteColor), '\n',
                    // JSON.stringify(paletteFirstColor), '\n',
                    'chosen', JSON.stringify(paletteItem)
                )


            }

            let byteOffset = ((tileOverlayY + adjustY) * sizeMeta.width * sizeMeta.channels) + ((tileOverlayX + adjustX) * sizeMeta.channels) // Write this into an array so we can print the image (note, each channel, eg RGBA)

            if (tile.blending) { // Most blending should happen with webgl in browser
                if (tile.typeTrans === 3) { // Blending 3 is 25%, set colours to 25%
                    paletteItem.r = Math.round(0.25 * paletteItem.r)
                    paletteItem.g = Math.round(0.25 * paletteItem.g)
                    paletteItem.b = Math.round(0.25 * paletteItem.b)
                }
            }

            if (!paletteItem.noRender) {
                data[byteOffset + 0] = 0x00 + paletteItem.r
                data[byteOffset + 1] = 0x00 + paletteItem.g
                data[byteOffset + 2] = 0x00 + paletteItem.b
                data[byteOffset + 3] = 0x00 + paletteItem.a
                if (shallPrintDebug(posX, posY, setBlackBackground)) {
                    console.log('rendering', JSON.stringify(paletteItem), data[byteOffset + 0], byteOffset, '\n')
                }
            }
        }
    }

    const filePath = folder + '/' + name
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder)
    }
    sharp(
        Buffer.from(data.buffer),
        { raw: { width: sizeMeta.width, height: sizeMeta.height, channels: sizeMeta.channels } })
        // .resize({ width: sizeMeta.width * 4, height: sizeMeta.height * 4, kernel: sharp.kernel.nearest })
        .toFile(filePath)
    return data
}


const getExistingArrangedLayer = (tile, arrangedLayers) => {
    for (let i = 0; i < arrangedLayers.length; i++) {
        const arrangedLayer = arrangedLayers[i]
        if (tile.layerID === arrangedLayer.layerID &&
            tile.z === arrangedLayer.z &&
            tile.param === arrangedLayer.param &&
            tile.state === arrangedLayer.state &&
            tile.typeTrans === arrangedLayer.typeTrans) {
            return arrangedLayer
        }
    }
    return null
}
const arrangeLayers = (tiles) => {
    const arrangedLayers = []

    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]
        // get existing arranged layer if exists
        let arrangedLayer = getExistingArrangedLayer(tile, arrangedLayers)

        // if doesn't exist, create it
        if (arrangedLayer === null) {
            arrangedLayer = { layerID: tile.layerID, z: tile.z, param: tile.param, state: tile.state, typeTrans: tile.typeTrans, tiles: [], tileCount: 0 }
            arrangedLayers.push(arrangedLayer)
        }
        // add tile to layer
        arrangedLayer.tiles.push(tile)
        arrangedLayer.tileCount = arrangedLayer.tiles.length
    }
    return arrangedLayers
}
const renderBackgroundLayers = (flevel, folder, baseFilename) => {
    let tiles = allTiles(flevel)

    const sizeMeta = getSizeMetaData(tiles)
    // console.log('sizeMeta', JSON.stringify(sizeMeta))

    sortBy(['layerID', 'z', 'param', 'state', 'typeTrans'], tiles)

    // Group by
    const arrangedLayers = arrangeLayers(tiles)

    // console.log('arrangedLayers', arrangedLayers)
    // console.log('arrangedLayer', arrangedLayers[0])

    // Draw all bg layers
    saveTileGroupImage(flevel, folder, `${baseFilename}.png`, tiles, sizeMeta, true)

    // Draw each grouped tile layer
    for (let i = 0; i < arrangedLayers.length; i++) {
        const arrangedLayer = arrangedLayers[i]
        // Note: This works, BUT it will only toggle between states. If you wanted to have multiple states of one param active, this wouldn't work.
        // In that case, we'd have to render every combination of states for each param, maybe all params
        const name = `${baseFilename}-${arrangedLayer.z}-${arrangedLayer.layerID}-${arrangedLayer.typeTrans}-${arrangedLayer.param}-${arrangedLayer.state}.png`
        // console.log('name', arrangedLayer.typeTrans, name)
        let layerSizeMeta = sizeMeta
        if (arrangedLayer.layerID && arrangedLayer.layerID === 2) {
            layerSizeMeta = getSizeMetaData(arrangedLayer.tiles)
        }

        saveTileGroupImage(flevel, folder, name, arrangedLayer.tiles, layerSizeMeta, false, arrangedLayer.layerID)
        arrangedLayer.fileName = name
        if (arrangedLayer.layerID === 2) {
            arrangedLayer.parallaxDirection = Math.abs(sizeMeta.height - layerSizeMeta.height) <= 16 ? 'horizontal' : 'vertical'
            if (arrangedLayer.parallaxDirection === 'horizontal') {
                arrangedLayer.parallaxRatio = layerSizeMeta.width / sizeMeta.width
                arrangedLayer.parallaxMax = sizeMeta.width
            } else {
                arrangedLayer.parallaxRatio = layerSizeMeta.height / sizeMeta.height
                arrangedLayer.parallaxMax = sizeMeta.height
            }
        }
        delete arrangedLayer.tiles
    }

    // Write layer metadata to json filea
    fs.writeFileSync(`${folder}/${baseFilename}.json`, JSON.stringify(arrangedLayers, null, 2));
}
const getAllLayersSizeMeta = (flevel) => {
    let tiles = allTiles(flevel)
    const sizeMeta = getSizeMetaData(tiles)
    return sizeMeta
}
const getLayerSizeMeta = (tiles) => {
    const sizeMeta = getSizeMetaData(tiles)
    return sizeMeta
}
module.exports = {
    renderBackgroundLayers,
    getColorForPalette,
    getAllLayersSizeMeta,
    getLayerSizeMeta
}