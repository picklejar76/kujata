Ficedula FFLZS v1.20
--------------------

This little utility will compress and decompress files using the LZS compression Squaresoft used in Final Fantasy VII and VIII. Any of my programs that need to access compressed files (Cosmo, LGP patcher) can handle the compression and decompression themselves, but this tool lets anyone who wants to edit the files themselves do so.
Note: It's a command line utility (run it from DOS prompt) but it does need to be run from within Windows!

UPDATES IN v1.20
----------------
This version (finally!) adds Haruhiko compression as an option. This is the compression method that Square used to compress their files, so using this gives you files compressed as well as theirs are! It's fairly fast, so there's probably no need to use any other sort of compression, although the options are still there.


Usage
-----
Ficedula FFLZS v1.20
Format is: lzs.exe [-d] [-c{0|1|2|3|4|5}] [-q] inputfile [outputfile]

   -d: Decompress file

	If you don't use this, it assumes compression.

   -c: Compression level. 0=None, 1=8-bit, 2=16-bit, 3=32-bit,
           4=Qhimm's (if QHIMMLZS.DLL present), 5=Haruhiko (default) (best)

	If you don't use this, Haruhiko compression is used.

   -q: Quiet mode. Don't display any output.

   inputfile: File(s) to read from.
	
	You can specify multiple files! If you do this, you can't give an output
	filename, of course; it uses the default for each file. EG:

   outputfile: File to write to. If not specified default is:
     Original file when compressing (unless original had extension .DEC)
     Original file with extension .DEC added when decompressing



Examples
--------

lzs.exe -d UUTAI1
	Decompresses UUTAI1 to UUTAI1.DEC
lzs.exe -c5 ANCNT3.DEC
	Compresses ANCNT3.DEC to ANCNT3 using level 5 compression (the best)
lzs.exe -d *
	Decompresses all files in current folder (uses filename.dec as the output for each one)


Comments? Bugs?

Email ficedula@lycos.co.uk
Updates at http://ficedula.cjb.net/
