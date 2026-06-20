'use client';

import React from 'react';
import Link from 'next/link';
import { FaInstagram } from 'react-icons/fa';
import './style.css';

const instagramAccounts = [
  { name: "DADG ImePAC", handle: "@dadg.imepac", url: "https://instagram.com/dadg.imepac" },
  { name: "CAEP ImePAC", handle: "@caep.imepac", url: "https://instagram.com/caep.imepac" },
  { name: "CLAM ImePAC", handle: "@clam.imepac", url: "https://instagram.com/clam.imepac" },
  { name: "CLEVI ImePAC Araguari", handle: "@clevimepacaraguari", url: "https://instagram.com/clevimepacaraguari" },
  { name: "CAES ImePAC", handle: "@caes.imepac", url: "https://instagram.com/caes.imepac" },
  { name: "COEPS Araguari", handle: "@coeps.araguari", url: "https://instagram.com/coeps.araguari" },
];

export default function ContatoPage() {
  return (
    <main className="contato-container">
      <div className="contato-content">
        <header className="contato-header">
          <h1 className="contato-title">Contato</h1>
          <p className="contato-subtitle">
            Siga-nos no Instagram para ficar por dentro das novidades e entre em contato pelo e-mail.
          </p>
        </header>

        <section className="contato-grid">
          {instagramAccounts.map((account) => (
            <Link
              key={account.handle}
              href={account.url}
              target="_blank"
              rel="noopener noreferrer"
              className="contato-card instagram-hover"
            >
              <span className="contato-card-icon" aria-hidden>
                <FaInstagram size={28} />
              </span>
              <span className="contato-card-name">{account.name}</span>
              <span className="contato-card-handle">{account.handle}</span>
            </Link>
          ))}
        </section>

        <section className="contato-email-section">
          <div className="email-shadow-wrapper">
            <div className="contato-email-card email-hover">
              <p className="contato-email-label">E-mail</p>
              <a
                href="mailto:dadg.imepac@gmail.com"
                className="contato-email-link"
              >
                dadg.imepac@gmail.com
              </a>
            </div>
          </div>
        </section>

        <section className="contato-ouvidoria-wrap">
          <Link href="/ouvidoria" className="contato-ouvidoria-card">
            <p className="contato-ouvidoria-text">
              Mas se precisar falar de algo mais sério, use nossa ouvidoria.
            </p>
            <span className="contato-ouvidoria-link">
              Ir para Ouvidoria
              <span className="contato-ouvidoria-arrow" aria-hidden>→</span>
            </span>
          </Link>
        </section>
      </div>

      <div className="contato-wave">
        <svg viewBox="0 0 500 150" preserveAspectRatio="none">
          <path
            d="M0.00,49.98 C150.00,150.00 349.12,-50.00 500.00,49.98 L500.00,150.00 L0.00,150.00 Z"
            fill="#09427d"
          />
        </svg>
      </div>
    </main>
  );
}
