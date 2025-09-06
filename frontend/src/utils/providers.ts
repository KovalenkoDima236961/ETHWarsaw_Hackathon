import { BrowserProvider, JsonRpcProvider } from "ethers";

const VITE_IS_DEV = import.meta.env.VITE_IS_DEV;

let browserProvider: BrowserProvider | null = null;
export const getBrowserProvider = (): BrowserProvider => {
    if (!browserProvider) browserProvider = new BrowserProvider(window.ethereum);
    return browserProvider;
}

let readPovider: JsonRpcProvider | null = null;
export const getReadProvider = (): JsonRpcProvider | null => {
    if (!readPovider) {
        if (VITE_IS_DEV) readPovider = new JsonRpcProvider("http://localhost:8545");
        else readPovider = null;
    }
    return readPovider;
}