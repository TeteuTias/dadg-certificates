/* eslint-disable */
import Link from "next/link";
import { client } from "../lib/contentful";
import './styles.css';

export const dynamic = "force-dynamic";

export default async function Mural() {
  const response = await client.getEntries({
    content_type: "mural"
  });
  const murais = response.items;

  return (
    <div className="mural-container">
      <div className="mural-content">
        <h1 className="mural-title">Mural de Avisos</h1>
        <div className="mural-list">
          {murais.length === 0 ? (
            <p className="no-mural">
              Nenhum aviso encontrado. Tente novamente mais tarde.
            </p>
          ) : (
            murais.map((mural: any) => {
              const hasArco = mural.fields.arco;
              return (
                <div key={mural.sys.id} className="mural-item">
                  <Link href="/certificados">
                    {hasArco ? (
                      <div className="rainbow-glow">
                        <div className="mural-card">
                          <p className="mural-text">
                            {mural.fields.listaDoMural}
                          </p>
                          <p className="mural-arc">
                            {mural.fields.arco}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mural-card">
                        <p className="mural-text">
                          {mural.fields.listaDoMural}
                        </p>
                      </div>
                    )}
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
