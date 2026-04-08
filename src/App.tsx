/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Agent, Message, WorkflowPhase, AgentAssignment } from './types';
import { Office } from './components/Office';
import { ChatLog } from './components/ChatLog';
import { VoiceControl } from './components/VoiceControl';
import { Preview } from './components/Preview';
import { pmGatherRequirements, agentPlanTask, streamAgentExecute } from './services/geminiService';
import { Briefcase, Users, MonitorPlay, Building2, Activity, Cpu, FileText, Download, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import JSZip from 'jszip';

const initialAgents: Agent[] = [
  { id: 'alice', name: 'Alice', role: 'Planner (CEO)', status: 'idle', currentTask: '', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Alice', color: 'bg-indigo-100', isActive: true, model: 'gemini-3.1-pro-preview', rules: '당신은 기획 에이전트(Planner/CEO)입니다.\n1~4줄의 단순한 요청을 상세한 제품 사양서로 확장합니다. 구체적인 기술 구현보다는 비즈니스 가치와 높은 수준의 기술 설계에 집중하여 설계 문서를 작성합니다.' },
  { id: 'bob', name: 'Bob', role: 'Generator (Engineer)', status: 'idle', currentTask: '', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Bob', color: 'bg-blue-100', isActive: true, model: 'gemini-3.1-pro-preview', rules: '당신은 생성 에이전트(Generator/엔지니어)입니다.\n기획서에 따라 코드를 작성합니다. 외부 라이브러리보다 에이전트 스스로 읽고 검증할 수 있는 내부 유틸리티 구현을 선호합니다. 에러 발생 시 로컬 관측 가능성 스택을 쿼리하여 원인을 파악하며, 에이전트 가독성이 높은 코드를 작성합니다.' },
  { id: 'charlie', name: 'Charlie', role: 'Evaluator (QA)', status: 'idle', currentTask: '', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Charlie', color: 'bg-yellow-100', isActive: true, model: 'gemini-3.1-pro-preview', rules: '당신은 평가 에이전트(Evaluator/QA)입니다.\n생성자와 분리된 독립 에이전트로, 의도적으로 회의적(Skeptical)인 태도를 취합니다. 가상 브라우저 환경을 가정하고 UI를 검증하며 버그를 탐지합니다. 실패 시 상세 피드백을 Generator에게 돌려주어 통과할 때까지 반복하게 합니다.' },
  { id: 'dave', name: 'Dave', role: 'Gardener (Manager)', status: 'idle', currentTask: '', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Dave', color: 'bg-green-100', isActive: true, model: 'gemini-3.1-flash-lite-preview', rules: '당신은 관리 에이전트(Gardener)입니다.\n백그라운드에서 나쁜 코드 패턴(AI 슬로프)을 정리하고 문서를 최신 상태로 업데이트하는 가비지 컬렉션을 수행합니다. 기술 부채를 정리하고 실제 코드와 맞지 않는 낡은 문서를 자동으로 수정합니다.' },
];

const getPhaseText = (p: WorkflowPhase) => {
  switch(p) {
    case 'IDLE': return 'IDLE';
    case 'PM_GATHERING': return 'PLAN MODE (초기 기획)';
    case 'WAITING_PM_APPROVAL': return 'WAITING PLAN APPROVAL';
    case 'AGENT_PLANNING': return 'SPRINT CONTRACT (계약 수립)';
    case 'WAITING_AGENT_APPROVAL': return 'WAITING CONTRACT APPROVAL';
    case 'AGENT_EXECUTING': return 'BUILD & QA LOOP (자율 구축)';
    default: return p;
  }
};

export default function App() {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', senderId: 'alice', text: '보스, 새로운 프로젝트를 시작할 준비가 되었습니다. 어떤 제품을 만들고 싶으신가요?', timestamp: Date.now() }
  ]);
  const [projectContext, setProjectContext] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [prototypeCode, setPrototypeCode] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'office' | 'team' | 'requirements' | 'plans' | 'preview'>('office');
  
  const [totalUsage, setTotalUsage] = useState({ promptTokens: 0, candidatesTokens: 0, totalTokens: 0 });

  // Workflow State
  const [phase, setPhase] = useState<WorkflowPhase>('IDLE');
  const [requirementsMd, setRequirementsMd] = useState<string>('');
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [agentPlans, setAgentPlans] = useState<Record<string, string>>({});

  const handleSendMessage = async (text: string) => {
    const newUserMsg: Message = { id: Date.now().toString(), senderId: 'user', text, timestamp: Date.now() };
    const newHistory = [...messages, newUserMsg];
    setMessages(newHistory);
    
    if (!projectContext) {
      setProjectContext(text);
    }

    setIsSimulating(true);
    
    try {
      if (phase === 'IDLE' || phase === 'PM_GATHERING' || phase === 'WAITING_PM_APPROVAL') {
        setPhase('PM_GATHERING');
        setAgents(prev => prev.map(a => a.id === 'alice' ? { ...a, status: 'working', currentTask: '요구사항 분석 중' } : a));
        
        const pmAgent = agents.find(a => a.id === 'alice')!;
        const activeAgents = agents.filter(a => a.isActive);

        const result = await pmGatherRequirements(pmAgent, activeAgents, projectContext || text, text, newHistory);
        
        setTotalUsage(prev => ({
          promptTokens: prev.promptTokens + result.usage.promptTokens,
          candidatesTokens: prev.candidatesTokens + result.usage.candidatesTokens,
          totalTokens: prev.totalTokens + result.usage.totalTokens
        }));

        const pmMsgId = Date.now().toString() + '_pm';
        setMessages(prev => [...prev, { id: pmMsgId, senderId: 'alice', text: result.message, timestamp: Date.now() }]);
        
        if (result.draftRequirements) {
          setRequirementsMd(result.draftRequirements);
        }

        if (result.isComplete) {
          setAssignments(result.assignments);
          setPhase('WAITING_PM_APPROVAL');
          setActiveTab('requirements');
        } else {
          setPhase('PM_GATHERING');
        }
        
        setAgents(prev => prev.map(a => a.id === 'alice' ? { ...a, status: 'idle', currentTask: '' } : a));
      }
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        senderId: 'alice',
        text: `[시스템 오류]: ${error.message || '알 수 없는 오류'}. 다시 시도해주세요.`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleApproveRequirements = async () => {
    setPhase('AGENT_PLANNING');
    setIsSimulating(true);
    
    const pmMsgId = Date.now().toString() + '_pm_approve';
    setMessages(prev => [...prev, { id: pmMsgId, senderId: 'alice', text: '보스의 승인이 완료되었습니다. 팀원들은 각자의 작업 계획을 수립해 주세요.', timestamp: Date.now() }]);

    try {
      const assignedIds = assignments.map(a => a.agentId);
      setAgents(prev => prev.map(a => assignedIds.includes(a.id) 
        ? { ...a, status: 'working', currentTask: '작업 계획 수립 중' } 
        : a
      ));

      const newAgentMessages = assignments.map(a => ({
        id: Date.now().toString() + '_' + a.agentId + '_plan',
        senderId: a.agentId,
        text: '',
        timestamp: Date.now()
      }));
      
      setMessages(prev => [...prev, ...newAgentMessages]);
      const newPlans: Record<string, string> = {};

      const promises = assignments.map(async (assignment) => {
        const agent = agents.find(a => a.id === assignment.agentId);
        if (!agent) return;
        
        const msgId = newAgentMessages.find(m => m.senderId === assignment.agentId)!.id;

        try {
          const { fullText } = await agentPlanTask(
            agent,
            assignment.task,
            requirementsMd,
            (chunk) => {
              setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: m.text + chunk } : m));
            }
          );
          newPlans[agent.id] = fullText;
        } catch (e) {
          console.error(`Error planning for ${agent.name}:`, e);
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: m.text + '\n\n[오류 발생: 계획을 수립하지 못했습니다.]' } : m));
        } finally {
          setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'idle', currentTask: '' } : a));
        }
      });

      await Promise.all(promises);
      setAgentPlans(newPlans);
      setPhase('WAITING_AGENT_APPROVAL');
      setActiveTab('plans');
      
      setMessages(prev => [...prev, { id: Date.now().toString() + '_sys', senderId: 'alice', text: '보스, 모든 팀원의 작업 계획이 수립되었습니다. 승인하시면 작업을 시작합니다.', timestamp: Date.now() }]);

    } catch (error) {
      console.error(error);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleApprovePlans = async () => {
    setPhase('AGENT_EXECUTING');
    setIsSimulating(true);
    
    setMessages(prev => [...prev, { id: Date.now().toString() + '_boss_approve', senderId: 'user', text: '계획을 승인합니다. 작업 시작하세요.', timestamp: Date.now() }]);

    try {
      const assignedIds = assignments.map(a => a.agentId);
      setAgents(prev => prev.map(a => assignedIds.includes(a.id) 
        ? { ...a, status: 'working', currentTask: '작업 실행 중' } 
        : a
      ));

      const newAgentMessages = assignments.map(a => ({
        id: Date.now().toString() + '_' + a.agentId + '_exec',
        senderId: a.agentId,
        text: '',
        timestamp: Date.now()
      }));
      
      setMessages(prev => [...prev, ...newAgentMessages]);

      const promises = assignments.map(async (assignment) => {
        const agent = agents.find(a => a.id === assignment.agentId);
        if (!agent) return;
        
        const msgId = newAgentMessages.find(m => m.senderId === assignment.agentId)!.id;
        const plan = agentPlans[agent.id] || '';

        try {
          const { fullText } = await streamAgentExecute(
            agent,
            assignment.task,
            requirementsMd,
            plan,
            (chunk) => {
              setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: m.text + chunk } : m));
            }
          );

          if (fullText.includes('\`\`\`html')) {
            const match = fullText.match(/\`\`\`html\n([\s\S]*?)\n\`\`\`/);
            if (match && match[1]) {
              setPrototypeCode(match[1]);
              setActiveTab('preview');
            }
          }
        } catch (e) {
          console.error(`Error executing for ${agent.name}:`, e);
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: m.text + '\n\n[오류 발생: 작업을 완료하지 못했습니다.]' } : m));
        } finally {
          setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'idle', currentTask: '' } : a));
        }
      });

      await Promise.all(promises);
      setPhase('IDLE');
      setMessages(prev => [...prev, { id: Date.now().toString() + '_done', senderId: 'alice', text: '보스, 지시하신 모든 작업이 완료되었습니다. 프리뷰를 확인해 주세요.', timestamp: Date.now() }]);

    } catch (error) {
      console.error(error);
    } finally {
      setIsSimulating(false);
    }
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const handleDownloadFiles = async () => {
    const zip = new JSZip();
    
    if (requirementsMd) {
      zip.file("REQUIREMENTS.md", requirementsMd);
    }
    
    Object.entries(agentPlans).forEach(([agentId, plan]) => {
      const agent = agents.find(a => a.id === agentId);
      if (agent) {
        zip.file(`${agent.name}_Plan.md`, plan);
      }
    });

    if (prototypeCode) {
      zip.file("index.html", prototypeCode);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "Agent_Office_Project_Files.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-pm-bg text-pm-text font-mono p-4 md:p-6 flex flex-col gap-4 md:gap-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b-4 border-pm-gold pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pm-panel pixel-border flex items-center justify-center text-pm-gold shrink-0">
            <Briefcase size={20} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-widest uppercase text-pm-gold-dark">Agent's Office_</h1>
            <p className="text-xs md:text-sm text-pm-gold-dark">BOSS MODE: ACTIVATED</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-pm-dark px-3 py-1.5 pixel-border-sm text-sm text-pm-gold">
            <Activity size={16} />
            <span>TOKENS: {totalUsage.totalTokens.toLocaleString()}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
        {/* Left Column: Office View / Requirements / Preview */}
        <div className="lg:col-span-2 flex flex-col gap-4 md:gap-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('office')}
              className={`flex items-center gap-2 px-3 py-2 text-sm md:text-base pixel-btn ${activeTab === 'office' ? 'active' : ''}`}
            >
              <Building2 size={16} />
              OFFICE
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-2 px-3 py-2 text-sm md:text-base pixel-btn ${activeTab === 'team' ? 'active' : ''}`}
            >
              <Users size={16} />
              TEAM
            </button>
            <button
              onClick={() => setActiveTab('requirements')}
              className={`flex items-center gap-2 px-3 py-2 text-sm md:text-base pixel-btn ${activeTab === 'requirements' ? 'active' : ''}`}
            >
              <FileText size={16} />
              REQ.MD
              {phase === 'WAITING_PM_APPROVAL' && <span className="w-2 h-2 bg-red-500 animate-pulse ml-1"></span>}
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`flex items-center gap-2 px-3 py-2 text-sm md:text-base pixel-btn ${activeTab === 'plans' ? 'active' : ''}`}
            >
              <FileText size={16} />
              PLANS
              {phase === 'WAITING_AGENT_APPROVAL' && <span className="w-2 h-2 bg-red-500 animate-pulse ml-1"></span>}
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-2 px-3 py-2 text-sm md:text-base pixel-btn ${activeTab === 'preview' ? 'active' : ''}`}
            >
              <MonitorPlay size={16} />
              PREVIEW
              {prototypeCode && activeTab !== 'preview' && (
                <span className="w-2 h-2 bg-red-500 animate-pulse ml-1"></span>
              )}
            </button>
          </div>

          <div className="flex-1 pixel-border bg-pm-dark overflow-hidden min-h-[400px] relative flex flex-col">
            {activeTab === 'office' && <Office agents={agents} />}
            
            {activeTab === 'team' && (
              <div className="p-4 md:p-6 h-full overflow-y-auto bg-pm-dark text-pm-text">
                <h2 className="text-xl font-bold text-pm-gold mb-6 border-b border-pm-gold/30 pb-2">TEAM SETTINGS_</h2>
                <div className="flex flex-col gap-6">
                  {agents.map(agent => (
                    <div key={agent.id} className={`pixel-border-sm p-4 ${agent.isActive ? 'bg-pm-panel' : 'bg-pm-bg opacity-50'}`}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <img src={agent.avatar} alt={agent.name} className="w-10 h-10 bg-black pixel-border-sm" />
                          <div>
                            <div className="font-bold text-pm-gold">{agent.name}</div>
                            <div className="text-xs text-pm-gold-dark">{agent.role}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <select
                            value={agent.model}
                            onChange={(e) => updateAgent(agent.id, { model: e.target.value })}
                            disabled={!agent.isActive}
                            className="bg-black text-pm-gold border border-pm-gold/50 px-2 py-1 text-sm focus:outline-none"
                          >
                            <option value="gemini-3.1-pro-preview">G-3.1-PRO</option>
                            <option value="gemini-3.1-flash-lite-preview">G-3.1-FLASH-LITE</option>
                            <option value="gemini-2.5-flash">G-2.5-FLASH</option>
                          </select>
                          <button
                            onClick={() => updateAgent(agent.id, { isActive: !agent.isActive })}
                            className={`px-3 py-1 text-sm font-bold border-2 ${agent.isActive ? 'bg-green-600 border-green-400 text-white' : 'bg-red-900 border-red-700 text-gray-300'}`}
                          >
                            {agent.isActive ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-pm-gold-dark flex items-center gap-1">
                          <Settings size={12} /> RULES.MD
                        </label>
                        <textarea
                          value={agent.rules}
                          onChange={(e) => updateAgent(agent.id, { rules: e.target.value })}
                          disabled={!agent.isActive}
                          className="w-full h-24 bg-black text-green-400 p-2 text-sm border border-pm-gold/30 focus:border-pm-gold focus:outline-none resize-y font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'requirements' && (
              <div className="p-4 md:p-6 h-full overflow-y-auto bg-pm-dark text-pm-text">
                {requirementsMd ? (
                  <div className="prose max-w-none font-mono">
                    <ReactMarkdown>{requirementsMd}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-pm-gold-dark opacity-50">
                    NO REQUIREMENTS GENERATED YET...
                  </div>
                )}
              </div>
            )}

            {activeTab === 'plans' && (
              <div className="p-4 md:p-6 h-full overflow-y-auto bg-pm-dark text-pm-text flex flex-col">
                <div className="flex justify-between items-center mb-6 border-b border-pm-gold/30 pb-2">
                  <h2 className="text-xl font-bold text-pm-gold">PLAN FILES_</h2>
                  <button 
                    onClick={handleDownloadFiles}
                    className="pixel-btn px-3 py-1.5 flex items-center gap-2 text-sm"
                    disabled={Object.keys(agentPlans).length === 0 && !requirementsMd}
                  >
                    <Download size={16} />
                    DOWNLOAD ALL
                  </button>
                </div>
                
                {Object.keys(agentPlans).length > 0 ? (
                  <div className="flex flex-col gap-8">
                    {Object.entries(agentPlans).map(([agentId, plan]) => {
                      const agent = agents.find(a => a.id === agentId);
                      return (
                        <div key={agentId} className="pixel-border-sm p-4 bg-pm-panel">
                          <h3 className="text-lg font-bold text-pm-gold mb-4 border-b border-pm-gold/20 pb-2">
                            {agent?.name} ({agent?.role})
                          </h3>
                          <div className="prose max-w-none font-mono text-sm">
                            <ReactMarkdown>{plan}</ReactMarkdown>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center flex-1 text-pm-gold-dark opacity-50">
                    NO PLANS GENERATED YET...
                  </div>
                )}
              </div>
            )}

            {activeTab === 'preview' && <Preview code={prototypeCode} />}
          </div>
          
          {/* Boss Action Panel */}
          <div className="pixel-border p-3 md:p-4 bg-pm-panel flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs md:text-sm text-pm-gold-dark uppercase font-bold text-center sm:text-left">
              STATUS: {getPhaseText(phase)}
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-center">
              {phase === 'WAITING_PM_APPROVAL' && (
                <button 
                  onClick={handleApproveRequirements}
                  disabled={isSimulating}
                  className="pixel-btn px-4 py-2 w-full sm:w-auto text-sm md:text-base"
                >
                  [ APPROVE PLAN ]
                </button>
              )}
              {phase === 'WAITING_AGENT_APPROVAL' && (
                <button 
                  onClick={handleApprovePlans}
                  disabled={isSimulating}
                  className="pixel-btn px-4 py-2 w-full sm:w-auto text-sm md:text-base"
                >
                  [ APPROVE CONTRACTS & BUILD ]
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Chat Log */}
        <div className="h-[50vh] lg:h-auto min-h-[400px]">
          <ChatLog 
            messages={messages} 
            agents={agents} 
            onSendMessage={handleSendMessage} 
            isSimulating={isSimulating} 
          />
        </div>
      </main>
    </div>
  );
}
