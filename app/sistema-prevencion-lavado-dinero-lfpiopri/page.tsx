import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:
    "Sistema PLD para Sujetos Obligados | LFPIORPI Artículo 17 | TarantulaHawk",
  description:
    "Software de Prevención de Lavado de Dinero (PLD) para sujetos obligados en México. Cumple el Artículo 17 de la LFPIORPI con monitoreo de operaciones, evaluación de riesgo y expedientes listos para auditoría y avisos SHCP.",
  alternates: {
    canonical: "https://tarantulahawk.cloud/sistema-prevencion-lavado-dinero-lfpiopri",
  },
  openGraph: {
    title: "Sistema PLD para Sujetos Obligados (LFPIORPI Art. 17) | TarantulaHawk",
    description:
      "Automatiza monitoreo, análisis de riesgo y evidencia para cumplimiento LFPIORPI Art. 17. Diseñado para sujetos obligados en México.",
    url: "https://tarantulahawk.cloud/sistema-prevencion-lavado-dinero-lfpiopri",
    siteName: "TarantulaHawk",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const faqs = [
  {
    q: "¿Qué es un sistema de prevención de lavado de dinero (PLD)?",
    a: "Es una plataforma que ayuda a implementar controles y procesos para detectar operaciones inusuales, evaluar riesgo y mantener evidencia, con el objetivo de reducir exposición a lavado de dinero y cumplir obligaciones regulatorias.",
  },
  {
    q: "¿A quién aplica la LFPIORPI Artículo 17?",
    a: "A sujetos obligados que realizan actividades consideradas vulnerables. El cumplimiento incluye identificación, monitoreo, conservación de información y presentación de avisos cuando corresponda.",
  },
  {
    q: "¿TarantulaHawk reemplaza al oficial de cumplimiento o da asesoría legal?",
    a: "No. TarantulaHawk es una plataforma tecnológica. El sujeto obligado mantiene la responsabilidad legal del cumplimiento y se recomienda asesoría especializada para interpretaciones o decisiones regulatorias.",
  },
  {
    q: "¿Qué evidencia ayuda a generar para auditoría o verificación?",
    a: "Expedientes operativos, reportes internos, trazabilidad de acciones, bitácoras y documentación organizada para soportar procesos de cumplimiento y revisiones.",
  },
];

function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
}

export default function Page() {
  const faqJsonLd = buildFaqJsonLd();

  return (
    <main className="min-h-screen bg-black text-white">
      {/* JSON-LD FAQ */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* HERO */}
      <section className="pt-24 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 border border-emerald-600/30 rounded-full mb-8">
            <span className="text-sm text-emerald-300 font-semibold">
              México • LFPIORPI • Sujetos Obligados • Artículo 17
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
            Sistema de Prevención de Lavado de Dinero (PLD)
            <span className="block bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
              para Sujetos Obligados (LFPIORPI Artículo 17)
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-300 max-w-4xl mb-10">
            TarantulaHawk es un{" "}
            <strong>software PLD especializado para México</strong> que ayuda a
            sujetos obligados a implementar un proceso más ordenado, auditable y
            eficiente: monitoreo de operaciones, evaluación de riesgo y evidencia
            lista para verificación.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#cta"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-bold text-lg hover:from-emerald-700 hover:to-emerald-600 transition"
            >
              Solicitar demo / acceso
            </a>

            <a
              href="#que-cubre"
              className="px-8 py-4 border-2 border-teal-500 rounded-lg font-bold text-lg hover:bg-teal-500/10 transition"
            >
              Ver qué cubre (Art. 17)
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="text-emerald-400 font-black text-xl mb-2">
                Enfoque Legal
              </div>
              <p className="text-gray-300">
                Reglas y flujos diseñados para <strong>LFPIORPI</strong> y sujetos
                obligados (Art. 17).
              </p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="text-teal-300 font-black text-xl mb-2">
                Trazabilidad
              </div>
              <p className="text-gray-300">
                Evidencia y bitácora para auditoría/verificación, sin perder el
                control operativo.
              </p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="text-blue-300 font-black text-xl mb-2">
                Eficiencia
              </div>
              <p className="text-gray-300">
                Menos trabajo manual: centraliza información, monitoreo y reportes
                operativos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PARA QUIÉN */}
      <section className="py-14 px-6 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              ¿Para quién es este software PLD?
            </h2>
            <p className="text-gray-300 text-lg mb-6">
              Para <strong>sujetos obligados</strong> en México que realizan{" "}
              <strong>actividades vulnerables</strong> y necesitan un sistema que
              soporte procesos de cumplimiento de forma clara, consistente y
              auditable.
            </p>

            <ul className="space-y-3 text-gray-300">
              <li className="flex gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                Oficial de cumplimiento y equipos de PLD
              </li>
              <li className="flex gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                Operación, auditoría interna y legal (trabajo coordinado)
              </li>
              <li className="flex gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                Empresas con necesidad de evidencia organizada para verificación
              </li>
            </ul>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
            <h3 className="text-2xl font-bold mb-4 text-teal-300">
              Problemas típicos que resuelve
            </h3>
            <ul className="space-y-4 text-gray-300">
              <li>
                <strong>Información dispersa:</strong> expedientes y evidencia
                difíciles de armar.
              </li>
              <li>
                <strong>Monitoreo manual:</strong> revisiones lentas, poco
                consistentes.
              </li>
              <li>
                <strong>Auditoría:</strong> falta de trazabilidad / bitácora de
                acciones y decisiones.
              </li>
              <li>
                <strong>Escalabilidad:</strong> el cumplimiento crece más rápido
                que el equipo.
              </li>
            </ul>
          </div>
        </div>
      </section>


      {/* SUJETOS OBLIGADOS (ART. 17) */}
      <section id="sujetos-obligados" className="py-14 px-6 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            Sujetos obligados (LFPIORPI Artículo 17): ¿tu empresa entra aquí?
          </h2>
          <p className="text-gray-300 text-lg max-w-4xl mb-8">
            Si realizas <strong>actividades vulnerables</strong> conforme al Artículo 17 de la LFPIORPI,
            podrías estar obligado a implementar controles PLD, conservar evidencia y, cuando corresponda,
            presentar avisos a la autoridad. Abajo listamos actividades comunes para que lo identifiques de inmediato.
          </p>

          <div className="mb-8 bg-gray-900/40 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-3 text-emerald-300">Actividades vulnerables (ejemplos comunes)</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-gray-300">
              {[
                "Juegos con apuesta, concursos o sorteos",
                "Tarjetas de servicios y de crédito",
                "Tarjetas prepagadas",
                "Cheques de viajero",
                "Mutuo / préstamos / crédito / empeño",
                "Inmuebles (construcción / intermediación)",
                "Desarrollo inmobiliario",
                "Metales preciosos, joyas y relojes",
                "Obras de arte",
                "Comercialización de vehículos",
                "Blindaje de vehículos",
                "Traslado y custodia de valores",
                "Servicios profesionales para operaciones Art. 17",
                "Notarios: derechos sobre inmuebles (según aplique)",
                "Corredores públicos: constitución de personas morales (según aplique)",
                "Arrendamiento de inmuebles",
                "Operaciones con activos virtuales (según reforma aplicable)",
              ].map((item) => (
                <div key={item} className="bg-black/40 border border-gray-800 rounded-xl p-4">
                  <span className="text-emerald-400 font-bold">✓</span>{" "}
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-900/10 border border-blue-800/30 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-3 text-cyan-300">
              Actividades típicamente consideradas de mayor riesgo (prioriza controles)
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                "Inmuebles",
                "Desarrollo inmobiliario",
                "Joyería y metales preciosos",
                "Traslado y custodia de valores",
                "Activos virtuales",
              ].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-sm bg-cyan-500/10 border border-cyan-500/30 text-cyan-200"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-300 mt-4">
              Nota: la clasificación de riesgo depende de tu operación (montos, frecuencia, canal, cliente, etc.). Esta lista
              es una guía práctica para priorizar.
            </p>
          </div>

          <p className="text-sm text-gray-400 mt-6 leading-relaxed">
            <strong>Importante:</strong> Esta lista es informativa. La determinación formal de si una actividad está sujeta
            a obligaciones específicas del Art. 17 depende del supuesto aplicable y su regulación. Se recomienda validación
            con asesoría especializada.
          </p>
        </div>
      </section>

      {/* QUÉ CUBRE (ART 17) */}
      <section id="que-cubre" className="py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            ¿Qué cubre para cumplimiento LFPIORPI (Artículo 17)?
          </h2>
          <p className="text-gray-300 text-lg max-w-4xl mb-10">
            Esta página está pensada para búsquedas como{" "}
            <strong>“sistema PLD LFPIORPI Artículo 17”</strong> o{" "}
            <strong>“software PLD México para sujetos obligados”</strong>. El
            enfoque es ayudarte a operar mejor los componentes clave del proceso.
          </p>
          <section className="py-12 px-6">
  <div className="max-w-6xl mx-auto">
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-emerald-300 mb-2">
        Guía rápida: ¿Qué exige el Artículo 17 de la LFPIORPI?
      </h3>
      <p className="text-gray-300 mb-4">
        Explicación clara para sujetos obligados: a quién aplica, obligaciones clave y
        cómo prepararte con evidencia auditable.
      </p>
      <a
        href="/blog/que-exige-articulo-17-lfpiorpi"
        className="text-teal-300 font-semibold hover:underline"
      >
        Leer la guía completa →
      </a>
    </div>
  </div>
</section>


          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Identificación y expediente",
                desc: "Centraliza información operativa de clientes/usuarios y documentación relacionada al proceso de cumplimiento.",
              },
              {
                title: "Monitoreo de operaciones",
                desc: "Apoya el análisis de operaciones para detectar señales de riesgo y organizar alertas operativas.",
              },
              {
                title: "Evaluación de riesgo PLD",
                desc: "Clasificación y scoring de riesgo por cliente u operación (enfoque práctico para priorización).",
              },
              {
                title: "Evidencia y trazabilidad",
                desc: "Bitácoras, reportes internos y paquetes de evidencia listos para auditoría/verificación.",
              },
              {
                title: "Conservación y orden",
                desc: "Mejora la disponibilidad y estructura de información para consulta histórica y revisiones internas.",
              },
              {
                title: "Reporteo operativo",
                desc: "Reportes operativos y exportables para apoyar la toma de decisiones y la gestión de casos.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-gray-900/50 border border-gray-800 rounded-2xl p-7"
              >
                <h3 className="text-xl font-bold mb-2 text-emerald-300">
                  {card.title}
                </h3>
                <p className="text-gray-300">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO SE IMPLEMENTA */}
      <section className="py-14 px-6 bg-gradient-to-b from-gray-900 to-black">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            Implementación simple (sin complicarte)
          </h2>
          <p className="text-gray-300 text-lg max-w-4xl mb-10">
            Enfocado a equipos de cumplimiento: rápido de adoptar y orientado a
            evidencia, no a “promesas vagas”.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Carga o integra datos",
                desc: "Puedes iniciar con carga de archivos o integración posterior según tu operación.",
              },
              {
                step: "2",
                title: "Analiza y prioriza",
                desc: "Organiza alertas y clasifica riesgo para priorizar revisiones internas.",
              },
              {
                step: "3",
                title: "Exporta reportes y evidencia",
                desc: "Genera documentación operativa y trazabilidad para auditoría/verificación.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="bg-black/50 border border-gray-800 rounded-2xl p-7"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 flex items-center justify-center font-black text-lg mb-4">
                  {s.step}
                </div>
                <h3 className="text-xl font-bold mb-2">{s.title}</h3>
                <p className="text-gray-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black mb-6">Preguntas frecuentes</h2>

          <div className="space-y-4">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="bg-gray-900/50 border border-gray-800 rounded-xl p-6"
              >
                <summary className="cursor-pointer font-bold text-emerald-300">
                  {f.q}
                </summary>
                <p className="text-gray-300 mt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="py-16 px-6 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-4">
            ¿Listo para ordenar tu cumplimiento LFPIORPI?
          </h2>
          <p className="text-gray-300 text-lg mb-8">
            Solicita acceso o una demo enfocada a <strong>sujetos obligados</strong> y
            necesidades reales de <strong>PLD en México</strong>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* Si ya tienes botón/trigger de chat en tu layout principal, puedes reemplazar este link por tu trigger */}
            <a
              href="/#hero"
              className="px-10 py-4 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-bold text-lg hover:from-emerald-700 hover:to-emerald-600 transition"
            >
              Ir a registro / acceso
            </a>

            <Link
              href="/"
              className="px-10 py-4 border-2 border-teal-500 rounded-lg font-bold text-lg hover:bg-teal-500/10 transition"
            >
              Volver al inicio
            </Link>
          </div>

          <p className="text-sm text-gray-400 mt-8 leading-relaxed">
            <strong>Aviso:</strong> TarantulaHawk es una plataforma tecnológica que
            facilita procesos de cumplimiento. El sujeto obligado conserva la
            responsabilidad legal del cumplimiento de la LFPIORPI y se recomienda
            asesoría especializada para interpretaciones regulatorias.
          </p>

          <p className="text-xs text-gray-500 mt-4">
            Keywords objetivo: sistema PLD México, prevención de lavado de dinero,
            software PLD, LFPIORPI Artículo 17, sujetos obligados.
          </p>
        </div>
      </section>
    </main>
  );
}
