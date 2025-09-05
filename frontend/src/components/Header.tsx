import React from "react";
import { Link } from "react-router-dom";
import { useUser } from "@civic/auth-web3/react";

const Header: React.FC = () => {
    const { user, signIn, signOut } = useUser();

    return (
        <header className="bg-white/60 backdrop-blur z-20 shadow-sm">
            <div className="container mx-auto flex justify-between items-center px-6 py-4">
                <Link to="/" className="flex items-center gap-2 font-bold text-2xl text-blue-700 tracking-tight">
                    <span className="inline-block bg-blue-600 text-white rounded-full px-2 py-1 text-lg">Q</span>
                    QualifyPro
                </Link>
                <nav className="hidden md:block">
                    <ul className="flex space-x-8 text-blue-900 font-medium">
                        <li><Link to="/" className="hover:text-blue-600 transition">Home</Link></li>
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
                        {!user ? (
                            <button onClick={signIn} className="px-4 py-2 bg-blue-500 text-white rounded">
                                Sign into
                            </button>
                        ) : (
                            <button onClick={signOut} className="px-4 py-2 bg-red-500 text-white rounded">
                                Sign out
                            </button>
                        )}
                    </ul>
                </nav>
            </div>
        </header>
    );
}

export default Header;