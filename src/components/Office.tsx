import React from 'react';
import { Agent } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, HelpCircle, Monitor, Coffee } from 'lucide-react';

interface OfficeProps {
  agents: Agent[];
}

export const Office: React.FC<OfficeProps> = ({ agents }) => {
  const activeAgents = agents.filter(a => a.isActive);
  const idleAgents = activeAgents.filter(a => a.status === 'idle');
  const workingAgents = activeAgents.filter(a => a.status !== 'idle');

  const renderAgent = (agent: Agent, isWorking: boolean) => (
    <motion.div 
      layoutId={`agent-${agent.id}`}
      key={agent.id} 
      className="relative flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      {/* Status Bubble */}
      <div className="absolute -top-12 flex justify-center w-full z-20">
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            key={agent.status + agent.currentTask}
            className="bg-pm-panel text-pm-text text-xs px-2 py-1 pixel-border-sm flex items-center gap-1 whitespace-nowrap uppercase"
          >
            {agent.status === 'working' && <Monitor size={12} className="text-pm-gold" />}
            {agent.status === 'discussing' && <MessageSquare size={12} className="text-pm-gold" />}
            {agent.status === 'waiting_for_user' && <HelpCircle size={12} className="text-pm-gold" />}
            {agent.status === 'idle' && <Coffee size={12} className="text-pm-gold-dark" />}
            <span className="font-medium max-w-[120px] truncate">{agent.currentTask || 'IDLE'}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Avatar */}
      <div className="relative z-10 flex flex-col items-center mt-4">
        <div className={`w-16 h-16 flex items-center justify-center overflow-hidden pixel-border-sm ${isWorking ? 'bg-pm-magenta border-pm-gold' : 'bg-pm-dark border-pm-gold-dark'} transition-colors duration-300`}>
          <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
        
        {/* Desk (Only visible when working) */}
        {isWorking && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="w-24 h-12 bg-amber-900 mt-2 relative border-t-4 border-amber-700 flex justify-center pixel-border-sm border-b-0"
          >
            {/* Computer Monitor */}
            <div className="w-12 h-8 bg-pm-dark mt-1 border-2 border-pm-gold relative overflow-hidden">
              <motion.div 
                className="absolute inset-0 bg-pm-magenta/30"
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
            </div>
          </motion.div>
        )}
      </div>
      
      <div className="mt-2 text-center z-10 bg-pm-panel px-2 pixel-border-sm">
        <div className="text-sm font-bold text-pm-gold-dark uppercase">{agent.name}</div>
        <div className="text-xs text-pm-text uppercase">{agent.role}</div>
      </div>
    </motion.div>
  );

  return (
    <div className="w-full h-full bg-pm-dark p-4 md:p-8 relative overflow-hidden flex flex-col gap-4 md:gap-8 min-h-[400px]">
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, var(--color-pm-gold-dark) 2px, transparent 2px), linear-gradient(to bottom, var(--color-pm-gold-dark) 2px, transparent 2px)', backgroundSize: '40px 40px' }}></div>
      
      {/* Work Area */}
      <div className="flex-1 border-4 border-pm-gold p-4 relative bg-pm-bg shadow-[inset_2px_2px_0px_rgba(255,255,255,0.2),inset_-2px_-2px_0px_rgba(0,0,0,0.5)] min-h-[200px]">
        <div className="absolute top-2 left-2 text-pm-gold-dark text-xs font-bold tracking-widest uppercase">WORKSTATIONS_</div>
        <div className="flex flex-wrap justify-center items-end gap-6 md:gap-12 h-full pt-8">
          {workingAgents.map(agent => renderAgent(agent, true))}
        </div>
      </div>

      {/* Lounge Area */}
      <div className="min-h-[120px] md:h-48 border-4 border-pm-gold p-4 relative bg-pm-bg shadow-[inset_2px_2px_0px_rgba(255,255,255,0.2),inset_-2px_-2px_0px_rgba(0,0,0,0.5)]">
        <div className="absolute top-2 left-2 text-pm-gold-dark text-xs font-bold tracking-widest uppercase">LOUNGE_AREA_</div>
        <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8 h-full pt-6">
          {idleAgents.map(agent => renderAgent(agent, false))}
        </div>
      </div>
    </div>
  );
};

