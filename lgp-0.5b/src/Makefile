all: lgp unlgp

lgp: lgp.c lgp.h
	cc -Wall ${CFLAGS} lgp.c -o lgp

unlgp: unlgp.c lgp.h
	cc -Wall ${CFLAGS} unlgp.c -o unlgp

clean:
	rm lgp unlgp
