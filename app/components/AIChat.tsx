import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

interface AIChatProps {
  language: string;
}

export default function AIChat({ language }: AIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: '1',
        text: language === 'en' 
          ? "Hi! I'm TarantulaHawk AI assistant. I can help you with AML compliance questions, API integration, or getting started with our platform. What would you like to know?"
          : "¡Hola! Soy el asistente IA de TarantulaHawk. Puedo ayudarte con preguntas sobre cumplimiento AML, integración de API, o comenzar con nuestra plataforma. ¿Qué te gustaría saber?",
        isBot: true,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, language]);

  // Enhanced rule-based responses for common questions
  const getRuleBasedResponse = (text: string): string | null => {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    // Greeting patterns
    if (words.some(w => ['hello', 'hi', 'hey', 'hola', 'buenos'].includes(w))) {
      return language === 'en'
        ? "Hello! I'm here to help you understand how TarantulaHawk can enhance your AML compliance. What specific area interests you - our AI technology, API integration, or getting started with a trial?"
        : "¡Hola! Estoy aquí para ayudarte a entender cómo TarantulaHawk puede mejorar tu cumplimiento AML. ¿Qué área específica te interesa - nuestra tecnología IA, integración API, o comenzar con una prueba?";
    }
    
    // Lead capture triggers - enhanced patterns
    if (words.some(w => ['demo', 'trial', 'pricing', 'price', 'cost', 'quote', 'estimate'].includes(w))) {
      if (!leadCaptured) {
        setLeadCaptured(true);
        return language === 'en'
          ? "Excellent! I'd love to help you get started. To provide the most relevant information and connect you with the right specialist, could you share: 1) Your company name, 2) Your email, and 3) Your approximate monthly transaction volume? This helps me tailor the demo to your needs."
          : "¡Excelente! Me encantaría ayudarte a comenzar. Para proporcionar la información más relevante y conectarte con el especialista adecuado, ¿podrías compartir: 1) Nombre de tu empresa, 2) Tu email, y 3) Tu volumen aproximado mensual de transacciones? Esto me ayuda a adaptar la demo a tus necesidades.";
      }
    }

    // API questions - enhanced
    if (words.some(w => ['api', 'integration', 'sdk', 'endpoint', 'webhook'].includes(w))) {
      return language === 'en'
        ? "Our REST API provides real-time transaction scoring in <100ms. Key features: • JSON/XML support • Batch processing • Real-time webhooks • SDKs for Python, Java, Node.js • On-premise deployment • 99.9% uptime SLA. Want to see the API documentation or test endpoints?"
        : "Nuestra API REST proporciona puntuación de transacciones en tiempo real en <100ms. Características clave: • Soporte JSON/XML • Procesamiento por lotes • Webhooks en tiempo real • SDKs para Python, Java, Node.js • Despliegue local • SLA 99.9% uptime. ¿Quieres ver la documentación API o endpoints de prueba?";
    }

    // AI/ML questions - enhanced
    if (words.some(w => ['ai', 'artificial', 'intelligence', 'machine', 'learning', 'models', 'algorithm'].includes(w))) {
      return language === 'en'
        ? "Our 3-layer AI architecture: 🧠 Layer 1: Supervised Learning (trained on 50M+ labeled transactions) 🔍 Layer 2: Unsupervised Learning (detects novel money laundering patterns) 🎯 Layer 3: Reinforcement Learning (learns from your feedback) Result: >95% accuracy, <2% false positives, continuous improvement."
        : "Nuestra arquitectura IA de 3 capas: 🧠 Capa 1: Aprendizaje Supervisado (entrenado en 50M+ transacciones etiquetadas) 🔍 Capa 2: Aprendizaje No Supervisado (detecta patrones nuevos de lavado) 🎯 Capa 3: Aprendizaje por Refuerzo (aprende de tu retroalimentación) Resultado: >95% precisión, <2% falsos positivos, mejora continua.";
    }

    // Compliance - enhanced
    if (words.some(w => ['compliance', 'fincen', 'bsa', 'regulatory', 'regulation', 'law'].includes(w))) {
      return language === 'en'
        ? "🏛️ Compliance Standards: • FinCEN BSA (USA) • LFPIORPI (Mexico) • EU AMLD directives • FATF recommendations Important: We provide detection technology only. You retain full control over compliance decisions, investigations, and regulatory reporting. We enhance your team's capabilities, not replace them."
        : "🏛️ Estándares de Cumplimiento: • FinCEN BSA (USA) • LFPIORPI (México) • Directivas UE AMLD • Recomendaciones FATF Importante: Solo proporcionamos tecnología de detección. Mantienes control total sobre decisiones de cumplimiento, investigaciones y reportes regulatorios. Mejoramos las capacidades de tu equipo, no las reemplazamos.";
    }

    // Technical questions
    if (words.some(w => ['performance', 'speed', 'latency', 'throughput', 'scale'].includes(w))) {
      return language === 'en'
        ? "⚡ Performance Metrics: • <100ms response time • 10,000+ TPS throughput • 99.9% uptime SLA • Auto-scaling architecture • Global edge deployment • Real-time processing Our infrastructure handles millions of transactions daily for major financial institutions."
        : "⚡ Métricas de Rendimiento: • <100ms tiempo de respuesta • 10,000+ TPS throughput • SLA 99.9% uptime • Arquitectura auto-escalable • Despliegue global edge • Procesamiento tiempo real Nuestra infraestructura maneja millones de transacciones diarias para instituciones financieras principales.";
    }

    return null;
  };

  // Enhanced AI-like response system using advanced pattern matching
  const getAIResponse = async (text: string): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000)); // Simulate AI thinking time
    
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    // Advanced pattern matching for AI-like responses
    if (words.some(w => ['compare', 'versus', 'vs', 'difference', 'better'].includes(w))) {
      return language === 'en'
        ? "TarantulaHawk stands out with our unique 3-layer AI architecture and <100ms response time. Unlike traditional rule-based systems, we use reinforcement learning to continuously improve detection accuracy. Would you like to see a comparison demo?"
        : "TarantulaHawk se destaca con nuestra arquitectura IA única de 3 capas y tiempo de respuesta <100ms. A diferencia de sistemas tradicionales basados en reglas, usamos aprendizaje por refuerzo para mejorar continuamente la precisión de detección. ¿Te gustaría ver una demo comparativa?";
    }
    
    if (words.some(w => ['cost', 'expensive', 'cheap', 'budget', 'money'].includes(w))) {
      return language === 'en'
        ? "Our pay-as-you-go model means you only pay for transactions processed. No upfront costs, no monthly minimums. Most clients save 40-60% compared to traditional AML solutions. Want to calculate potential savings for your volume?"
        : "Nuestro modelo de pago por uso significa que solo pagas por transacciones procesadas. Sin costos iniciales, sin mínimos mensuales. La mayoría de clientes ahorran 40-60% comparado con soluciones AML tradicionales. ¿Quieres calcular ahorros potenciales para tu volumen?";
    }
    
    if (words.some(w => ['security', 'safe', 'secure', 'privacy', 'data'].includes(w))) {
      return language === 'en'
        ? "Security is our priority. You can deploy TarantulaHawk on your own infrastructure, ensuring your data never leaves your environment. We're SOC2 compliant and support end-to-end encryption. Your transaction data remains 100% under your control."
        : "La seguridad es nuestra prioridad. Puedes desplegar TarantulaHawk en tu propia infraestructura, asegurando que tus datos nunca salgan de tu entorno. Somos conformes con SOC2 y soportamos cifrado end-to-end. Tus datos de transacciones permanecen 100% bajo tu control.";
    }
    
    if (words.some(w => ['implementation', 'setup', 'install', 'deploy', 'integration'].includes(w))) {
      return language === 'en'
        ? "Implementation is typically 2-4 weeks. We provide REST APIs, SDKs for major languages, and dedicated support engineers. Our team handles the initial setup and training. Most clients are processing live transactions within the first week."
        : "La implementación típicamente toma 2-4 semanas. Proporcionamos APIs REST, SDKs para lenguajes principales, e ingenieros de soporte dedicados. Nuestro equipo maneja la configuración inicial y entrenamiento. La mayoría de clientes procesan transacciones en vivo dentro de la primera semana.";
    }
    
    if (words.some(w => ['accuracy', 'false', 'positive', 'detection', 'performance'].includes(w))) {
      return language === 'en'
        ? "We maintain >95% detection accuracy with <2% false positive rate. Our reinforcement learning continuously adapts to new patterns, reducing false alerts over time. This means fewer manual reviews and faster transaction processing for your customers."
        : "Mantenemos >95% precisión de detección con <2% tasa de falsos positivos. Nuestro aprendizaje por refuerzo se adapta continuamente a nuevos patrones, reduciendo alertas falsas con el tiempo. Esto significa menos revisiones manuales y procesamiento más rápido de transacciones para tus clientes.";
    }
    
    if (words.some(w => ['industries', 'sector', 'banking', 'fintech', 'crypto'].includes(w))) {
      return language === 'en'
        ? "We serve banking, fintech, crypto exchanges, remittance services, and e-commerce platforms. Each industry has unique AML patterns - our AI adapts to your specific transaction types and regulatory requirements. Which industry are you in?"
        : "Servimos banca, fintech, exchanges crypto, servicios de remesas, y plataformas e-commerce. Cada industria tiene patrones AML únicos - nuestra IA se adapta a tus tipos específicos de transacciones y requisitos regulatorios. ¿En qué industria estás?";
    }
    
    if (words.some(w => ['support', 'help', 'assistance', 'customer', 'service'].includes(w))) {
      return language === 'en'
        ? "We provide comprehensive support including: 🔧 Technical integration assistance 📚 Training and onboarding 📞 24/7 customer success team 📈 Performance optimization Our dedicated engineers ensure smooth implementation and ongoing success."
        : "Proporcionamos soporte integral incluyendo: 🔧 Asistencia técnica de integración 📚 Entrenamiento e incorporación 📞 Equipo de éxito del cliente 24/7 📈 Optimización de rendimiento Nuestros ingenieros dedicados aseguran implementación fluida y éxito continuo.";
    }
    
    if (words.some(w => ['volume', 'transactions', 'scale', 'capacity', 'throughput'].includes(w))) {
      return language === 'en'
        ? "Our platform handles any volume: 💳 Small fintech: 1K-10K transactions/day 🏦 Regional banks: 100K-1M transactions/day 🌐 Global institutions: 10M+ transactions/day Auto-scaling ensures consistent performance regardless of volume spikes."
        : "Nuestra plataforma maneja cualquier volumen: 💳 Fintech pequeño: 1K-10K transacciones/día 🏦 Bancos regionales: 100K-1M transacciones/día 🌐 Instituciones globales: 10M+ transacciones/día Auto-escalado asegura rendimiento consistente sin importar picos de volumen.";
    }
    
    // Generate contextual response based on content
    return getRuleBasedFallback(text);
  };

  const getRuleBasedFallback = (text: string): string => {
    const lowerText = text.toLowerCase();
    const fallbackResponses = language === 'en' ? [
      "That's a great question! TarantulaHawk specializes in AI-powered AML detection. Could you be more specific about what aspect interests you most?",
      "I'd be happy to help with that. Our platform focuses on transaction monitoring and compliance automation. What specific challenge are you trying to solve?",
      "Interesting question! Our AI technology can help with various AML scenarios. Could you share more context about your use case?",
      "Thanks for asking! TarantulaHawk offers advanced detection capabilities. What's your main concern - accuracy, speed, or implementation?",
      "Good point! Our system is designed for modern financial institutions. Would you like to know about our technology, pricing, or see a demo?"
    ] : [
      "¡Excelente pregunta! TarantulaHawk se especializa en detección AML con IA. ¿Podrías ser más específico sobre qué aspecto te interesa más?",
      "Me encantaría ayudarte con eso. Nuestra plataforma se enfoca en monitoreo de transacciones y automatización de cumplimiento. ¿Qué desafío específico tratas de resolver?",
      "¡Pregunta interesante! Nuestra tecnología IA puede ayudar con varios escenarios AML. ¿Podrías compartir más contexto sobre tu caso de uso?",
      "¡Gracias por preguntar! TarantulaHawk ofrece capacidades de detección avanzadas. ¿Cuál es tu preocupación principal - precisión, velocidad, o implementación?",
      "¡Buen punto! Nuestro sistema está diseñado para instituciones financieras modernas. ¿Te gustaría saber sobre nuestra tecnología, precios, o ver una demo?"
    ];
    
    // Select a fallback response based on text content to add variety
    const textHash = lowerText.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
    const responseIndex = Math.abs(textHash) % fallbackResponses.length;
    return fallbackResponses[responseIndex];
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Try rule-based first, then AI if needed
    let response = getRuleBasedResponse(inputText);
    
    if (!response) {
      response = await getAIResponse(inputText);
    }

    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: response,
      isBot: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMessage]);
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        role="chat-button"
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-full p-4 shadow-2xl hover:from-blue-700 hover:to-emerald-600 transition-all z-50 animate-pulse"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-96 bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">TarantulaHawk AI</h3>
                <p className="text-xs text-gray-400">
                  {language === 'en' ? 'Online' : 'En línea'}
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-xs p-3 rounded-2xl ${
                  message.isBot 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-gradient-to-r from-blue-600 to-emerald-500 text-white'
                }`}>
                  <div className="flex items-start gap-2">
                    {message.isBot && <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    {!message.isBot && <User className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    <p className="text-sm">{message.text}</p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 text-white max-w-xs p-3 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={language === 'en' ? 'Ask about AML, API, pricing...' : 'Pregunta sobre AML, API, precios...'}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !inputText.trim()}
                className="bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-lg p-2 hover:from-blue-700 hover:to-emerald-600 transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}