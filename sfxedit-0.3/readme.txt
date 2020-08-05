sfxEdit 0.3

usage:
	[sfxdump | sfxpack] .fmt .dat dir

	dumps / packs sound effects from the specified .fmt and .dat files to directory dir
	
.wav files
	Files are dumped and read as MS ADPCM, with a custom 'fflp' chunk at the end if
	looping data is present.
	
	fflp structure (4 bytes each):
		| 'f' 'f' 'l' 'p' | chunk size (always 8) | loop start | loop end |
	
	Start and end markers refer to the sample postion in bytes as decompressed in memory
	(i.e. 16bit linear PCM (?), so they will always be divisible by 2).

versions:
	0.3 no longer reads from registry for more flexibility, all paths must be fully specified on command line
		
credits
	- Cosmo by ficedula
	