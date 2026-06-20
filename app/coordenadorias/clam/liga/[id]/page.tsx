'use client'
import './style.css';
import { useEffect, useState } from 'react';
import { IAcademicLeague } from '@/app/lib/models/AcademicLeagues';
import { Poppins } from 'next/font/google';
import { FaHeartbeat, FaUserMd, FaStar, FaInfoCircle, FaListUl } from 'react-icons/fa';
import { ObjectId } from 'bson';

const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600', '700'],
  style: ['normal'],
});

export default function LamePage({ params }: { params: Promise<{ id: string }> }) {

  const [data, setData] = useState<IAcademicLeague | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const { id } = await params
      if (!id || !ObjectId.isValid(id)) {
        alert("O parâmetro 'id' não presente ou inválido.")
        return;
      }
      const response = await fetch(`/api/get/getAcademicLeagueById/${id}`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data: { data: IAcademicLeague } = await response.json();
      setData(data.data);
    }
    fetchData()
  }, [params])
  if (!data) {
    return (
      <main className="lame-main" style={poppins.style}>
        <div className="lame-loading">Carregando...</div>
      </main>
    );
  }
  return (
    <main className="lame-main" style={poppins.style}>
      <div className="lame-header">
        <div className="lame-logo-circle-pro">
          <img
            src={"/leagues/" + data?.acronym.toLocaleLowerCase() + ".png"}
            alt="Logo CLAM"
            className='rounded-full'
            width={180}
            height={180}
          />
        </div>
        <div className="lame-title-block">
          <h1 className="lame-title-gradient">{data?.name}</h1>
          <div className="lame-info-card-pro">
            <div className="lame-info-item-pro">
              <FaStar className="lame-info-icon" />
              <span className="lame-info-label-pro">Sigla</span>
              <span className="lame-info-value-pro">{data?.acronym}</span>
            </div>
            <div className="lame-info-item-pro">
              <FaHeartbeat className="lame-info-icon" />
              <span className="lame-info-label-pro">Área</span>
              <span className="lame-info-value-pro text-center">{data?.area}</span>
            </div>
          </div>
        </div>
      </div>

      <section className="lame-section-card">
        <div className="lame-section-header">
          <FaUserMd className="lame-section-icon" />
          <h2 className="lame-section-title">Orientador</h2>
        </div>
        <div className="lame-section-content">{data?.advisors}</div>
      </section>

      <section className="lame-section-card">
        <div className="lame-section-header">
          <FaStar className="lame-section-icon" />
          <h2 className="lame-section-title">Diferencial</h2>
        </div>
        <div className="lame-section-content">
          {data?.highlightText}
        </div>
      </section>

      <section className="lame-section-card">
        <div className="lame-section-header">
          <FaInfoCircle className="lame-section-icon" />
          <h2 className="lame-section-title">Sobre</h2>
        </div>
        <div className="lame-section-content">
          {data?.about}
        </div>
      </section>

      <section className="lame-section-card">
        <div className="lame-section-header">
          <FaListUl className="lame-section-icon" />
          <h2 className="lame-section-title">Exemplos de Atuação e Projetos</h2>
        </div>
        <ul className="lame-section-list">
          {
            data?.examples.map((value) => {
              return (
                <li key={value}><span className="lame-list-bullet" />{value}</li>
              )
            })
          }
        </ul>
      </section>

      <section className="lame-section-card">
        <div className="lame-section-header">
          <FaInfoCircle className="lame-section-icon" />
          <h2 className="lame-section-title">Texto Geral</h2>
        </div>
        <div className="lame-section-content">
          {data?.geralText || "Texto geral não disponível."}
        </div>
      </section>
    </main>
  );
} 