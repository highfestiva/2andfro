#!/usr/bin/env python3

'''Partitions a large set of opposing A/B coordinates into two sets of "chunks". Each chunk has a center and a number
of references to chunks in the opposing set.'''

from collections import defaultdict
from kazaamtree.coord import latlng
from kazaamtree import kazaamindextree
from random import shuffle
from sys import stderr

def read_ab_coords(csvfile, progress):
	csvfile.readline()	# Skip header row.
	ab_coords = []
	for i,line in enumerate(csvfile):
		if not i&0x1fff:
			progress(i,end='\r')
		_,_,_,a1,a2,b1,b2 = [w.strip('\n"()') for w in line.split(',')]
		ab_coords.append((latlng(float(a1),float(a2)), latlng(float(b1),float(b2))))
	return ab_coords

def partition_ab_coords(ab_coords, bucket_size, progress):
	atree = kazaamindextree(bucket_size=bucket_size)
	btree = kazaamindextree(bucket_size=bucket_size)
	shuffle(ab_coords)
	for i,ab in enumerate(ab_coords):
		if not i&0x1fff:
			progress(i,end='\r')
		a,b = ab
		atree.add(a)
		btree.add(b)
	progress(end='\r')
	return atree,btree

def chunk_index_tree(tree, progress):
	buckets = tree.buckets()
	for i,bucket in enumerate(buckets):
		for crd in bucket:
			crd.chunk = i
		if not i&0x1ff:
			progress(i,end='\r')
	progress(end='\r')
	return len(buckets)

def write_chunks(outf, tree, other_tree, progress):
	outf.write('[\n')
	buckets = tree.buckets()
	for i,bucket in enumerate(buckets):
		center = bucket.center(crdtype=latlng)
		outf.write('[%f,%f,{' % (center.lat(),center.lng()))
		other_chunk_hits = defaultdict(int)
		for crd in bucket:
			other_coord = other_tree.index[crd.index]
			other_chunk_hits[other_coord.chunk] += 1
		outf.write(','.join('"%i":%i'%(other_chunk_index,refcnt) for other_chunk_index,refcnt in other_chunk_hits.items()))
		outf.write('}],\n' if i!=len(buckets)-1 else '}]\n')
		if not i&0x1ff:
			progress(i,end='\r')
	outf.write(']\n')
	progress(end='\r')

def _print_progess(*args, **kwargs):
	print(*args, **kwargs, file=stderr)

def _quiet(*args, **kwargs):
	pass

def partition_crds(inputcsv, a_json, b_json, min_chunk_size=100, progress=_print_progess):
	progress('Buffering input A/B coordinates...')
	ab_coords = read_ab_coords(inputcsv, progress=progress)
	progress('Complete input CSV is buffered. Partitioning coordinates...')
	atree,btree = partition_ab_coords(ab_coords, min_chunk_size*2, progress=progress)
	progress('Chunk-indexing A containing %i coordinates...' % len(atree.index))
	atree.chunkcnt = chunk_index_tree(atree, progress)
	progress('Chunk-indexing B containing %i coordinates...' % len(btree.index))
	btree.chunkcnt = chunk_index_tree(btree, progress)
	progress('Writing A JSON containing %i chunks...' % atree.chunkcnt)
	write_chunks(a_json, atree, btree, progress)
	progress('Writing B JSON containing %i chunks...' % btree.chunkcnt)
	write_chunks(b_json, btree, atree, progress)
	progress('Both output files written. Done. Data bandwidth reduced by %i%%.' % ((1-(a_json.tell()+b_json.tell())/inputcsv.tell())*100))

def partition_crds_fname(inputcsv_fname, a_json_fname, b_json_fname, min_chunk_size=100, progress=_print_progess):
	partition_crds(open(inputcsv_fname), open(a_json_fname,'w'), open(b_json_fname,'w'), min_chunk_size, progress)

if __name__ == '__main__':
	from argparse import ArgumentParser, FileType
	parser = ArgumentParser()
	parser.add_argument('--input', type=FileType('r'), default='one_million_users.csv', help="input comma-separated CSV file")
	parser.add_argument('--output-a', type=FileType('w'), default='a.json', help="output JSON file for A coordinates")
	parser.add_argument('--output-b', type=FileType('w'), default='b.json', help="output JSON file for B coordinates")
	parser.add_argument('--min-chunk-size', type=int, default=100, help="minimum number of coordinates to allow per chunk")
	parser.add_argument('--quiet', action='store_true', default=False, help="don't print progress during coodinate partitioning")
	options = parser.parse_args()
	partition_crds(options.input, options.output_a, options.output_b, min_chunk_size=options.min_chunk_size, progress = _quiet if options.quiet else _print_progess)
