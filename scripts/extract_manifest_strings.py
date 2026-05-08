import struct
import sys

def extract_strings(axml_content):
    """Extracts strings from the binary AXML string pool."""
    try:
        # Header: magic(4), size(4)
        magic, size = struct.unpack('<II', axml_content[:8])
        if magic != 0x00080003:
            return ["Invalid AXML magic"]
        
        # String Pool Chunk: type(4), size(4)
        # Usually follows immediately or after some padding
        # Let's search for the String Pool magic: 0x001C0001
        pos = axml_content.find(struct.pack('<I', 0x001C0001))
        if pos == -1:
            return ["String pool chunk not found"]
        
        chunk_type, chunk_size, string_count, style_count, flags, string_offset, style_offset = struct.unpack('<IIIIIII', axml_content[pos:pos+28])
        
        # Strings offsets start after the chunk header
        offsets_pos = pos + 28
        offsets = struct.unpack('<' + 'I' * string_count, axml_content[offsets_pos:offsets_pos + 4 * string_count])
        
        strings_data_pos = pos + string_offset
        strings = []
        
        is_utf8 = (flags & (1 << 8)) != 0
        
        for offset in offsets:
            start = strings_data_pos + offset
            if is_utf8:
                # UTF-8 encoded
                # Length is encoded in first 1 or 2 bytes
                l1 = axml_content[start]
                if l1 & 0x80:
                    l1 = ((l1 & 0x7F) << 8) | axml_content[start+1]
                    start += 2
                else:
                    start += 1
                # The actual byte length is the next byte(s)
                l2 = axml_content[start]
                if l2 & 0x80:
                    l2 = ((l2 & 0x7F) << 8) | axml_content[start+1]
                    start += 2
                else:
                    start += 1
                strings.append(axml_content[start:start+l2].decode('utf-8', errors='ignore'))
            else:
                # UTF-16 encoded
                # Length is first 2 bytes
                length = struct.unpack('<H', axml_content[start:start+2])[0]
                if length & 0x8000:
                    length = ((length & 0x7FFF) << 16) | struct.unpack('<H', axml_content[start+2:start+4])[0]
                    start += 4
                else:
                    start += 2
                strings.append(axml_content[start:start+length*2].decode('utf-16le', errors='ignore'))
        
        return strings
    except Exception as e:
        return [f"Error: {e}"]

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_manifest_strings.py <binary_xml_path>")
        sys.exit(1)
    
    with open(sys.argv[1], 'rb') as f:
        content = f.read()
        extracted = extract_strings(content)
        for s in extracted:
            if s and len(s.strip()) > 0:
                print(s)
