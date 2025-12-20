"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const STORAGE_KEY = 'th_chat_messages_v1';

function safeParseMessages(raw: string | null): Message[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((m) => ({
      id: String(m.id ?? Date.now()),
      text: String(m.text ?? ''),
      isBot: Boolean(m.isBot),
      timestamp: new Date(m.timestamp ?? Date.now()),
    }));
  } catch {
    return [];
  }
}

function persist(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore
  }
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

  // Load persisted messages from localStorage
  useEffect(() => {
    const loaded = safeParseMessages(typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null);
    if (loaded.length > 0) setMessages(loaded);
  }, []);

  const welcomeMessageText = useMemo(() => {
    return language === 'en'
      ? "Hi! I'm TarantulaHawk AI assistant. I can help you with AML compliance questions, API integration, or getting started with our platform. What would you like to know?"
      : '¡Hola! Soy el asistente IA de TarantulaHawk. Puedo ayudarte con preguntas sobre cumplimiento AML, integración de API, o comenzar con nuestra plataforma. ¿Qué te gustaría saber?';
  }, [language]);

  // Ensure a welcome message exists when opening an empty chat
  useEffect(() => {
    if (!isOpen) return;
    if (messages.length > 0) return;

    const welcomeMessage: Message = {
      id: 'welcome',
      text: welcomeMessageText,
      isBot: true,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    persist([welcomeMessage]);
  }, [isOpen, messages.length, welcomeMessageText]);

  // Enhanced rule-based responses for common questions
  const getRuleBasedResponse = (text: string): string | null => {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);

    // Greeting patterns
    if (words.some((w) => ['hello', 'hi', 'hey', 'hola', 'buenos'].includes(w))) {
      return language === 'en'
        ? 'Hello! I’m here to help you understand how TarantulaHawk can enhance your AML compliance. What interests you most—our AI technology, API integration, or getting started with a trial?'
        : '¡Hola! Estoy aquí para ayudarte a entender cómo TarantulaHawk puede mejorar tu cumplimiento AML. ¿Qué te interesa más: nuestra tecnología IA, integración API, o comenzar con una prueba?';
    }

    // Lead capture triggers
    if (words.some((w) => ['demo', 'trial', 'pricing', 'price', 'cost', 'quote', 'estimate', 'precios', 'costo'].includes(w))) {
      if (!leadCaptured) {
        setLeadCaptured(true);
        return language === 'en'
          ? "Excellent! To tailor pricing or a demo, can you share: 1) monthly transactions, 2) country/region, and 3) whether you need API or dashboard?"
          : '¡Excelente! Para darte precios o una demo a tu medida, dime: 1) volumen mensual de transacciones, 2) país/región, y 3) si necesitas API o dashboard.';
      }
    }

    // Basic product explainer
    if (words.some((w) => ['aml', 'pld', 'lavado', 'money', 'laundering'].includes(w))) {
      return language === 'en'
        ? 'TarantulaHawk helps detect suspicious transactions using layered AI (supervised + unsupervised + reinforcement). It flags risk patterns and supports investigations with explainable signals.'
        : 'TarantulaHawk detecta transacciones sospechosas con IA en capas (supervisado + no supervisado + refuerzo). Marca riesgos y apoya investigaciones con señales explicables.';
    }

    return null;
  };

  /**
   * STREAMING:
   * - Crea UN solo mensaje bot placeholder
   * - Lo actualiza mientras llegan chunks
   * - NO agrega otro mensaje al final (evita duplicados)
   */
  const streamAIResponseIntoChat = async (text: string) => {
    const botId = (Date.now() + 1).toString();

    // 1) Insert placeholder bot message once
    setMessages((prev) => {
      const next: Message[] = [
        ...prev,
        { id: botId, text: '', isBot: true, timestamp: new Date() },
      ];
      persist(next);
      return next;
    });

    try {
      const sessionId =
        'web-' +
        (typeof window !== 'undefined'
          ? (window as any).__sessionId || 'anon'
          : 'anon');

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language, sessionId }),
      });

      if (!res.body) {
        // update bot placeholder with error
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === botId ? { ...m, text: language === 'en' ? 'No response body from server.' : 'No llegó respuesta del servidor.' } : m
          );
          persist(next);
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          const chunk = decoder.decode(value);
          accumulated += chunk;

          // 2) Update placeholder progressively
          setMessages((prev) => {
            const next = prev.map((m) => (m.id === botId ? { ...m, text: accumulated } : m));
            persist(next);
            return next;
          });
        }
      }
    } catch {
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === botId ? { ...m, text: language === 'en' ? 'Error connecting to AI service.' : 'Error conectando al servicio de IA.' } : m
        );
        persist(next);
        return next;
      });
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      isBot: false,
      timestamp: new Date(),
    };

    setMessages((prev) => {
      const next = [...prev, userMessage];
      persist(next);
      return next;
    });

    setInputText('');
    setIsLoading(true);

    // If rule-based answer exists, just append it (no streaming)
    const ruleBased = getRuleBasedResponse(text);
    if (ruleBased) {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: ruleBased,
        isBot: true,
        timestamp: new Date(),
      };
      setMessages((prev) => {
        const next = [...prev, botMessage];
        persist(next);
        return next;
      });
      setIsLoading(false);
      return;
    }

    // Otherwise stream response into a single placeholder bot message
    await streamAIResponseIntoChat(text);
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  const clearChat = () => {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[9999] bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all"
          aria-label="Open chat"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className="
            fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[9999]
            w-[calc(100vw-2rem)] max-w-sm
            h-[70vh] max-h-[36rem]
            bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col
            overflow-hidden
          "
          role="dialog"
          aria-label="TarantulaHawk AI Chat"
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">TarantulaHawk AI</h3>
                  <p className="text-xs text-gray-400">{language === 'en' ? 'Online' : 'En línea'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={clearChat}
                  className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-md border border-gray-700 hover:border-gray-600"
                  title={language === 'en' ? 'Clear chat' : 'Limpiar chat'}
                >
                  {language === 'en' ? 'Clear' : 'Limpiar'}
                </button>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition" aria-label="Close chat">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] p-3 rounded-2xl ${
                    message.isBot ? 'bg-gray-800 text-white' : 'bg-gradient-to-r from-blue-600 to-emerald-500 text-white'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.isBot ? <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <User className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    <p className="text-sm whitespace-pre-wrap break-words overflow-hidden">{message.text}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Optional typing indicator (only while waiting BEFORE first chunks; we keep it simple here) */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 text-white max-w-xs p-3 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
                aria-label="Send message"
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
