import React from "react";

const Footer: React.FC = () => (
    <footer className="bg-gradient-to-t from-gray-900 via-gray-800 to-gray-700 text-gray-200 py-10 mt-20">
        <div className="container mx-auto text-center px-4">
            <span className="text-lg font-semibold tracking-wide">QualifyPro</span>
        </div>
        <div className="mb-4 text-gray-400 space-x-6">
            <a href="https://t.me/@dimon22856" target="_blank" rel="noopener noreferrer" className="inline-block mx-1 hover:text-blue-400">Telegram</a>
        </div>
        <hr className="border-gray-700 mb-4" />
        <p className="text-sm">&copy: {new Date().getFullYear()} QualifyPro.</p>
    </footer>
)

export default Footer;