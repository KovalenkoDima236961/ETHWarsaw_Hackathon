import React, {useState, type ChangeEvent} from "react";
import type { VerifyResult } from "../types/verifyResult";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { normalizeBytes32, hashPdfFile } from "../utils/cryptography";
import { isPdfHashUsed, mintCertificateNFT } from "../utils/tools";
import { useUser } from "@civic/auth-web3/react"

const LOCALHOST_LINK=import.meta.env.VITE_LOCALHOST_LINK;

const UploadCertificatePage: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<VerifyResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hashPdf, setHashPdf] = useState<string | null>(null);
    const userCtx = useUser();

    const getCivicToken = async () => {
      if (typeof (userCtx as any)?.getIdToken === "function") {
        return await (userCtx as any).getIdToken();
      }
      const tok = (userCtx as any)?.idToken;
      if (!tok) throw new Error("Missing Civic ID token. Please sign in.");
      return tok;
    }

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setResult(null);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setLoading(true);
        setResult(null);
        setError(null);

        try {
            const pdfHash = normalizeBytes32(await hashPdfFile(selectedFile));
            const alreadyUsed = await isPdfHashUsed(pdfHash);
            if (alreadyUsed) {
                setError("Certificate with this PDF already minted!");
                setLoading(false);
                return;
            }
            setHashPdf(pdfHash);

            const formData = new FormData();
            formData.append("file", selectedFile);

            const url = new URL(`${LOCALHOST_LINK}/api/verify_certificate`);
            
            const res = await fetch(url, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                let msg = "Failed to verify certificate";
                try {
                  const errorData = await res.json();
                  msg = errorData.detail || JSON.stringify(errorData);
                } catch {
                  msg = await res.text();
                }
                setError(msg);
                setLoading(false);
                return;
            }

            const data = await res.json();
            setResult(data);
        } catch (err: any) {
            setError("An error occurred: " + err.message);
        }  finally {
            setLoading(false);
        }
    };

    return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-blue-50 to-purple-100">
      <Header />
      <main className="flex-grow flex flex-col items-center justify-center">
        <div className="w-full max-w-xl mx-auto mt-10">
          <div className="bg-white/90 shadow-2xl rounded-2xl px-10 py-12 relative overflow-hidden">
            
            <h2 className="text-3xl font-bold text-center text-blue-800 mb-4">Upload Certificate</h2>
            <p className="text-center text-gray-500 mb-8">
              Securely upload your PDF certificate for verification. Only your wallet can decrypt it!
            </p>
            <label
              htmlFor="upload-certificate"
              className={`flex flex-col items-center justify-center border-2 border-dashed ${
                selectedFile
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 bg-gray-50 hover:border-blue-400"
              } rounded-xl px-6 py-8 cursor-pointer transition-colors`}
            >
              <svg className="w-12 h-12 text-blue-400 mb-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0L8 8m4 0l4 0m0 0l-4-4m0 4V4m0 12v4m0 0l-4 0m4 0l4 0" />
              </svg>
              <span className="text-blue-800 font-medium mb-1">
                {selectedFile ? selectedFile.name : "Click or drag file to upload"}
              </span>
              <span className="text-gray-400 text-xs">
                Only PDF certificates are supported.
              </span>
              <input
                id="upload-certificate"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            <button
              className="w-full mt-7 mb-4 bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl transition-colors duration-200 disabled:opacity-60"
              disabled={!selectedFile || loading}
              onClick={handleUpload}
            >
              {loading ? (
                <span>
                  <svg className="inline w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                  Verifying...
                </span>
              ) : (
                "Upload & Verify"
              )}
            </button>
            {error && (
              <div className="bg-red-100 text-red-600 rounded-lg p-3 text-center text-sm mb-3 border border-red-200">
                {error}
              </div>
            )}
            {result && (
              <div className={`mt-3 p-5 rounded-xl border ${result.is_verified ? "border-green-400 bg-green-50" : "border-red-300 bg-red-50"}`}>
                <h3 className={`font-semibold mb-3 ${result.is_verified ? "text-green-700" : "text-red-700"}`}>
                  Verification {result.is_verified ? "Successful" : "Failed"}
                </h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <div>
                    <span className="font-medium">Certificate ID:</span> {result.fields.fields["Certificate ID"]}
                  </div>
                  <div>
                    <span className="font-medium">User Name:</span> {result.fields.fields["User Name & Surname"]}
                  </div>
                  <div>
                    <span className="font-medium">Course Name:</span> {result.fields.fields["Course Name"]}
                  </div>
                  <div>
                    <span className="font-medium">Instructor:</span> {result.fields.fields["Instructor"]}
                  </div>
                </div>
                <button
                  className="w-full mt-6 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-bold py-3 rounded-xl transition-colors duration-200"
                  onClick={() => 
                    mintCertificateNFT(
                      result.fields, 
                      selectedFile!, 
                      hashPdf,
                      getCivicToken,
                      false, // useRelayer=false (set true to go gasless)
                    )
                  }
                >
                  Mint Certificate NFT
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default UploadCertificatePage;