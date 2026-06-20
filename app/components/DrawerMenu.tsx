import React from 'react';
import Link from 'next/link';

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const DrawerMenu: React.FC<DrawerMenuProps> = ({ isOpen, onClose }) => {
  return (
    <>
      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
      <div className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-[#0f172a] shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="relative h-full flex flex-col">
          <button 
            onClick={onClose}
            className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors duration-200 p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex-1 overflow-y-auto p-6">
            <nav className="space-y-4">
              <Link href="/" className="block text-white/70 hover:text-white transition-colors duration-200">
                Início
              </Link>
              <Link href="/sobre" className="block text-white/70 hover:text-white transition-colors duration-200">
                Sobre
              </Link>
              <Link href="/coordenadorias" className="block text-white/70 hover:text-white transition-colors duration-200">
                Coordenadorias
              </Link>
              <Link href="/contato" className="block text-white/70 hover:text-white transition-colors duration-200">
                Contato
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
};

export default DrawerMenu; 