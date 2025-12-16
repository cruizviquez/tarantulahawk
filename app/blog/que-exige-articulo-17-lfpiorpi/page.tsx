import type { Metadata } from "next";
import Link from "next/link";

const CANONICAL =
  "https://tarantulahawk.cloud/blog/que-exige-articulo-17-lfpiorpi";
const LANDING =
  "https://tarantulahawk.cloud/sistema-prevencion-lavado-dinero-lfpiopri";

export const metadata: Metadata = {
  title: "¿Qué exige el Artículo 17 de la LFPIORPI? (México) | Guía PLD",
  description:
    "Guía clara del Artículo 17 de la LFPIORPI para sujetos obligados en México: obligaciones, actividades vulnerables, evidencia y cómo prepararte para auditoría/verificación.",
  alternates: { canonical: CANONICAL },
  robots: { index: true, follow: true },
  openGraph: {
    title: "¿Qué exige el Artículo 17 de la LFPIORPI? (México)",
    description:
      "Obligaciones, actividades vulnerables, evidencia y recomendaciones prácticas para sujetos obligados (PLD).",
    url: CANONICAL,
    siteName: "TarantulaHawk",
    type: "article",
  },
};

const faqs = [
  {
    q: "¿A quién aplica el Artículo 17 de la LFPIORPI?",
    a: "Aplica a sujetos obligados que realizan actividades vulnerables conforme a los supuestos del Artículo 17. La aplicabilidad concreta depende de la actividad y condiciones específicas.",
  },
  {
    q: "¿Qué obligaciones clave se suelen implementar en la práctica?",
    a: "Identificación/expediente, monitoreo de operaciones, generación y conservación de evidencia, y preparación para auditoría/verificación. Los detalles dependen del supuesto aplicable y regulación complementaria.",
  },
  {
    q: "¿Un software PLD sustituye al oficial de cumplimiento o la asesoría legal?",
    a: "No. La tecnología ayuda a operar procesos y evidencia, pero el sujeto obligado conserva la responsabilidad legal y es recomendable asesoría especializada para interpretaciones regulatorias.",
  },
];

function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

function buildArticleJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "¿Qué exige el Artículo 17 de la LFPIORPI en México?",
    mainEntityOfPage: CANONICAL,
    author: { "@type": "Organization", name: "TarantulaHawk" },
    publisher: { "@type": "Organization", name: "TarantulaHawk" },
    datePublished: "2025-12-15",
    dateModified: "2025-12-15",
  };
}

export default function PostArticulo17() {
  const faqJsonLd = buildFaqJsonLd();
  const articleJsonLd = buildArticleJsonLd();

  const sujetosObligadosEjemplos = [
    "Juegos con apuesta, concursos o sorteos",
    "Tarjetas de servicios y de crédito",
    "Tarjetas prepagadas",
    "Cheques de viajero",
    "Mutuo / préstamos / crédito / empeño",
    "Inmuebles (construcción / intermediación)",
    "Desarrollo inmobiliario",
    "Metales preciosos, joyas, relojes",
    "Obras de arte",
    "Comercialización de vehículos",
    "Blindaje de vehículos",
    "Traslado y custodia de valores",
    "Servicios profesionales para operaciones Art. 17",
    "Notarios – derechos sobre inmuebles",
    "Corredores públicos – constitución de personas morales",
    "Arrendamiento de inmuebles",
    "Operaciones con activos virtuales (reforma jul-2025)",
  ];

  const altoRiesgo = [
    "Inmuebles (construcción / intermediación)",
    "Desarrollo inmobiliario",
    "Metales preciosos, joyas, relojes",
    "Traslado y custodia de valores",
    "Operaciones con activos virtuales",
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      {/* JSON-LD: Article + FAQ */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <article className="pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 border border-emerald-600/30 rounded-full mb-8">
            <span className="text-sm text-emerald-300 font-semibold">
              Guía PLD México • LFPIORPI • Artículo 17
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4">
            ¿Qué exige el Artículo 17 de la LFPIORPI en México?
          </h1>

          <p className="text-gray-300 text-lg mb-6">
            Esta guía está escrita para{" "}
            <strong>sujetos obligados</strong> y equipos de cumplimiento que
            necesitan claridad operativa: qué se suele implementar, cómo
            documentarlo y cómo prepararse para auditoría/verificación.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <Link
              href="/blog"
              className="text-teal-300 font-semibold hover:underline"
            >
              ← Volver al blog
            </Link>

            <a
              href={LANDING}
              className="text-emerald-300 font-semibold hover:underline"
            >
              Ver Sistema PLD para Sujetos Obligados (LFPIORPI) →
            </a>
          </div>

          {/* Resumen / TL;DR */}
          <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 mb-10">
            <h2 className="text-xl font-bold text-emerald-300 mb-2">
              Resumen rápido
            </h2>
            <ul className="space-y-2 text-gray-300">
              <li>• El Artículo 17 establece supuestos de “actividades vulnerables”.</li>
              <li>• Si tu operación cae en esos supuestos, eres sujeto obligado.</li>
              <li>
                • En la práctica necesitas procesos de identificación/expediente,
                monitoreo, evidencia y conservación ordenada.
              </li>
              <li>
                • La tecnología ayuda a operar y auditar; la responsabilidad legal
                permanece en el sujeto obligado.
              </li>
            </ul>
          </section>

          {/* A quién aplica */}
          <section className="mb-10">
            <h2 className="text-2xl md:text-3xl font-black mb-3">
              ¿A quién aplica el Artículo 17?
            </h2>
            <p className="text-gray-300 mb-6">
              Aplica a personas físicas o morales que realizan{" "}
              <strong>actividades vulnerables</strong> conforme a los supuestos
              del Artículo 17. Para efectos prácticos de operación y comunicación
              interna, conviene mapear tu actividad a los supuestos aplicables y
              documentar ese criterio.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              {sujetosObligadosEjemplos.map((x) => (
                <div
                  key={x}
                  className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-gray-300"
                >
                  ✓ {x}
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-400 mt-4">
              Nota: Esta lista refleja ejemplos comunes alineados al Art. 17.
              La aplicabilidad exacta depende del supuesto, umbrales y regulación
              complementaria. Se recomienda validación con asesoría especializada.
            </p>
          </section>

          {/* Obligaciones */}
          <section className="mb-10">
            <h2 className="text-2xl md:text-3xl font-black mb-3">
              Obligaciones clave que se implementan en la práctica
            </h2>
            <p className="text-gray-300 mb-6">
              Sin entrar en interpretaciones legales, estas son piezas operativas
              típicas que un equipo de cumplimiento necesita sostener con evidencia:
            </p>

            <div className="space-y-4">
              {[
                {
                  title: "Identificación y expediente",
                  desc: "Centralizar información del cliente/usuario y documentación relacionada a la relación comercial y operaciones.",
                },
                {
                  title: "Monitoreo de operaciones",
                  desc: "Revisar operaciones y comportamientos, registrar hallazgos y mantener trazabilidad de revisiones y decisiones.",
                },
                {
                  title: "Gestión de alertas y casos",
                  desc: "Priorizar revisiones internas, documentar acciones, adjuntar evidencia y cerrar casos con criterios consistentes.",
                },
                {
                  title: "Conservación de información",
                  desc: "Mantener evidencia organizada y recuperable durante los plazos aplicables, incluyendo bitácoras y respaldos.",
                },
                {
                  title: "Preparación para auditoría/verificación",
                  desc: "Tener expedientes y reportes listos para demostrar procesos, controles y consistencia en la operación.",
                },
              ].map((b) => (
                <div
                  key={b.title}
                  className="bg-black/40 border border-gray-800 rounded-2xl p-6"
                >
                  <h3 className="text-lg font-bold text-emerald-300 mb-1">
                    {b.title}
                  </h3>
                  <p className="text-gray-300">{b.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Alto riesgo */}
          <section className="mb-10">
            <h2 className="text-2xl md:text-3xl font-black mb-3">
              Sectores frecuentemente tratados como de alto riesgo (ejemplos)
            </h2>
            <p className="text-gray-300 mb-6">
              En términos de enfoque operativo, algunas actividades suelen requerir
              mayor robustez de evidencia y monitoreo por su exposición. Ejemplos:
            </p>

            <div className="flex flex-wrap gap-2">
              {altoRiesgo.map((t) => (
                <span
                  key={t}
                  className="px-3 py-2 rounded-full bg-emerald-600/10 border border-emerald-600/30 text-emerald-200 text-sm"
                >
                  {t}
                </span>
              ))}
            </div>
          </section>

          {/* Errores comunes */}
          <section className="mb-10">
            <h2 className="text-2xl md:text-3xl font-black mb-3">
              Errores comunes (y cómo evitarlos)
            </h2>

            <div className="space-y-4">
              {[
                {
                  title: "Operar todo en Excel sin trazabilidad",
                  desc: "El reto no es solo “tener datos”, sino demostrar proceso: quién revisó, cuándo, qué decidió y con qué evidencia.",
                },
                {
                  title: "No definir criterios de revisión y cierre",
                  desc: "Cuando no hay criterios, cada analista opera distinto. La consistencia y documentación ayudan a auditoría.",
                },
                {
                  title: "No centralizar expedientes y anexos",
                  desc: "La evidencia dispersa en correos y carpetas vuelve lento el cumplimiento y aumenta riesgo de omisiones.",
                },
                {
                  title: "Pensar que la tecnología sustituye la responsabilidad",
                  desc: "La plataforma ayuda a operar; la responsabilidad legal y decisiones siguen siendo del sujeto obligado.",
                },
              ].map((e) => (
                <div
                  key={e.title}
                  className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6"
                >
                  <h3 className="text-lg font-bold text-teal-300 mb-1">
                    {e.title}
                  </h3>
                  <p className="text-gray-300">{e.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Soft sell + link a landing */}
          <section className="mb-10">
            <h2 className="text-2xl md:text-3xl font-black mb-3">
              ¿Cómo puede ayudarte un sistema PLD?
            </h2>
            <p className="text-gray-300 mb-4">
              Un sistema de prevención de lavado de dinero puede ayudarte a:
              centralizar expedientes, organizar monitoreo, mantener bitácoras y
              exportar evidencia para auditoría/verificación. Si estás buscando
              una página pilar específica para sujetos obligados:
            </p>

            <a
              href={LANDING}
              className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-bold hover:from-emerald-700 hover:to-emerald-600 transition"
            >
              Ver Sistema PLD para Sujetos Obligados (LFPIORPI Art. 17) →
            </a>

            <p className="text-sm text-gray-400 mt-4">
              Aviso: este contenido es informativo y no constituye asesoría legal.
              Se recomienda validación con expertos para decisiones regulatorias.
            </p>
          </section>
          <section className="mt-14">
  <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
    <h3 className="text-lg font-bold text-emerald-300 mb-2">
      ¿Eres sujeto obligado por el Artículo 17 de la LFPIORPI?
    </h3>
    <p className="text-gray-300 mb-4">
      Consulta la guía pilar con obligaciones, sectores y cómo operar evidencia auditable.
    </p>
    <a
      href="/sistema-prevencion-lavado-dinero-lfpiopri"
      className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-bold hover:from-emerald-700 hover:to-emerald-600 transition"
    >
      Ver Sistema PLD (LFPIORPI Art. 17) →
    </a>
  </div>
</section>


          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-2xl md:text-3xl font-black mb-4">
              Preguntas frecuentes
            </h2>

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

            <div className="mt-10">
              <Link
                href="/blog"
                className="text-teal-300 font-semibold hover:underline"
              >
                ← Ver más artículos del blog
              </Link>
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}
