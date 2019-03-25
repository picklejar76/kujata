#include <ctype.h>

#define LOOKUP_VALUE_MAX 30
#define LOOKUP_TABLE_ENTRIES LOOKUP_VALUE_MAX * LOOKUP_VALUE_MAX

#define MAX_CONFLICTS 4096

struct toc_entry
{
	char name[20];
	unsigned int offset;
	unsigned char unknown1;
	unsigned short conflict;
} __attribute__((__packed__));

struct file_header
{
	char name[20];
	unsigned int size;
} __attribute__((__packed__));

struct lookup_table_entry
{
	unsigned short toc_offset;
	unsigned short num_files;
} __attribute__((__packed__));

struct conflict_entry
{
	char name[128];
	unsigned short toc_index;
} __attribute__((__packed__));

inline int lgp_lookup_value(unsigned char c)
{
	c = tolower(c);
	
	if(c == '.') return -1;
	
	if(c < 'a' && c >= '0' && c <= '9') c += 'a' - '0';
	
	if(c == '_') c = 'k';
	if(c == '-') c = 'l';
	
	return c - 'a';
}
