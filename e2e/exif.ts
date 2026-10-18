/**
 * Test fixtures for the Photo Cleaner (#212): puts an EXIF block, with a camera, a date taken and
 * a GPS location, into a JPEG, the way a phone's camera writes one.
 */

type Field = { tag: number; type: 2 | 4 | 5; values: number[] | string };

/** A little-endian TIFF with IFD0 and a GPS IFD, as found inside an APP1 `Exif` segment. */
function tiff(ifd0: Field[], gps: Field[]): Buffer {
	const GPS_POINTER = 0x8825;
	const ifdSize = (fields: Field[]) => 2 + fields.length * 12 + 4;
	const ifd0Fields = [...ifd0, { tag: GPS_POINTER, type: 4, values: [0] } as Field].sort(
		(a, b) => a.tag - b.tag
	);
	const ifd0At = 8;
	const gpsAt = ifd0At + ifdSize(ifd0Fields);
	let dataAt = gpsAt + ifdSize(gps);
	const out = Buffer.alloc(4096);
	out.write('II', 0, 'latin1');
	out.writeUInt16LE(42, 2);
	out.writeUInt32LE(ifd0At, 4);

	const writeIfd = (at: number, fields: Field[]) => {
		out.writeUInt16LE(fields.length, at);
		fields.forEach((field, i) => {
			const entry = at + 2 + i * 12;
			const bytes =
				field.type === 2
					? Buffer.from(`${field.values as string}\0`, 'latin1')
					: Buffer.alloc(field.type === 4 ? 4 : 8 * (field.values as number[]).length);
			if (field.type === 4) bytes.writeUInt32LE(field.tag === GPS_POINTER ? gpsAt : 0, 0);
			if (field.type === 5)
				(field.values as number[]).forEach((v, j) => {
					bytes.writeUInt32LE(v, j * 8);
					bytes.writeUInt32LE(1, j * 8 + 4);
				});
			const count = field.type === 2 ? bytes.length : (field.values as number[]).length;
			out.writeUInt16LE(field.tag, entry);
			out.writeUInt16LE(field.type, entry + 2);
			out.writeUInt32LE(count, entry + 4);
			if (bytes.length <= 4) bytes.copy(out, entry + 8);
			else {
				out.writeUInt32LE(dataAt, entry + 8);
				bytes.copy(out, dataAt);
				dataAt += bytes.length + (bytes.length % 2);
			}
		});
		out.writeUInt32LE(0, at + 2 + fields.length * 12);
	};
	writeIfd(ifd0At, ifd0Fields);
	writeIfd(gpsAt, gps);
	return out.subarray(0, dataAt);
}

/** `jpeg` with an EXIF block right after its start marker. */
export function withExif(
	jpeg: Buffer,
	{ make, model, taken }: { make: string; model: string; taken: string }
): Buffer {
	const body = Buffer.concat([
		Buffer.from('Exif\0\0', 'latin1'),
		tiff(
			[
				{ tag: 0x010f, type: 2, values: make },
				{ tag: 0x0110, type: 2, values: model },
				{ tag: 0x0132, type: 2, values: taken }
			],
			[
				{ tag: 0x0001, type: 2, values: 'N' },
				{ tag: 0x0002, type: 5, values: [41, 52, 30] },
				{ tag: 0x0003, type: 2, values: 'W' },
				{ tag: 0x0004, type: 5, values: [87, 37, 45] }
			]
		)
	]);
	const header = Buffer.alloc(4);
	header.writeUInt16BE(0xffe1, 0);
	header.writeUInt16BE(body.length + 2, 2);
	return Buffer.concat([jpeg.subarray(0, 2), header, body, jpeg.subarray(2)]);
}
