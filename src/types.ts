export type AgentStatus = 'idle' | 'working' | 'discussing' | 'waiting_for_user';

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask: string;
  avatar: string;
  color: string;
  isActive: boolean;
  rules: string;
  model: string;
}

export interface Message {
  id: string;
  senderId: string; // 'user' or agent id
  text: string;
  timestamp: number;
}

export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export type WorkflowPhase = 
  | 'IDLE' 
  | 'PM_GATHERING' 
  | 'WAITING_PM_APPROVAL' 
  | 'AGENT_PLANNING' 
  | 'WAITING_AGENT_APPROVAL' 
  | 'AGENT_EXECUTING';

export interface AgentAssignment {
  agentId: string;
  task: string;
}

export interface PMGatherResult {
  message: string;
  isComplete: boolean;
  draftRequirements: string;
  assignments: AgentAssignment[];
  usage: TokenUsage;
}


