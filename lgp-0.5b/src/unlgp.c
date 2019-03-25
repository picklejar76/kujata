#include <stdio.h>
#include <malloc.h>
#include <string.h>
#include <sys/stat.h>

#include "lgp.h"

#ifdef DEBUG
#define debug_printf(x, ...) printf(x, __VA_ARGS__)
#else
#define debug_printf(x, ...)
#endif

void *malloc_read(FILE *f, int size)
{
	char *ret = malloc(size);
	char *data = ret;
	int res;
	
	do
	{
		res = fread(data, 1, size, f);
		if(res != 0)
		{
			size -= res;
			data += res;
		}
		else return ret;
	} while(size);
	
	return ret;
}

int main(int argc, char *argv[])
{
	FILE *f;
	char tmp[512];
	int num_files;
	int i;
	int files_written = 0;
	unsigned short num_conflicts;
	struct toc_entry *toc;
	struct lookup_table_entry *lookup_table;
	struct conflict_entry *conflicts[MAX_CONFLICTS];
	unsigned short num_conflict_entries[MAX_CONFLICTS];
	
	if(argc < 2)
	{
		printf("Usage: unlgp <archive>\n");
		return -1;
	}
	
	f = fopen(argv[1], "rb");
	
	if(!f)
	{
		printf("Error opening input file\n");
		return -1;
	}
	
	fread(tmp, 12, 1, f);
	
	fread(&num_files, 4, 1, f);
	
	printf("Number of files in archive: %i\n", num_files);
	
	toc = malloc_read(f, sizeof(*toc) * num_files);
	
	lookup_table = malloc_read(f, sizeof(*lookup_table) * LOOKUP_TABLE_ENTRIES);
	
	fread(&num_conflicts, 2, 1, f);
	
	if(num_conflicts) debug_printf("%i conflicts\n", num_conflicts);
	
	for(i = 0; i < num_conflicts; i++)
	{
		fread(&num_conflict_entries[i], 2, 1, f);
		
		debug_printf("%i: %i conflict entries\n", i, num_conflict_entries[i]);
		
		conflicts[i] = malloc_read(f, sizeof(**conflicts) * num_conflict_entries[i]);
	}
	
	for(i = 0; i < num_files; i++)
	{
		struct file_header file_header;
		void *data;
		FILE *of;
		int lookup_value1;
		int lookup_value2;
		struct lookup_table_entry *lookup_result;
		int resolved_conflict = 0;
		char name[256];
		
		debug_printf("%i; Name: %s, offset: 0x%x, unknown: 0x%x, conflict: %i\n", i, toc[i].name, toc[i].offset, toc[i].unknown1, toc[i].conflict);
		
		fseek(f, toc[i].offset, SEEK_SET);
		
		fread(&file_header, sizeof(file_header), 1, f);
		
		debug_printf("%i; Name: %s, size: %i\n", i, file_header.name, file_header.size);
		
		if(strncasecmp(toc[i].name, file_header.name, 20))
		{
			printf("Offset error %s\n", toc[i].name);
			continue;
		}
		
		lookup_value1 = lgp_lookup_value(toc[i].name[0]);
		lookup_value2 = lgp_lookup_value(toc[i].name[1]);
		
		lookup_result = &lookup_table[lookup_value1 * LOOKUP_VALUE_MAX + lookup_value2 + 1];
		
		debug_printf("%i; %i - %i\n", i, (lookup_result->toc_offset - 1), (lookup_result->toc_offset - 1 + lookup_result->num_files));
		
		if(i < (lookup_result->toc_offset - 1) || i > (lookup_result->toc_offset - 1 + lookup_result->num_files)) printf("Broken lookup table, FF7 may not be able to find %s\n", toc[i].name);
		
		strcpy(name, "./");
		strcat(name, toc[i].name);
		
		if(toc[i].conflict != 0)
		{
			int j;
			int conflict = toc[i].conflict - 1;
			
			debug_printf("Trying to resolve conflict %i for %i (%s)\n", conflict, i, toc[i].name);
			
			for(j = 0; j < num_conflict_entries[conflict]; j++)
			{
				if(conflicts[conflict][j].toc_index == i)
				{
					sprintf(name, "%s/%s", conflicts[conflict][j].name, toc[i].name);
					debug_printf("Conflict resolved to %s\n", name);
					resolved_conflict = 1;
					break;
				}
			}
			
			if(!resolved_conflict)
			{
				printf("Unresolved conflict for %s\n", toc[i].name);
				continue;
			}
		}
		
		debug_printf("Extracting %s\n", name);
		
		if(resolved_conflict)
		{
			char *next = name;
			
			while((next = strchr(next, '/')))
			{
				char tmp[256];
				
				while(next[0] == '/') next++;
				
				strncpy(tmp, name, next - name);
				tmp[next - name] = 0;
				
				debug_printf("Creating directory %s\n", tmp);
				
				mkdir(tmp, 0777);
			}
		}
		
		data = malloc_read(f, file_header.size);
		
		of = fopen(name, "wb");
		
		if(!of)
		{
			printf("Error opening output file %s\n", name);
			free(data);
			continue;
		}
		
		fwrite(data, file_header.size, 1, of);
		
		fclose(of);
		
		free(data);
		
		files_written++;
	}
	
	printf("Successfully extracted %i file(s) out of %i file(s) total.\n", files_written, num_files);
	
	return 0;
}
