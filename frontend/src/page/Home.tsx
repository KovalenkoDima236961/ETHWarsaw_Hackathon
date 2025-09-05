import React from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Hero from "../components/Hero";

const Home: React.FC = () => (
    <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow">
            <Hero 
                title="Verify Qualifications with Confidence"
                subtitle="Streamline your qualification verification process with our secure, fast, and user-friendly platform."
                ctaText="Get Started Now"
            />
        </main>
        <Footer />
    </div>
);

export default Home;