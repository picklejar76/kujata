const stringUtil = require("./string-util.js")
const sharp = require('sharp')
const fs = require('fs')

/*
A layer is split out for every unique combination of:
- Layer ID
- Z index (eg distance from camera for occlusion culling)
- Param (eg moveable effect group)
- State (eg moveable effect layer)

This is not the required format for palmer etc, but it does provide ALL possible layers
with depths and configurations for graphic artists and developers etc

Problems still to resolve:
- I have not yet figured out light sources and the blending & transTrans properties
For the time being, they are simply filtered out so that there are no unwanted artefacts
- Intermittent 'transparent' pixels on most fields, haven't look into why yet
*/

let COEFF_COLOR = 255 / 31 // eg translate 5 bit color to 8 bit
const getColorForPalette = (bytes) => { // abbbbbgggggrrrrr
    const color = {
        r: Math.round((bytes & 31) * COEFF_COLOR),
        g: Math.round((bytes >> 5 & 31) * COEFF_COLOR),
        b: Math.round((bytes >> 10 & 31) * COEFF_COLOR)
    }
    color.hex = `${stringUtil.toHex2(color.r)}${stringUtil.toHex2(color.g)}${stringUtil.toHex2(color.b)}`
    // console.log('color', bytes, color)
    return color
}
const getColorForDirect = (bytes) => { // rrrrrgggggabbbbb
    const color = {
        b: Math.round((bytes & 31) * COEFF_COLOR),
        g: Math.round((bytes >> 6 & 31) * COEFF_COLOR),
        r: Math.round((bytes >> 11 & 31) * COEFF_COLOR)
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

const groupBy = (arr, param1, param2, param3, param4) => {
    let grouped = {}
    for (var i = 0, len = arr.length, a; i < len; i++) {
        a = arr[i]
        if (grouped[a[param1]] === undefined)
            grouped[a[param1]] = {}
        if (grouped[a[param1]][a[param2]] === undefined)
            grouped[a[param1]][a[param2]] = {}
        if (grouped[a[param1]][a[param2]][a[param3]] === undefined)
            grouped[a[param1]][a[param2]][a[param3]] = {}
        if (grouped[a[param1]][a[param2]][a[param3]][a[param4]] === undefined)
            grouped[a[param1]][a[param2]][a[param3]][a[param4]] = []
        grouped[a[param1]][a[param2]][a[param3]][a[param4]].push(a)
    }
    return grouped
}
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
    let height = maxY - minY + 16
    let width = maxX - minX + 16
    // console.log('SIZE',
    //     'x', minX, maxX, '->', width,
    //     'y', minY, maxY, '->', height)

    let channels = 4
    return { minX, maxX, minY, maxY, height, width, channels }
}

const blendColors = (baseCol, topColor, typeTrans) => {
    switch (typeTrans) {
        case 1:
            return {
                r: Math.min(255, baseCol.r + topColor.r),
                g: Math.min(255, baseCol.g + topColor.g),
                b: Math.min(255, baseCol.b + topColor.b)
            }
        case 2:
            return {
                r: Math.max(0, baseCol.r - topColor.r),
                g: Math.max(0, baseCol.g - topColor.g),
                b: Math.max(0, baseCol.b - topColor.b)
            }
        case 3:
            return {
                r: Math.min(255, baseCol.r + (0.25 * topColor.r)),
                g: Math.min(255, baseCol.g + (0.25 * topColor.g)),
                b: Math.min(255, baseCol.b + (0.25 * topColor.b))
            }
        default:
            return {
                r: (baseCol.r + topColor.r) / 2,
                g: (baseCol.g + topColor.g) / 2,
                b: (baseCol.b + topColor.b) / 2,
            }
    }
}

const saveTileGroupImage = (flevel, folder, name, tiles, sizeMeta, setBlackBackground, ignoreNonZeroParams, baseData) => {
    let n = sizeMeta.height * sizeMeta.width * sizeMeta.channels
    let data = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
        if (setBlackBackground && (i + 1) % sizeMeta.channels === 0) {
            data[i] = 0xFF // Fill with either black or transparent
        } else {
            data[i] = 0x00
        }
    }
    for (let i = 0; i < tiles.length; i++) { // Loop through each tile
        const tile = tiles[i]
        let tileOverlayX = tile.destinationX + (sizeMeta.width / 2) // Get normalised coords for destination of top left of tile
        let tileOverlayY = tile.destinationY + (sizeMeta.height / 2)

        let texture = flevel.background.textures[`texture${tile.textureId}`]
        if (texture === undefined) {
            // TODO - Not sure exactly what to do here, try this for now, although it doesn't give any results
            texture = flevel.background.textures[`texture${tile.textureId2}`]
        }
        let textureBytes = texture.data // Get all bytes for texture

        let sourceX = tile.sourceX
        let sourceY = tile.sourceY
        let textureId = tile.textureId

        if (tile.layerID > 0 && tile.textureId2 > 0) { // Unsure about this, from makou reactor, will update
            sourceX = tile.sourceX2
            sourceY = tile.sourceY2
            textureId = tile.textureId2
        }
        if (false) { // Just for logging
            console.log('Tile', i,
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
        }

        for (let j = 0; j < 256; j++) { // Loop througheach tile's pixels, eg 16x16
            let adjustY = Math.floor(j / 16)
            let adjustX = j - (adjustY * 16) // Get normalised offset position, eg each new 
            let textureBytesOffset = ((tile.sourceY + adjustY) * 256) + ((tile.sourceX + adjustX)) // Calculate offset based on pixel coords, eg, we have to skip to the next row every 16

            const textureByte = textureBytes[textureBytesOffset] // Get the byte for this pixel from the source image

            let paletteItem
            if (flevel.palette.pages.length > 0 && flevel.palette.pages.length > tile.paletteId && tile.depth === 1) { // Check to see if we get the color from the palette or directly
                paletteItem = flevel.palette.pages[tile.paletteId][textureByte] // Using the byte as reference get the correct colour from the specified palette
            } else {
                paletteItem = getColorForDirect(textureByte) // Get the colour directly, should be 2 bytes
            }
            const paletteColor = paletteItem.hex

            if (false) { // Just for logging
                console.log(' - ',
                    'x', tile.sourceX, adjustX, '->', adjustX,
                    'y', tile.sourceY, adjustY, '->', adjustY,
                    'offset', textureBytesOffset, textureByte,
                    'color', palettePage, paletteColorId, paletteColor
                )
            }

            let byteOffset = ((tileOverlayY + adjustY) * sizeMeta.width * sizeMeta.channels) + ((tileOverlayX + adjustX) * sizeMeta.channels) // Write this into an array so we can print the image (note, each channel, eg RGBA)

            if (tile.blending) {
                const baseColor = { r: baseData[byteOffset + 0], g: baseData[byteOffset + 1], b: baseData[byteOffset + 2] }
                let blendedPaletteItem = blendColors(baseColor, paletteItem, tile.typeTrans) // TODO - Doesn't quite work properly yet
                if (i === 0 && j === 200 && false) { // for debug
                    console.log(
                        'blending', i, j, name, tile.typeTrans,
                        'colors', baseColor, paletteItem, '->', blendedPaletteItem,
                        'palette.pages.length', flevel.palette.pages.length > 0
                    )
                }
                paletteItem = blendedPaletteItem
                paletteItem.trans = true // Can't seem to get blending tiles working, so just make them transparent for the time being
            }
            if (textureByte !== 0 && !paletteItem.trans) {
                data[byteOffset + 0] = 0x00 + paletteItem.r
                data[byteOffset + 1] = 0x00 + paletteItem.g
                data[byteOffset + 2] = 0x00 + paletteItem.b
                data[byteOffset + 3] = 0xff
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
        .toFile(filePath)
    return data
}

const organiseTilesByFeature = (groupedTiles) => {
    let groupedTileLayers = []
    let layers = Object.keys(groupedTiles)
    for (let i = 0; i < layers.length; i++) {
        const layerNo = layers[i]
        let zNos = Object.keys(groupedTiles[layerNo])
        for (let j = 0; j < zNos.length; j++) {
            const zNo = zNos[j]
            let paramNos = Object.keys(groupedTiles[layerNo][zNo])
            for (let k = 0; k < paramNos.length; k++) {
                const paramNo = paramNos[k]
                let stateNos = Object.keys(groupedTiles[layerNo][zNo][paramNo])
                for (let l = 0; l < stateNos.length; l++) {
                    const stateNo = stateNos[l]
                    const t = groupedTiles[layerNo][zNo][paramNo][stateNo]
                    groupedTileLayers.push({ layer: parseInt(layerNo), z: parseInt(zNo), param: parseInt(paramNo), state: parseInt(stateNo), tileCount: t.length, tiles: t })
                    // console.log('layer', layerNo, 'z', zNo, 'param', paramNo, 'state', stateNo)
                }
            }
        }
    }
    return groupedTileLayers
}
const getBaseTiles = (groupedTiles) => {
    let baseTiles = []
    for (let i = 0; i < groupedTiles.length; i++) {
        const groupedTile = groupedTiles[i]
        if (groupedTile.param > 0) {

        } else {
            console.log('layer', groupedTile.layer, 'z', groupedTile.z, 'param', groupedTile.param, 'state', groupedTile.state)
        }
    }
}
const renderBackgroundLayers = (flevel, folder, baseFilename) => {
    let tiles = allTiles(flevel)

    const sizeMeta = getSizeMetaData(tiles)

    // tiles = tiles.filter(t => t.blending === 0) // For now, just filter out tiles with blending (eg, light effects) Complete later
    sortBy(['layerID', 'z', 'param', 'state'], tiles)

    // Group by
    const groupedTiles = groupBy(tiles, 'layerID', 'z', 'param', 'state')

    // Organise into drawable distinct distance and settings layers - Should really encorporate into above groupBy
    const groupedTileLayers = organiseTilesByFeature(groupedTiles)

    // Draw whole layer
    const baseTiles = tiles.filter(t => t.param === 0 && !t.blending) // Without params etc, used for blending with params
    let baseData = saveTileGroupImage(flevel, folder, `${baseFilename}.png`, baseTiles, sizeMeta, true, true)

    // Draw each grouped tile layer
    for (let i = 0; i < groupedTileLayers.length; i++) {
        const tileGroup = groupedTileLayers[i]
        const name = `${baseFilename}_${tileGroup.z}_${tileGroup.layer}_${tileGroup.param}_${tileGroup.state}.png`
        saveTileGroupImage(flevel, folder, name, tileGroup.tiles, sizeMeta, false, false, baseData)
        tileGroup.fileName = name
        delete tileGroup.tiles
    }

    // Write layer metadata to json file
    fs.writeFileSync(`${folder}/${baseFilename}.json`, JSON.stringify(groupedTileLayers, null, 2));
}
module.exports = {
    renderBackgroundLayers,
    getColorForPalette
}