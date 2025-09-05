import React from "react";
import type { HeroProps } from "../types/hero";
import { Link } from "react-router-dom";

const Hero: React.FC<HeroProps> = ({ title, subtitle, ctaText }) => (
    <section className="relative bg-gradient-to-r from-blue-600 via-indigo-700 to-purple-800 text-white min-h-[88vh] flex flex-col justify-center items-center overflow-hidden pt-16 md:pt-24">
        <div className="absolute top-10 left-1/4 w-[38vw] h-[36vw] bg-purple-400/40 blur-3xl rounded-full z-0 animate-pulse" />
        <div className="absoulte -bottom-20 right-1/4 w-[32vw] h-[30vw] bg-blue-400/40 blur-3xl rounded-full z-0 animate-pulse" />
        <div className="absolute top-[60%] left-[60%] w-[18vw] h-[16vw] bg-pink-400/40 blur-2xl rounded-full z-0 animate-pulse" />

        <div className="container mx-auto text-center px-4 relative z-20">
            <h2 className="text-5xl md:text-7xl font-extrabold mb-7 drop-shadow-2xl">{title}</h2>
            <p className="text-xl md:text-2xl mb-10 text-blue-100/90 drop-shadow-xl">{subtitle}</p>
            
            {/* Here i need to use the civic, so when we dont have the user, we need to display the link button to login */}
            <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white font-bold py-4 px-10 rounded-2xl shadow-2xl hover:bg-blue-900 hover:scale-105 transition text-xl ring-2 rind-blue-400/40 hover:ring-blue-700 drop-shadow-lg"
                style={{
                    boxShadow: "0 6px 32px 0 rgba(60,30,130,0.25)"
                }}
            >
                <span>{ctaText}</span>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l17 7-7 7"/>
                </svg>
            </Link>
        </div>

        <div className="absolute left-0 right-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-gray-50 pointer-events-none z-10" />
    </section>
);

export default Hero;