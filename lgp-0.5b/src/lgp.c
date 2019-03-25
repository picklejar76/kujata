#include <stdio.h>
#include <dirent.h>
#include <string.h>
#include <malloc.h>
#include <unistd.h>
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

struct file_list
{
	struct file_header file_header;
	char source_name[256];
	int toc_index;
	int conflict;
	struct file_list *next;
};

struct conflict_entry conflicts[MAX_CONFLICTS][255];
unsigned short num_conflict_entries[MAX_CONFLICTS];

struct lookup_table_entry lookup_table[LOOKUP_TABLE_ENTRIES];
struct file_list *lookup_list[LOOKUP_TABLE_ENTRIES];

int files_read = 0;
int files_total = 0;

void read_directory(char *base_path, char *path, DIR *d)
{
	struct dirent *dent;
	char tmp[1024];
	
	while((dent = readdir(d)))
	{
		int lookup_value1;
		int lookup_value2;
		int lookup_index;
		struct file_list *file;
		struct file_list *last;
		struct stat s;
		
		if(!strcasecmp(dent->d_name, ".") || !strcasecmp(dent->d_name, "..")) continue;
		
		files_total++;
		
		if(strlen(dent->d_name) > 15)
		{
			printf("Filename too long: %s\n", dent->d_name);
			continue;
		}
		
		sprintf(tmp, "%s/%s/%s", base_path, path, dent->d_name);
		
		if(stat(tmp, &s))
		{
			printf("Could not stat input file: %s\n", dent->d_name);
			continue;
		}
		
		if(!S_ISREG(s.st_mode))
		{
			DIR *new_d;
			char new_path[1024];
			
			files_total--;
			
			new_d = opendir(tmp);
			
			if(!new_d)
			{
				printf("Error opening input directory %s\n", tmp);
				return;
			}
			
			if(strcmp(path, "")) sprintf(new_path, "%s/%s", path, dent->d_name);
			else strcpy(new_path, dent->d_name);
			
			read_directory(base_path, new_path, new_d);
			
			closedir(new_d);
			
			continue;
		}
		
		lookup_value1 = lgp_lookup_value(dent->d_name[0]);
		lookup_value2 = lgp_lookup_value(dent->d_name[1]);
		
		if(lookup_value1 > LOOKUP_VALUE_MAX || lookup_value1 < 0 || lookup_value2 > LOOKUP_VALUE_MAX || lookup_value2 < -1)
		{
			printf("Invalid filename: %s\n", dent->d_name);
			continue;
		}
		
		lookup_index = lookup_value1 * LOOKUP_VALUE_MAX + lookup_value2 + 1;
		
		lookup_table[lookup_index].num_files++;
		
		last = lookup_list[lookup_index];
		
		if(last) while(last->next) last = last->next;
		
		file = calloc(sizeof(*file), 1);
		strcpy(file->file_header.name, dent->d_name);
		sprintf(file->source_name, "%s/%s", path, dent->d_name);
		file->file_header.size = s.st_size;
		file->next = 0;
		
		if(last) last->next = file;
		else lookup_list[lookup_index] = file;
		
		files_read++;
	}
}

int main(int argc, char *argv[])
{
	DIR *d;
	FILE *f;
	int toc_size;
	int toc_index = 0;
	int offset = 0;
	int i;
	char tmp[512];
	int conflict_table_size = 2;
	unsigned short num_conflicts = 0;
	
	if(argc < 3)
	{
		printf("Usage: lgp <directory> <archive>\n");
		return -1;
	}
	
	d = opendir(argv[1]);
	
	if(!d)
	{
		printf("Error opening input directory\n");
		return -1;
	}
	
	memset(lookup_table, 0, sizeof(lookup_table));
	
	read_directory(argv[1], "", d);
	
	closedir(d);
	
	if(!files_read)
	{
		printf("No input files found.\n");
		return 0;
	}
	
	unlink(argv[2]);
	f = fopen(argv[2], "wb");
	
	if(!f)
	{
		printf("Error opening output file.\n");
		return -1;
	}
	
	printf("Number of files to add: %i\n", files_read);
	
	fwrite("\0\0SQUARESOFT", 12, 1, f);
	fwrite(&files_read, 4, 1, f);
	
	for(i = 0; i < LOOKUP_TABLE_ENTRIES; i++)
	{
		struct file_list *file = lookup_list[i];
		
		while(file)
		{
			file->toc_index = toc_index++;
			file = file->next;
		}
	}
	
	for(i = 0; i < LOOKUP_TABLE_ENTRIES; i++)
	{
		struct file_list *file = lookup_list[i];
		
		while(file)
		{
			if(!file->conflict)
			{
				struct file_list *file2 = lookup_list[i];
				
				debug_printf("Finding conflict for file %s\n", file->file_header.name);
				
				while(file2)
				{
					if(!strcasecmp(file->file_header.name, file2->file_header.name) && file != file2)
					{
						if(num_conflict_entries[num_conflicts] == 0)
						{
							debug_printf("New conflict %i (%s)\n", num_conflicts + 1, file->file_header.name);
							
							file->conflict = num_conflicts + 1;
							strncpy(conflicts[num_conflicts][0].name, file->source_name, strlen(file->source_name) - strlen(file->file_header.name) - 1);
							conflicts[num_conflicts][0].toc_index = file->toc_index;
							num_conflict_entries[num_conflicts]++;
							
							conflict_table_size += 130;
						}
						
						file2->conflict = num_conflicts + 1;
						strncpy(conflicts[num_conflicts][num_conflict_entries[num_conflicts]].name, file2->source_name, strlen(file2->source_name) - strlen(file2->file_header.name) - 1);
						conflicts[num_conflicts][num_conflict_entries[num_conflicts]].toc_index = file2->toc_index;
						num_conflict_entries[num_conflicts]++;
						
						conflict_table_size += 130;
					}
					
					file2 = file2->next;
				}
				
				if(num_conflict_entries[num_conflicts] != 0)
				{
					num_conflicts++;
					conflict_table_size += 2;
				}
			}
			else debug_printf("Not finding conflict for file %s (%i)\n", file->file_header.name, file->conflict);
			
			file = file->next;
		}
	}
	
	if(num_conflicts) debug_printf("%i conflicts\n", num_conflicts);
	
	toc_size = files_read * sizeof(struct toc_entry);
	
	for(i = 0; i < LOOKUP_TABLE_ENTRIES; i++)
	{
		struct file_list *file = lookup_list[i];
		struct toc_entry toc;
		
		if(file) lookup_table[i].toc_offset = file->toc_index + 1;
		
		while(file)
		{
			memcpy(toc.name, file->file_header.name, 20);
			toc.offset = 16 + files_read * sizeof(struct toc_entry) + LOOKUP_TABLE_ENTRIES * 4 + conflict_table_size + offset;
			toc.unknown1 = 14;
			toc.conflict = file->conflict;
			
			fwrite(&toc, sizeof(struct toc_entry), 1, f);
			
			offset += sizeof(file->file_header) + file->file_header.size;
			
			file = file->next;
		}
	}
	
	fwrite(lookup_table, sizeof(lookup_table), 1, f);
	
	fwrite(&num_conflicts, 2, 1, f);
	
	for(i = 0; i < MAX_CONFLICTS; i++)
	{
		if(num_conflict_entries[i] > 0)
		{
			fwrite(&num_conflict_entries[i], 2, 1, f);
			fwrite(conflicts[i], sizeof(**conflicts), num_conflict_entries[i], f);
		}
	}
	
	for(i = 0; i < LOOKUP_TABLE_ENTRIES; i++)
	{
		struct file_list *file = lookup_list[i];
		
		while(file)
		{
			FILE *inf;
			char *data;
			
			sprintf(tmp, "%s/%s", argv[1], file->source_name);
			inf = fopen(tmp, "rb");
			
			if(!inf)
			{
				printf("Error opening input file: %s\n", file->source_name);
				unlink(argv[2]);
				return -1;
			}
			
			data = malloc_read(inf, file->file_header.size);
			
			fwrite(&file->file_header, sizeof(file->file_header), 1, f);
			
			fwrite(data, file->file_header.size, 1, f);
			
			fclose(inf);
			
			free(data);
			
			file = file->next;
		}
	}
	
	fwrite("FINAL FANTASY7", 14, 1, f);
	
	fclose(f);
	
	printf("Successfully created archive with %i file(s) out of %i file(s) total.\n", files_read, files_total);
	
	return 0;
}
