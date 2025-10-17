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

  // Rule-based responses for common questions
  const getRuleBasedResponse = (text: string): string | null => {
    const lowerText = text.toLowerCase();
    
    // Lead capture triggers
    if (lowerText.includes('demo') || lowerText.includes('trial') || lowerText.includes('pricing')) {
      if (!leadCaptured) {
        return language === 'en'
          ? "I'd be happy to help you get started! To provide the best assistance, could you please share your company name and email? This helps me understand your specific AML needs."
          : "¡Me encantaría ayudarte a comenzar! Para brindarte la mejor asistencia, ¿podrías compartir el nombre de tu empresa y email? Esto me ayuda a entender tus necesidades específicas de AML.";
      }
    }

    // API questions
    if (lowerText.includes('api') || lowerText.includes('integration')) {
      return language === 'en'
        ? "Our API allows real-time transaction scoring with <100ms response time. You can deploy it on your own servers for maximum security. The API handles both file uploads and direct transaction streaming. Would you like technical documentation?"
        : "Nuestra API permite puntuación de transacciones en tiempo real con tiempo de respuesta <100ms. Puedes desplegarla en tus propios servidores para máxima seguridad. La API maneja tanto carga de archivos como streaming directo de transacciones. ¿Te gustaría documentación técnica?";
    }

    // AI models
    if (lowerText.includes('ai') || lowerText.includes('machine learning') || lowerText.includes('models')) {
      return language === 'en'
        ? "We use a unique 3-layer architecture: Supervised Learning (trained on known patterns), Unsupervised Learning (detects new anomalies), and Reinforcement Learning (improves from feedback). This gives us >95% detection accuracy."
        : "Usamos una arquitectura única de 3 capas: Aprendizaje Supervisado (entrenado en patrones conocidos), Aprendizaje No Supervisado (detecta nuevas anomalías), y Aprendizaje por Refuerzo (mejora con retroalimentación). Esto nos da >95% precisión de detección.";
    }

    // Compliance
    if (lowerText.includes('compliance') || lowerText.includes('fincen') || lowerText.includes('bsa')) {
      return language === 'en'
        ? "We provide AI-powered detection technology only. You maintain full control of compliance processes, investigations, and reporting. Our platform is compliant with FinCEN BSA (USA) and LFPIORPI (Mexico) standards."
        : "Proporcionamos solo tecnología de detección con IA. Mantienes control total de procesos de cumplimiento, investigaciones y reportes. Nuestra plataforma cumple con estándares FinCEN BSA (USA) y LFPIORPI (México).";
    }

    return null;
  };

  // Call AI API for complex questions
  const getAIResponse = async (text: string): Promise<string> => {
    try {
      const systemPrompt = language === 'en' 
        ? "You are TarantulaHawk's AI assistant. TarantulaHawk is an AI-powered AML compliance platform that provides detection technology (not full compliance service). Key features: 3-layer AI (supervised/unsupervised/reinforcement learning), API integration, on-premise deployment, pay-as-you-go pricing, >95% accuracy, <100ms response time. Be helpful but focus on qualifying leads and directing them to trial signup."
        : "Eres el asistente IA de TarantulaHawk. TarantulaHawk es una plataforma de cumplimiento AML con IA que proporciona tecnología de detección (no servicio completo de cumplimiento). Características clave: IA de 3 capas (aprendizaje supervisado/no supervisado/por refuerzo), integración API, despliegue local, precios por uso, >95% precisión, <100ms tiempo respuesta. Sé útil pero enfócate en calificar leads y dirigirlos al registro de prueba.";

      // Using Hugging Face free API
      const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: `${systemPrompt}\n\nUser: ${text}\nAssistant:`,
          parameters: {
            max_length: 200,
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        throw new Error('AI service unavailable');
      }

      const data = await response.json();
      return data[0]?.generated_text?.split('Assistant:')[1]?.trim() || getRuleBasedFallback(text);
    } catch (error) {
      return getRuleBasedFallback(text);
    }
  };

  const getRuleBasedFallback = (text: string): string => {
    return language === 'en'
      ? "I'd be happy to help! For detailed technical questions, I recommend scheduling a demo with our team. Would you like me to connect you with a specialist?"
      : "¡Me encantaría ayudarte! Para preguntas técnicas detalladas, recomiendo programar una demo con nuestro equipo. ¿Te gustaría que te conecte con un especialista?";
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
        className="fixed bottom-6 right-6 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full p-4 shadow-2xl hover:from-red-700 hover:to-orange-600 transition-all z-50 animate-pulse"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-96 bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-red-600 to-orange-500 rounded-full flex items-center justify-center">
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
                    : 'bg-gradient-to-r from-red-600 to-orange-500 text-white'
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
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !inputText.trim()}
                className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg p-2 hover:from-red-700 hover:to-orange-600 transition disabled:opacity-50"
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