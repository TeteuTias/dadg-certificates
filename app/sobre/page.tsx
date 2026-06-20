'use client'
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import './styles.css';

export default function Sobre() {
  return (
    <div className="sobre-container">
      <div className="sobre-content">
        <section className="sobre-section">
          <h1 className="sobre-title">Sobre Nós</h1>
          <div className="sobre-grid">
            <div className="sobre-text-content">
              <p className="sobre-text">
                O DADG (Diretório Acadêmico Diogo Guimarães) é uma entidade representativa dos estudantes de Medicina do Imepac,
                comprometida com a excelência acadêmica e o desenvolvimento profissional de seus membros.
              </p>
              <p className="sobre-text">
                Nossa missão é promover a integração entre os alunos, fomentar o debate médico e contribuir para a formação
                de profissionais éticos e comprometidos com a saúde da população.
              </p>
            </div>
            <div className="sobre-image">
              <Image
                src="/logoDadg02.png"
                alt="Logo DADG"
                width={500}
                height={300}
                className="sobre-img"
              />
            </div>
          </div>
        </section>

        <section className="sobre-section">
          <div className="missao-valores">
            <div className="missao-card" style={{
              background: "#09427d"
            }}>
              <h2 className="missao-title">Nossa Missão</h2>
              <p className="sobre-text">
                Representar e defender os interesses dos estudantes de Medicina, promovendo atividades acadêmicas,
                culturais e sociais que contribuam para a formação integral dos alunos e o fortalecimento da comunidade acadêmica.
              </p>
            </div>

            <div className="valores-card" style={{
              background: "#09427d"
            }}>
              <h2 className="valores-title">Nossos Valores</h2>
              <ul className="valores-list">
                <li className="valores-item">Excelência Acadêmica</li>
                <li className="valores-item">Compromisso com a Saúde</li>
                <li className="valores-item">Ética e Transparência</li>
                <li className="valores-item">Integração e Colaboração</li>
                <li className="valores-item">Responsabilidade Social</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="sobre-section">
          <h2 className="sobre-title">Nossa História</h2>
          <p className="sobre-text">
            Fundado com o propósito de representar os interesses dos estudantes de Medicina do Imepac, o DADG tem se destacado por sua atuação proativa e comprometida com a qualidade do ensino médico. Ao longo dos anos, temos organizado diversos eventos acadêmicos, palestras, workshops e atividades culturais que enriquecem a formação dos nossos alunos.
          </p>
        </section>

        <section className="sobre-section contato-section">
          <h2 className="sobre-title">Entre em Contato</h2>
          <p className="sobre-text">
            Fique à vontade para entrar em contato conosco através de nossas redes sociais
          </p>
          <Link href="/contato" className="contato-button">
            Redes Sociais
          </Link>
        </section>
      </div>
    </div>
  );
}
