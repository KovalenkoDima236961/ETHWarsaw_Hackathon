import React from "react";
import type { HeroProps } from "../types/hero";
import { useUser  } from "@civic/auth-web3/react";
import { Link } from "react-router-dom";

const Hero: React.FC<HeroProps> = ({ title, subtitle, ctaText }) => {
    const { user, signIn } = useUser();

    return (
        <section className="relative bg-gradient-to-r from-blue-600 via-indigo-700 to-purple-800 text-white min-h-[88vh] flex flex-col justify-center items-center overflow-hidden pt-16 md:pt-24">
            <div className="absolute top-10 left-1/4 w-[38vw] h-[36vw] bg-purple-400/40 blur-3xl rounded-full z-0 animate-pulse" />
            <div className="absoulte -bottom-20 right-1/4 w-[32vw] h-[30vw] bg-blue-400/40 blur-3xl rounded-full z-0 animate-pulse" />
            <div className="absolute top-[60%] left-[60%] w-[18vw] h-[16vw] bg-pink-400/40 blur-2xl rounded-full z-0 animate-pulse" />

            <div className="container mx-auto text-center px-4 relative z-20">
                <h2 className="text-5xl md:text-7xl font-extrabold mb-7 drop-shadow-2xl">{title}</h2>
                <p className="text-xl md:text-2xl mb-10 text-blue-100/90 drop-shadow-xl">{subtitle}</p>
                
                {!user ?
                    (
                        <button 
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white font-bold py-4 px-10 rounded-2xl shadow-2xl hover:bg-blue-900 hover:scale-105 transition text-xl ring-2 ring-blue-400/40 hover:ring-blue-700 drop-shadow-lg"
                            style={{
                                boxShadow: "0 6px 32px 0 rgba(60,30,130,0.25)"
                            }}
                            onClick={signIn}
                        >
                            <span>{ctaText}</span>
                            <svg
                                className="w-6 h-6 text-white transition-transform group-hover:translate-x-1"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M3 12H20" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M20 12l-6-6M20 12l-6 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    )
                :   
                    (
                        <Link 
                            to="/uploadCert"
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 via-emerald-700 to-teal-700
                                       text-white font-bold py-4 px-10 rounded-2xl shadow-2xl
                                       hover:scale-105 hover:from-green-700 hover:to-teal-800
                                       transition-transform text-xl ring-2 ring-green-400/40 hover:ring-green-600
                                       drop-shadow-lg"
                            style={{
                                boxShadow: "0 6px 32px 0 rgba(30, 100, 60, 0.25)"
                            }}
                        >
                            <span>Let's mint certificate</span>
                            <svg
                                className="w-6 h-6 text-white transition-transform group-hover:translate-x-1"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M3 12H20" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M20 12l-6-6M20 12l-6 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </Link>
                    )
                }
            </div>

            <div className="absolute left-0 right-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-gray-50 pointer-events-none z-10" />
        </section>
    )
    
};

export default Hero;