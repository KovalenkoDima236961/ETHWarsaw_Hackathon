import { ethers, hexlify, zeroPadValue } from "ethers";
import CryptoJS from "crypto-js";

export async function hashPdfFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    return ethers.keccak256(uint8);
}

export const normalizeBytes32 = (hex: string) => 
    hexlify(zeroPadValue(hex.startsWith("0x") ? hex: "0x" + hex, 32));


const uint8ArrayToWordArray = (u8: Uint8Array): CryptoJS.lib.WordArray => {
    const words = [];
    for (let i = 0; i < u8.length; i += 4) {
        words.push(
            (u8[i] << 24) |
            ((u8[i + 1] ?? 0) << 16) |
            ((u8[i + 2] ?? 0) << 8) |
            (u8[i + 3] ?? 0)
        );
    }
    return CryptoJS.lib.WordArray.create(words, u8.length);
}

export const wordArrayToUint8Array = (wordArray: CryptoJS.lib.WordArray): Uint8Array => {
    const { words, sigBytes } = wordArray;
    const u8 = new Uint8Array(sigBytes);
    let i = 0, j = 0;
    while (i < sigBytes) {
        const w = words[j++];
        u8[i++] = (w >> 24) & 0xff;
        if (i === sigBytes) break;
        u8[i++] = (w >> 16) & 0xff;
        if (i === sigBytes) break;
        u8[i++] = (w >>  8) & 0xff;
        if (i === sigBytes) break;
        u8[i++] =  w        & 0xff;
    }
    return u8;
}

export const aesEncryptBytes = (plainBytes: Uint8Array, key: CryptoJS.lib.WordArray): Uint8Array => {
    const ivBytes = crypto.getRandomValues(new Uint8Array(16));
    const ivWA = uint8ArrayToWordArray(ivBytes);
    const plainWA = uint8ArrayToWordArray(plainBytes);

    const enc = CryptoJS.AES.encrypt(plainWA, key, { iv: ivWA, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
    const cipherBytes = wordArrayToUint8Array(enc.ciphertext);

    const out = new Uint8Array(16 + cipherBytes.length);
    out.set(ivBytes, 0);
    out.set(cipherBytes, 16);
    return out;
}

export const aesEncryptJson = (obj: any, key: CryptoJS.lib.WordArray): Uint8Array => {
    const text = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(text);
    return aesEncryptBytes(bytes, key);
}