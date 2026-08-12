"use client";
import Link from "next/link";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { FaLinkedin, FaFacebook, FaInstagram } from "react-icons/fa";
import { useState } from "react";

export default function Footer() {
  const [email, setEmail] = useState("");

  return (
    <footer className="bg-gray-900 text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">V6 Impresa AI</h3>
            <p className="text-gray-400 text-sm">Piattaforma di consulenza avanzata per business plan, brand analysis e marketing strategico.</p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contatti</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center gap-2"><Phone size={16} /> +39 02 123 4567</li>
              <li className="flex items-center gap-2"><Mail size={16} /> info@v6impresa.it</li>
              <li className="flex items-center gap-2"><MapPin size={16} /> Via Monte Napoleone, 8 - Milano</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Seguici</h4>
            <div className="flex gap-4">
              <Link href="#" className="text-gray-400 hover:text-white transition-colors"><FaLinkedin size={24} /></Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors"><FaFacebook size={24} /></Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors"><FaInstagram size={24} /></Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Newsletter</h4>
            <div className="flex">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="La tua email" className="flex-1 px-3 py-2 rounded-l-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <button className="px-4 py-2 bg-orange-500 rounded-r-lg hover:bg-orange-600 transition-colors"><Send size={18} /></button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} V6 Impresa AI. Tutti i diritti riservati.
        </div>
      </div>
    </footer>
  );
}
