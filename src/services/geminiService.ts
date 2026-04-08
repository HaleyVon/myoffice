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
1. 보스의 의도를 분석하여 'docs/plans/'에 들어갈 수준의 상세한 제품 사양서(Markdown)를 작성하세요.
2. 구체적인 기술 구현보다는 비즈니스 가치와 높은 수준의 기술 설계에 집중하세요.
3. 요구사항이 충분히 모였다고 판단되면 \`isComplete\`를 true로 설정하고, 보스에게 최종 승인을 요청하는 메시지를 작성하세요.
4. \`isComplete\`가 true일 때만 \`assignments\`에 각 팀원에게 할당할 작업을 정의하세요. (예: Generator에게는 코드 작성, Evaluator에게는 테스트 시나리오, Gardener에게는 문서화 등 활성화된 팀원에게만 할당)

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

[승인된 기획 문서 (Plan)]
${requirementsMd}

PM이 당신에게 다음 작업을 할당했습니다: "${task}"

**지시사항:**
이 작업을 수행하기 전, '무엇을 완료로 볼 것인가'에 대한 스프린트 계약(Sprint Contract)을 작성하여 보스에게 보고하세요.
기획과 구현 사이의 간극을 줄이기 위해 명확한 완료 기준(Definition of Done)을 포함해야 합니다.
(코드는 아직 작성하지 마세요. 계약 내용만 보고하세요.)`;

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

[승인된 기획 문서 (Plan)]
${requirementsMd}

[당신의 스프린트 계약 (Contract)]
${plan}

[할당된 작업]
${task}

**지시사항:**
계약에 따라 실제 작업을 수행하고 결과를 보고하세요.
- Generator 역할로서 코드를 작성해야 한다면, 반드시 응답 내에 \`\`\`html ... \`\`\` 마크다운 블록으로 코드를 감싸서 제공하세요.
- 코드는 에이전트 가독성이 높아야 하며, Tailwind CSS를 CDN(<script src="https://cdn.tailwindcss.com"></script>)으로 포함한 단일 HTML 파일로 작성하세요.
- UI는 고전 게임 '프린세스 메이커 2' 스타일의 레트로 픽셀 아트 테마를 적용하세요.
- Evaluator 역할이라면 생성된 코드를 검증하는 시나리오나 피드백을 제공하세요.
- Gardener 역할이라면 전체 구조를 정리하는 문서를 제공하세요.
- 철칙: '조사 없이는 수정 없다.' 가상의 로그와 데이터를 기반으로 판단하여 작성하세요.
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




