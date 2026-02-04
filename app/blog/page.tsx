import type { Metadata } from "next";
import Link from "next/link";
import { formatDateES } from '../lib/dateFormatter';

export const metadata: Metadata = {
  title: "Blog PLD | LFPIORPI Art. 17 para Sujetos Obligados | TarantulaHawk",
  description:
    "Guías prácticas sobre Prevención de Lavado de Dinero (PLD) para sujetos obligados en México. LFPIORPI, Artículo 17, buenas prácticas y preparación para verificación.",
  alternates: {
    canonical: "https://tarantulahawk.cloud/blog",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Blog PLD (México) | TarantulaHawk",
    description:
      "Guías de cumplimiento PLD para sujetos obligados: LFPIORPI, Art. 17, procesos, evidencia y preparación para auditorías/verificación.",
    url: "https://tarantulahawk.cloud/blog",
    siteName: "TarantulaHawk",
    type: "website",
  },
};

const posts = [
  {
    slug: "que-exige-articulo-17-lfpiorpi",
    title: "¿Qué exige el Artículo 17 de la LFPIORPI en México?",
    description:
      "Obligaciones principales, a quién aplica y cómo prepararte con evidencia y procesos auditable para sujetos obligados.",
    dateISO: "2025-12-15",
    readMins: 7,
  },
];

export default function BlogIndexPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="pt-24 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <nav className="text-sm text-gray-400 mb-6 flex flex-wrap gap-2">
            <Link href="/" className="hover:text-emerald-300 transition">
              Inicio
            </Link>
            <span>›</span>
            <span className="text-emerald-300">Blog</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 border border-emerald-600/30 rounded-full mb-8">
            <span className="text-sm text-emerald-300 font-semibold">
              México • PLD • LFPIORPI • Sujetos obligados
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-4">
            Blog de PLD para sujetos obligados
            <span className="block bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
              LFPIORPI • Artículo 17 • Evidencia auditable
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-300 max-w-4xl mb-10">
            Publicamos guías claras y prácticas para operaciones de{" "}
            <strong>Prevención de Lavado de Dinero (PLD)</strong> en México,
            enfocadas a <strong>sujetos obligados</strong> bajo el{" "}
            <strong>Artículo 17 de la LFPIORPI</strong>.
            <span className="block mt-3 text-gray-400">
              <strong>LFPIORPI</strong> significa Ley Federal para la Prevención e
              Identificación de Operaciones con Recursos de Procedencia Ilícita.
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/sistema-prevencion-lavado-dinero-lfpiopri"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-bold text-lg hover:from-emerald-700 hover:to-emerald-600 transition"
            >
              Ver Sistema PLD (LFPIORPI Art. 17)
            </Link>

            <a
              href="#posts"
              className="px-8 py-4 border-2 border-teal-500 rounded-lg font-bold text-lg hover:bg-teal-500/10 transition"
            >
              Ver artículos
            </a>
          </div>
        </div>
      </section>

      <section className="pb-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-emerald-300 mb-2">
              Definiciones rápidas
            </h2>
            <ul className="space-y-2 text-gray-300">
              <li>
                <strong>LFPIORPI:</strong> marco legal mexicano que regula la
                identificación de operaciones con recursos de procedencia ilícita.
              </li>
              <li>
                <strong>PLD:</strong> procesos y controles para prevenir, detectar
                y reportar operaciones de lavado de dinero.
              </li>
              <li>
                <strong>Sujetos obligados:</strong> personas físicas o morales que
                realizan actividades vulnerables definidas por el Art. 17.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="posts" className="pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black mb-6">
            Artículos recientes
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {posts.map((p) => (
              <article
                key={p.slug}
                className="bg-gray-900/50 border border-gray-800 rounded-2xl p-7 hover:border-gray-700 transition"
              >
                <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
                  <time dateTime={p.dateISO}>
                    {formatDateES(p.dateISO)}
                  </time>
                  <span>•</span>
                  <span>{p.readMins} min</span>
                </div>

                <h3 className="text-xl md:text-2xl font-bold mb-2 text-emerald-300">
                  <Link
                    href={`/blog/${p.slug}`}
                    className="hover:underline"
                    prefetch={true}
                  >
                    {p.title}
                  </Link>
                </h3>

                <p className="text-gray-300 mb-6">{p.description}</p>

                <Link
                  href={`/blog/${p.slug}`}
                  className="text-teal-300 font-semibold hover:underline"
                  prefetch={true}
                >
                  Leer artículo →
                </Link>
              </article>
            ))}
          </div>

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

        </div>
      </section>
    </main>
  );
}
