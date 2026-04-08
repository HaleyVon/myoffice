import { GoogleGenAI, Type } from '@google/genai';
import { Agent, Message, TokenUsage, PMGatherResult, AgentAssignment } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function pmGatherRequirements(
  pmAgent: Agent,
  activeAgents: Agent[],
  projectContext: string,
  userMessage: string,
  history: Message[]
): Promise<PMGatherResult> {
  const teamList = activeAgents
    .filter(a => a.id !== pmAgent.id)
    .map(a => `- ${a.id}: ${a.role}`)
    .join('\n');

  const prompt = `${pmAgent.rules}

[보스의 초기 아이디어]
${projectContext}

[최근 대화 기록]
${history.slice(-10).map(m => `${m.senderId === 'user' ? 'BOSS' : 'Alice'}: ${m.text}`).join('\n')}

[보스의 최근 지시]
${userMessage}

[현재 활성화된 팀원 목록]
${teamList}

**지시사항:**
1. 보스의 의도를 파악하고, 명확하지 않은 부분이 있다면 질문하세요.
2. 요구사항이 충분히 모였다고 판단되면 \`isComplete\`를 true로 설정하고, 보스에게 최종 승인을 요청하는 메시지를 작성하세요.
3. \`draftRequirements\`에는 현재까지 파악된 요구사항을 Markdown 형식으로 정리하세요.
4. \`isComplete\`가 true일 때만 \`assignments\`에 각 팀원에게 할당할 작업을 정의하세요. (반드시 활성화된 팀원에게만 할당하세요)

반드시 아래 JSON 형식으로 응답하세요:
{
  "message": "보스에게 전달할 메시지 (질문 또는 승인 요청)",
  "isComplete": boolean,
  "draftRequirements": "요구사항 명세서 (Markdown)",
  "assignments": [
    { "agentId": "charlie", "task": "메인 페이지 UI를 HTML과 Tailwind CSS로 구현하세요." }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: pmAgent.model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            isComplete: { type: Type.BOOLEAN },
            draftRequirements: { type: Type.STRING },
            assignments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  agentId: { type: Type.STRING },
                  task: { type: Type.STRING }
                },
                required: ['agentId', 'task']
              }
            }
          },
          required: ['message', 'isComplete', 'draftRequirements', 'assignments']
        }
      }
    });

    const usage: TokenUsage = {
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0,
    };

    let jsonStr = response.text?.trim() || '{}';
    if (jsonStr.startsWith('\`\`\`')) {
      jsonStr = jsonStr.replace(/^\`\`\`(?:json)?\n?/i, '').replace(/\n?\`\`\`$/i, '').trim();
    }
    const parsed = JSON.parse(jsonStr);
    return {
      message: parsed.message || '요구사항을 분석 중입니다.',
      isComplete: parsed.isComplete || false,
      draftRequirements: parsed.draftRequirements || '',
      assignments: parsed.assignments || [],
      usage
    };
  } catch (e: any) {
    console.error('PM Gathering failed', e);
    throw new Error(e.message || '요구사항 분석 중 오류가 발생했습니다.');
  }
}

export async function agentPlanTask(
  agent: Agent,
  task: string,
  requirementsMd: string,
  onChunk: (text: string) => void
) {
  const prompt = `${agent.rules}

보스(BOSS)가 승인한 요구사항 명세서가 다음과 같습니다.

[요구사항 명세서]
${requirementsMd}

PM이 당신에게 다음 작업을 할당했습니다: "${task}"

**지시사항:**
이 작업을 어떻게 수행할 것인지 구체적인 '작업 계획'을 작성하여 보스에게 보고하고 승인을 요청하세요.
말투는 전문가답고 보스를 존중하는 태도로 작성하세요.
(코드는 아직 작성하지 마세요. 계획만 보고하세요.)`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: agent.model,
      contents: prompt,
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullText += chunk.text;
        onChunk(chunk.text);
      }
    }

    return { fullText };
  } catch (e: any) {
    console.error(`Planning failed for ${agent.name}`, e);
    throw e;
  }
}

export async function streamAgentExecute(
  agent: Agent,
  task: string,
  requirementsMd: string,
  plan: string,
  onChunk: (text: string) => void
) {
  const prompt = `${agent.rules}

보스(BOSS)가 당신의 작업 계획을 승인했습니다!

[요구사항 명세서]
${requirementsMd}

[당신의 작업 계획]
${plan}

[할당된 작업]
${task}

**지시사항:**
계획에 따라 실제 작업을 수행하고 결과를 보고하세요.
만약 당신이 코드를 작성해야 한다면, 반드시 응답 내에 \`\`\`html ... \`\`\` 마크다운 블록으로 코드를 감싸서 제공하세요.
- 코드는 Tailwind CSS를 CDN(<script src="https://cdn.tailwindcss.com"></script>)으로 포함해야 합니다.
- 단일 HTML 파일로 작성하여 iframe에서 즉시 실행 가능하도록 하세요.
- UI는 고전 게임 '프린세스 메이커 2' 스타일의 레트로 픽셀 아트 테마를 적용하세요. (예: 짙은 파란색 배경, 황금색 테두리, 마젠타색 포인트, 픽셀 폰트 등)
`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: agent.model,
      contents: prompt,
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullText += chunk.text;
        onChunk(chunk.text);
      }
    }

    return { fullText };
  } catch (e: any) {
    console.error(`Execution failed for ${agent.name}`, e);
    throw e;
  }
}




