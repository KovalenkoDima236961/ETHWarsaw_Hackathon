import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./page/Home";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { embeddedWallet } from "@civic/auth-web3/wagmi";
import { CivicAuthProvider } from "@civic/auth-web3";
import { mainnet, sepolia } from "viem/chains";
import UploadCertificatePage from "./page/UploadCertificate";

const CLIENT_ID = import.meta.env.VITE_CIVIC_CLIENT_ID;
const AUTH_SERVER = import.meta.env.VITE_AUTH_SERVER || "https://auth.civic.com/oauth";
const WALLET_API_BASE_URL = import.meta.env.VITE_WALLET_API_BASE_URL;

const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  connectors: [
    embeddedWallet(),
  ],
});

const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig as any}>
        <CivicAuthProvider 
          clientId={CLIENT_ID}
          // oauthServer and wallet are not necessary for production
          config={{ oauthServer: AUTH_SERVER }}
          endpoints={{ wallet: WALLET_API_BASE_URL }}
        >
          <Router>
            <div className="min-h-screen flex flex-col">
              <Routes>
                <Route path="/" element={ <Home />} />
                <Route path="/certificates" element={ <Home />} />
                <Route path="/uploadCert" element={ <UploadCertificatePage />} />
              </Routes>
            </div>
          </Router>
        </CivicAuthProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

export default App
