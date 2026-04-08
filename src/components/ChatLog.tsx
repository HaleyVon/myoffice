import React, { useState, useRef, useEffect } from 'react';
import { Message, Agent } from '../types';
import { Send, User } from 'lucide-react';
import { motion } from 'motion/react';

interface ChatLogProps {
  messages: Message[];
  agents: Agent[];
  onSendMessage: (text: string) => void;
  isSimulating: boolean;
}

export const ChatLog: React.FC<ChatLogProps> = ({ messages, agents, onSendMessage, isSimulating }) => {
  const [input, setInput] = useState('');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isNearBottom);
  };

  useEffect(() => {
    if (autoScroll) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSimulating, autoScroll]);

  const handleSend = () => {
    if (input.trim() && !isSimulating) {
      onSendMessage(input.trim());
      setInput('');
      setAutoScroll(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-pm-dark pixel-border overflow-hidden">
      <div className="bg-pm-panel border-b-4 border-pm-gold p-4">
        <h2 className="text-lg font-bold text-pm-gold-dark uppercase tracking-widest">COMMUNICATION_LOG</h2>
        <p className="text-sm text-pm-gold-dark">SYSTEM: ONLINE</p>
      </div>
      
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        ref={chatContainerRef}
        onScroll={handleScroll}
      >
        {messages.map((msg) => {
          const isUser = msg.senderId === 'user';
          const agent = agents.find(a => a.id === msg.senderId);
          
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id} 
              className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-3`}
            >
              {!isUser && (
                <div className="w-10 h-10 bg-pm-dark flex items-center justify-center overflow-hidden pixel-border-sm shrink-0 p-1">
                  {agent?.avatar ? (
                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-pm-gold">SYS</span>
                  )}
                </div>
              )}
              
              <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className="text-xs text-pm-gold-dark mb-1 flex items-center gap-1 uppercase">
                  {isUser ? 'BOSS' : `${agent?.name || 'SYSTEM'} [${agent?.role || 'AI'}]`}
                </div>
                <div className={`p-3 text-sm whitespace-pre-wrap ${isUser ? 'bg-pm-magenta text-pm-text pixel-border-sm' : 'bg-pm-panel text-pm-text pixel-border-sm'}`}>
                  {msg.text}
                </div>
              </div>
              
              {isUser && (
                <div className="w-10 h-10 bg-pm-magenta flex items-center justify-center text-pm-text pixel-border-sm shrink-0">
                  <User size={20} />
                </div>
              )}
            </motion.div>
          );
        })}
        {isSimulating && (
          <div className="flex justify-start gap-3">
            <div className="w-10 h-10 bg-pm-dark flex items-center justify-center text-lg pixel-border-sm shrink-0">
              <span className="text-pm-gold animate-pulse">_</span>
            </div>
            <div className="p-3 text-sm bg-pm-panel text-pm-gold pixel-border-sm flex items-center gap-2">
              <span className="animate-pulse">PROCESSING...</span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>
      
      <div className="p-4 bg-pm-panel border-t-4 border-pm-gold">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="ENTER COMMAND..."
            className="flex-1 px-4 py-2 pixel-input"
            disabled={isSimulating}
          />
          <button
            onClick={handleSend}
            disabled={isSimulating || !input.trim()}
            className="px-4 py-2 pixel-btn flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

