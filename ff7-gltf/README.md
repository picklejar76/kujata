# ff7-gltf
Translates Final Fantasy 7 models to glTF

## Current features
- translates field models; battle models coming soon
- translates ff7-to-glTF; glTF-to-ff7 coming soon

## How to translate field models to glTF
- Pre-requisites and setup:
  - "git clone" this repo and change to this directory (kujata/ff7-gltf)
  - install NodeJS and run "npm install" to install dependencies
    - https://nodejs.org/en/download/
  - locate field\char.lgp from your Final Fantasy 7 PC installation
  - use unlgp 0.5b to extract files from field\char.lgp to a directory
    - see ../lgp-0.5b/
  - use TexTool_0.10 to translate TEX files to png (as needed)
    - see ../tex-tool-0.10/
  - edit config.json to configure your input and output directories
    - see ./config.json
- Run "node app.js" to translate AAAA.HRC to aaaa.gltf and aaaa.bin
- Edit app.js to translate other models as desired
- For help, reach out to the author: picklejar76@gmail.com

## Thanks goes to...
- qhimm community
- Aali, for patching FF7, graphics work, lgp/unlgp utility, etc.
- Borde, for authoring Kimera and TexTool_0.10
- halkun, for evangelizing glTF, FF7 file spreadsheet, etc.
- Sega Chief, for field model friendly names, etc.
- quantumpencil, for sister-ray
- others TBD; please let me know if I left out any person or acknowledgement!
