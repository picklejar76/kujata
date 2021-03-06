#!/usr/bin/python

#
# WorldInfo - Extract script code of Final Fantasy world map files
#
# Copyright (C) 2014 Christian Bauer <www.cebix.net>
#
# Permission to use, copy, modify, and/or distribute this software for any
# purpose with or without fee is hereby granted, provided that the above
# copyright notice and this permission notice appear in all copies.
#

__version__ = "1.3"

import sys
import os
import shutil

import ff7


# Print usage information and exit.
def usage(exitcode, error = None):
    print "Usage: %s [OPTION...] <unlgped_worldmap_dir> <output_dir>" % os.path.basename(sys.argv[0])
    print "  -V, --version                   Display version information and exit"
    print "  -?, --help                      Show this help message"

    if error is not None:
        print >>sys.stderr, "\nError:", error

    sys.exit(exitcode)


# Parse command line arguments
discPath = None
outputDir = None

for arg in sys.argv[1:]:
    if arg == "--version" or arg == "-V":
        print "WorldInfo", __version__
        sys.exit(0)
    elif arg == "--help" or arg == "-?":
        usage(0)
    elif arg[0] == "-":
        usage(64, "Invalid option '%s'" % arg)
    else:
        if discPath is None:
            discPath = arg
        elif outputDir is None:
            outputDir = arg
        else:
            usage(64, "Unexpected extra argument '%s'" % arg)

if discPath is None:
    usage(64, "No disc image or game data input directory specified")
if outputDir is None:
    usage(64, "No output directory specified")

try:

    # Create the output directory
    if os.path.isfile(outputDir):
        print >>sys.stderr, "Cannot create output directory '%s': Path refers to a file" % outputDir
        sys.exit(1)

    if os.path.isdir(outputDir):
        answer = None
        while answer not in ["y", "n"]:
            answer = raw_input("Output directory '%s' exists. Delete and overwrite it (y/n)? " % outputDir)

        if answer == 'y':
            shutil.rmtree(outputDir)
        else:
            sys.exit(0)

    try:
        os.mkdir(outputDir)
    except OSError, e:
        print >>sys.stderr, "Cannot create output directory '%s': %s" % (outputDir, e.strerror)
        sys.exit(1)

    # Extract all world map files
    worldMaps = ["wm0", "wm2", "wm3"]

    for map in worldMaps:
        print map

        # Retrieve the map file
        worldMap = ff7.world.WorldMap(ff7._retrieveFileFromDir(discPath, ".", map + ".ev"))

        # Create the output file
        filePath = os.path.join(outputDir, map.lower() + ".tsv")
        try:
            f = open(filePath, "w")
        except IOError, e:
            print >>sys.stderr, "Cannot create file '%s': %s" % (filePath, e.strerror)
            sys.exit(1)

        # Dump the script
        print >>f, ff7.world.disassemble(worldMap.getScript())

        f.close()

except Exception, e:

    # Pokemon exception handler
    print >>sys.stderr, e.message
    sys.exit(1)
