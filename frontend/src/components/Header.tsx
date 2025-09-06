import React, { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "@civic/auth-web3/react";
import { userHasWallet } from "@civic/auth-web3";
import { useAccount, useConnect } from "wagmi";

const POST_SIGNIN_REDIRECT_KEY = "postSignInRedirect";

const Header: React.FC = () => {
  const userCtx = useUser();
  const { user, signIn, signOut } = userCtx;

  const { connect, connectors, status: connectStatus } = useConnect();
  const { isConnected, address } = useAccount();

  const location = useLocation();
  const navigate = useNavigate();

  const shortAddr = useMemo(
    () => (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ""),
    [address]
  );

  const connectExistingWallet = () => {
    return connect({ connector: connectors?.[0] });
  };

  const handleCreateWallet = async () => {
    if (user && !userHasWallet(userCtx)) {
      return userCtx.createWallet().then(connectExistingWallet);
    }
  };

  // After sign-in, bounce back to intended path if we stored one
  useEffect(() => {
    if (user) {
      const pending = sessionStorage.getItem(POST_SIGNIN_REDIRECT_KEY);
      if (pending) {
        sessionStorage.removeItem(POST_SIGNIN_REDIRECT_KEY);
        navigate(pending, { replace: true });
      }
    }
  }, [user, navigate]);

  // Guarded navigation: if not signed in, trigger sign-in and remember target
  const goProtected = (path: string) => {
    if (!user) {
      sessionStorage.setItem(POST_SIGNIN_REDIRECT_KEY, path);
      return signIn();
    }
    navigate(path);
  };

  return (
    <header className="bg-white/60 backdrop-blur z-20 shadow-sm">
      <div className="container mx-auto flex justify-between items-center px-6 py-4">
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-2xl text-blue-700 tracking-tight"
        >
          <span className="inline-block bg-blue-600 text-white rounded-full px-2 py-1 text-lg">Q</span>
          QualifyPro
        </Link>

        <nav className="hidden md:block">
          <ul className="flex space-x-8 text-blue-900 font-medium">
            <li>
              <Link to="/" className="hover:text-blue-600 transition">
                Home
              </Link>
            </li>

            {/* Protected links: only visible when authenticated */}
            {user && (
              <>
                <li>
                  <Link to="/certificates" className="hover:text-blue-400">
                    Certificates
                  </Link>
                </li>
                <li>
                  <Link to="/uploadCert" className="hover:text-blue-400">
                    Upload Certificates
                  </Link>
                </li>
              </>
            )}

            {/* If not authenticated, render buttons that trigger sign-in then redirect */}
            {!user && (
              <>
                <li>
                  <button
                    onClick={() => goProtected("/certificates")}
                    className="hover:text-blue-400"
                    aria-label="Sign in to view Certificates"
                  >
                    Certificates
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => goProtected("/uploadCert")}
                    className="hover:text-blue-400"
                    aria-label="Sign in to Upload Certificates"
                  >
                    Upload Certificates
                  </button>
                </li>
              </>
            )}

            {!user ? (
              <li>
                <button
                  onClick={signIn}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Sign In
                </button>
              </li>
            ) : (
              <>
                {!userHasWallet(userCtx) && (
                  <li>
                    <button
                      onClick={handleCreateWallet}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      Create Wallet
                    </button>
                  </li>
                )}

                {userHasWallet(userCtx) && !isConnected && (
                  <li>
                    <button
                      onClick={connectExistingWallet}
                      disabled={connectStatus === "pending"}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {connectStatus === "pending" ? "Connecting..." : "Connect Wallet"}
                    </button>
                  </li>
                )}

                {isConnected && (
                  <li className="flex items-center gap-3 px-3 py-2 bg-gray-100 rounded-lg">
                    <span className="text-sm font-semibold">{shortAddr}</span>
                  </li>
                )}

                <li>
                  <button
                    onClick={signOut}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Sign out
                  </button>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
