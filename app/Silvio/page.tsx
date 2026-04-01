import Link from "next/link";
import "./page.css";

const sideNotes = [
  {
    eyebrow: "Palco oficial",
    title: "Chegada de chefe",
    copy: "Quando Silvio aparece, o ambiente inteiro entende na hora quem comanda a noite.",
  },
  {
    eyebrow: "Selo premium",
    title: "Presença marcante",
    copy: "Elegância, energia e aquela postura de quem entra e naturalmente vira referência.",
  },
  {
    eyebrow: "Volume máximo",
    title: "Nome que ecoa",
    copy: "Da primeira fileira ao fundo do salão, o respeito chega antes mesmo do anúncio.",
  },
];

const highlights = [
  {
    eyebrow: "Ato I",
    title: "Abertura solene",
    text: "Luzes douradas, recepção em alto nível e clima de cerimônia para receber o presidente.",
    accent: "gold",
    featured: true,
  },
  {
    eyebrow: "Ato II",
    title: "Centro das atenções",
    text: "O retrato assume o comando da cena enquanto todo o resto trabalha para exaltar sua presença.",
    accent: "pink",
  },
  {
    eyebrow: "Ato III",
    title: "Final em gloria",
    text: "Uma consagração completa, com honra, festa e aquele exagero elegante que a ocasião merece.",
    accent: "cyan",
  },
];

const meters = [
  { label: "Carisma", value: "1000%", fill: "100%" },
  { label: "Presença", value: "999%", fill: "96%" },
  { label: "Gostosura", value: "Incontestável", fill: "100%" },
  { label: "Moral", value: "Absurda", fill: "92%" },
];

const awards = [
  "Comenda de liderança",
  "Medalha de honra do DADG",
  "Ordem do carisma absoluto",
  "Distinção de presidente supremo",
];

export default function SilvioPage() {
  return (
    <main className="silvio-page">
      <div className="silvio-bg silvio-bg-a" />
      <div className="silvio-bg silvio-bg-b" />
      <div className="silvio-bg silvio-bg-c" />
      <div className="silvio-grid-glow silvio-grid-glow-a" />
      <div className="silvio-grid-glow silvio-grid-glow-b" />

      <section className="silvio-ribbon" aria-hidden="true">
        <div className="silvio-ribbon-track">
          <span>Silvio nosso super presidente</span>
          <span>Honra ao presidente</span>
          <span>Carisma em estado máximo</span>
          <span>Entrada de gala oficial</span>
          <span>Silvio nosso super presidente</span>
          <span>Honra ao presidente</span>
          <span>Carisma em estado máximo</span>
          <span>Entrada de gala oficial</span>
        </div>
      </section>

      <section className="silvio-hero">
        <div className="silvio-hero-copy">
          <p className="silvio-kicker">Homenagem oficial do DADG</p>
          <h1 className="silvio-title">Silvio</h1>
          <p className="silvio-subtitle">nosso super presidente</p>
          <p className="silvio-lead">
            Uma homenagem em escala de gala, com luzes altas, clima de celebração e destaque total para um
            nome que carrega respeito, carisma e presença.
          </p>

          <div className="silvio-badges" aria-hidden="true">
            <span>Carisma máximo</span>
            <span>Energia presidencial</span>
            <span>Presença lendária</span>
            <span>Honra da casa</span>
          </div>
        </div>

        <div className="silvio-stage-grid">
          <aside className="silvio-side-stack">
            {sideNotes.slice(0, 2).map((note) => (
              <article key={note.title} className="silvio-note-card silvio-note-card-left">
                <p>{note.eyebrow}</p>
                <h2>{note.title}</h2>
                <span>{note.copy}</span>
              </article>
            ))}
          </aside>

          <div className="silvio-photo-stage">
            <div className="silvio-stage-burst silvio-stage-burst-a" />
            <div className="silvio-stage-burst silvio-stage-burst-b" />
            <div className="silvio-photo-frame">
              <div className="silvio-ring silvio-ring-a" />
              <div className="silvio-ring silvio-ring-b" />
              <div className="silvio-star silvio-star-a">&#9733;</div>
              <div className="silvio-star silvio-star-b">&#9733;</div>
              <div className="silvio-star silvio-star-c">&#9733;</div>
              <div className="silvio-photo-wrap">
                <img
                  src="Silvio.png"
                  alt="Silvio"
                  className="silvio-photo"
                  loading="eager"
                />
              </div>
            </div>
          </div>

          <aside className="silvio-side-stack">
            {sideNotes.slice(2).map((note) => (
              <article key={note.title} className="silvio-note-card silvio-note-card-right">
                <p>{note.eyebrow}</p>
                <h2>{note.title}</h2>
                <span>{note.copy}</span>
              </article>
            ))}

            <article className="silvio-note-card silvio-note-card-right silvio-note-card-accent">
              <p>Nível máximo</p>
              <h2>Respeito unânime</h2>
              <span>Nome forte, presença firme e aura de quem naturalmente assume o centro.</span>
            </article>
          </aside>
        </div>
      </section>

      <section className="silvio-showcase">
        <div className="silvio-section-heading silvio-showcase-heading">
          <p>Cerimonial da noite</p>
          <h2>Os três momentos da consagração</h2>
        </div>

        <div className="silvio-highlight-grid">
          {highlights.map((item, index) => (
            <article
              key={item.title}
              className={[
                "silvio-highlight-card",
                item.featured ? "silvio-highlight-card-featured" : "",
                item.accent ? `silvio-highlight-card-${item.accent}` : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <p className="silvio-highlight-kicker">{item.eyebrow}</p>
              <span className="silvio-highlight-index">0{index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="silvio-dashboard">
        <div className="silvio-quote-panel">
          <p className="silvio-quote-mark">"</p>
          <h2>Onde Silvio chega, a ocasião cresce junto.</h2>
          <p className="silvio-quote-text">
            Tem presença que não precisa ser anunciada duas vezes. A postura, o respeito e a energia fazem o
            trabalho inteiro só de estar ali.
          </p>
        </div>

        <div className="silvio-meter-panel">
          <div className="silvio-section-heading silvio-section-heading-left">
            <p>Indicadores oficiais</p>
            <h2>Medidas de grandeza presidencial</h2>
          </div>

          <div className="silvio-meter-list">
            {meters.map((meter) => (
              <div key={meter.label} className="silvio-meter-row">
                <div className="silvio-meter-copy">
                  <strong>{meter.label}</strong>
                  <span>{meter.value}</span>
                </div>
                <div className="silvio-meter-bar">
                  <span className="silvio-meter-fill" style={{ width: meter.fill }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="silvio-awards-section">
        <div className="silvio-section-heading">
          <p>Hall da honra</p>
          <h2>Condecorações reservadas ao presidente</h2>
        </div>

        <div className="silvio-awards-grid">
          {awards.map((award) => (
            <article key={award} className="silvio-award-card">
              <div className="silvio-award-badge">&#9733;</div>
              <h3>{award}</h3>
              <p>Concedida pelo conselho imaginário da elegância, da honra e do respeito absoluto.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="silvio-finale">
        <div className="silvio-finale-card">
          <p className="silvio-kicker">Encerramento de gala</p>
          <h2>Uma homenagem do tamanho do nome.</h2>
          <p>
            Do topo ao rodapé, tudo aqui foi pensado como tributo: honra, energia, celebração e destaque total
            para o nosso super presidente.
          </p>
          <Link href="/" className="silvio-home-link">
            Voltar para o DADG Certificates
          </Link>
        </div>
      </section>
    </main>
  );
}
