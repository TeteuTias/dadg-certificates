'use client';

import React, { useEffect } from 'react';
import { Poppins } from 'next/font/google';
import ScheduleClient from '../components/ScheduleClient';
import './style.css';

const stylePoppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: [
    '100',
    '200',
    '300',
    '400',
    '500',
    '600',
    '700',
    '800',
    '900'
  ],
  style: ['normal', 'italic']
});

export default function AgendaPage() {
  useEffect(() => {
    // Criar partículas
    const particlesContainer = document.querySelector('.particles');
    if (particlesContainer) {
      for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 8}s`;
        particlesContainer.appendChild(particle);
      }
    }
  }, []);

  return (
    <div className="events-container" style={stylePoppins.style}>
      <div className="particles"></div>
      
      <div className="events-content">
        <div className="events-header">
          <h1 className="text-white text-4xl sm:text-5xl md:text-6xl font-bold mb-4 tracking-wide">
            CALENDÁRIO DE EVENTOS
          </h1>
          <p className="events-subtitle">
            Acompanhe todos os eventos e atividades da Imepac
          </p>
        </div>

        <div className="calendar-container">
          <ScheduleClient />
        </div>
      </div>
    </div>
  );
}
