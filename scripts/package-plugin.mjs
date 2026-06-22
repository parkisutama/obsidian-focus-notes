import { readFileSync, writeFileSync } from "fs";

const packageName = "focus-notes.zip";
const artifacts = ["main.js", "manifest.json", "styles.css"];

const crcTable = new Uint32Array(256);
for (let i = 0; i < crcTable.length; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crcTable[i] = value >>> 0;
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value) {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(value);
    return buffer;
}

function uint32(value) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value);
    return buffer;
}

const localFileHeaders = [];
const centralDirectoryHeaders = [];
let offset = 0;

for (const artifact of artifacts) {
    const fileName = Buffer.from(artifact);
    const content = readFileSync(artifact);
    const checksum = crc32(content);

    const localFileHeader = Buffer.concat([
        uint32(0x04034b50),
        uint16(20),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(checksum),
        uint32(content.length),
        uint32(content.length),
        uint16(fileName.length),
        uint16(0),
        fileName,
        content,
    ]);

    localFileHeaders.push(localFileHeader);

    centralDirectoryHeaders.push(
        Buffer.concat([
            uint32(0x02014b50),
            uint16(20),
            uint16(20),
            uint16(0),
            uint16(0),
            uint16(0),
            uint16(0),
            uint32(checksum),
            uint32(content.length),
            uint32(content.length),
            uint16(fileName.length),
            uint16(0),
            uint16(0),
            uint16(0),
            uint16(0),
            uint32(0),
            uint32(offset),
            fileName,
        ])
    );

    offset += localFileHeader.length;
}

const centralDirectory = Buffer.concat(centralDirectoryHeaders);
const endOfCentralDirectory = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(artifacts.length),
    uint16(artifacts.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0),
]);

writeFileSync(packageName, Buffer.concat([...localFileHeaders, centralDirectory, endOfCentralDirectory]));

console.log(`Packaged ${packageName}.`);
