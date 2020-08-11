![Logo](KUJATA.png)

# kujata

Translates Final Fantasy 7 assets to web-friendly formats like JSON and glTF

## Current Features

- Translate FF7 field character models and animations (char.lgp) to JSON and glTF
  - battle model support coming soon
  - reverse translation (glTF-to-ff7) coming soon

- Translate FF7 field scene data (flevel.lgp) to JSON
  - translates field scripts, gateways, tiles, palettes, textures, etc., but not all sections yet (only encounters is missing)
  - renders separate layers for background images

- Translate FF7 kernel data (kernel.bin, kernel2.bin) to JSON
  - All sections except commandData, attackData, battleAndGrowthData, initData
  - Some improvements still to be made, mainly around consistent naming and materia data

## Pre-requisites and setup
- "git clone" this repo
- install NodeJS and run "npm install" to install dependencies
  - https://nodejs.org/en/download/
- locate field/char.lgp and field/flevel.lgp from your Final Fantasy 7 PC installation
- use unlgp 0.5b to extract lgp files to a directory
  - see https://github.com/picklejar76/kujata/lgp-0.5b/bin/unlgp.exe
- use TexTool_0.10 to translate TEX files to png (as needed)
  - see https://github.com/picklejar76/kujata/tex-tool-0.10/TexTool.exe
- edit config.json to configure your input and output directories
  - see https://github.com/picklejar76/kujata/config.json

## How to translate field char data (field/char.lgp) to glTF
- Run "node test-ff7-to-gltf-translator.js"
  - This translates AAAA.HRC (Cloud skeleton) to aaaa.gltf and aaaa.bin
    - uses AAFE.A (Cloud standing animation) as base structure in the output
    - includes all Cloud animations (based on Ifalna DB) in the output
- Look at ff7-gltf/viewer/viewer.html for example of how to view in html page
- Edit the js to translate other models as desired
- For help, reach out to the author: picklejar76@gmail.com

## How to translate field flevel data (field/flevel.lgp) to JSON
- Look at https://github.com/picklejar76/kujata/ff7-asset-loader/test-flevel-loader.js
- Better instructions coming soon
- For help, reach out to the author: picklejar76@gmail.com

## How to translate kernel data (kernel/kernel.bin, kernel/kernel2.bin) to JSON
- Look at https://github.com/picklejar76/kujata/ff7-asset-loader/test-kernel-extractor.js
- Better instructions coming soon
- For help, reach out to the author: https://github.com/dangarfield/kujata

## Thanks goes to...
- qhimm community
- Aali, for patching FF7, graphics work, lgp/unlgp utility, etc.
- Borde, for authoring Kimera and TexTool_0.10
- DLPB, for authoring too many tools to list here
- ficedula, for authoring multiple tools, including lzs decompressor and Ifalna model viewer
- Kaldarasha, for model editing experience and design advice, etc.
- halkun, for evangelizing glTF, FF7 file spreadsheet, etc.
- Sega Chief, for field model friendly names, etc.
- quantumpencil, for sister-ray
- Jusete, for finding a good kujata logo
- others TBD; please let me know if I left out any person or acknowledgement!
