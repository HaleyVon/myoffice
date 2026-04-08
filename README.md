# Agent's Office (가상 IT 팀 시뮬레이션)

## 📌 서비스 개요
**Agent's Office**는 사용자가 '보스(BOSS)'가 되어 가상의 IT 팀(AI 에이전트)과 소통하며 제품을 기획하고 개발하는 시뮬레이션 서비스입니다. 고전 게임 '프린세스 메이커 2' 스타일의 레트로 픽셀 아트 테마를 기반으로 하며, AI 모델(Gemini)을 활용하여 요구사항 분석부터 코드 생성까지의 전체 소프트웨어 개발 생명주기(SDLC)를 자동화하여 체험할 수 있습니다.

## ✨ 주요 기능
1. **가상 IT 팀 구성 및 역할 부여**
   - **Alice (Product Manager):** 요구사항 수집, 명세서 작성, 작업 할당
   - **Bob (UI/UX Designer):** 디자인 및 레이아웃 기획
   - **Charlie (Frontend Dev):** HTML/Tailwind CSS/JS 기반 UI 구현
   - **Dave (Backend Dev):** 데이터 구조 및 API 설계
   - **Eve (QA Engineer):** 테스트 및 엣지 케이스 점검

2. **단계별 워크플로우 (Workflow)**
   - **요구사항 수집 (PM Gathering):** 사용자의 아이디어를 바탕으로 PM(Alice)이 질문을 던지며 요구사항을 구체화합니다.
   - **요구사항 승인 (PM Approval):** PM이 작성한 Markdown 형태의 요구사항 명세서(`REQUIREMENTS.MD`)를 사용자가 검토하고 승인합니다.
   - **작업 계획 수립 (Agent Planning):** 승인된 명세서를 바탕으로 할당된 에이전트들이 각자의 작업 계획을 수립하여 보고합니다.
   - **계획 승인 및 실행 (Agent Executing):** 사용자가 계획을 승인하면, 에이전트들이 실제 작업을 수행하며 결과물(HTML/Tailwind 코드 등)을 생성합니다.

3. **실시간 채팅 및 스트리밍 응답**
   - 에이전트들과의 대화는 실시간 채팅 인터페이스를 통해 이루어집니다.
   - Gemini API의 스트리밍 기능을 활용하여 에이전트의 답변이 타이핑되듯 실시간으로 출력됩니다.

4. **결과물 프리뷰 (Preview)**
   - 에이전트(주로 Frontend Dev)가 생성한 HTML/Tailwind 코드를 추출하여 내장된 iframe을 통해 즉시 렌더링하고 확인할 수 있습니다.

5. **AI 모델 선택 및 토큰 사용량 추적**
   - Gemini 3.1 Pro, 3.1 Flash Lite, 2.5 Flash 모델 중 선택하여 시뮬레이션을 진행할 수 있습니다.
   - 실시간으로 사용된 토큰(Prompt, Candidates, Total) 량을 상단 대시보드에서 확인할 수 있습니다.

## 🛠 기술 스택 및 요구사항
- **Frontend Framework:** React 19, Vite
- **Styling:** Tailwind CSS (v4), 레트로 픽셀 아트 UI
- **AI Integration:** `@google/genai` (Gemini API)
- **Icons:** Lucide React
- **Markdown Rendering:** `react-markdown`
- **Language:** TypeScript

## ⚙️ 핵심 로직 및 아키텍처
1. **상태 관리 (State Management)**
   - `phase`: 현재 워크플로우의 상태를 관리합니다 (`IDLE` -> `PM_GATHERING` -> `WAITING_PM_APPROVAL` -> `AGENT_PLANNING` -> `WAITING_AGENT_APPROVAL` -> `AGENT_EXECUTING`).
   - `agents`: 각 에이전트의 상태(`idle`, `working` 등)와 현재 진행 중인 작업을 관리합니다.
   - `messages`: 사용자와 에이전트 간의 대화 기록을 배열로 관리합니다.

2. **Gemini API 연동 로직 (`src/services/geminiService.ts`)**
   - **`pmGatherRequirements`:** 
     - PM(Alice)의 역할을 수행하는 프롬프트를 구성합니다.
     - `responseSchema`를 활용하여 JSON 형태로 응답을 강제합니다 (`message`, `isComplete`, `draftRequirements`, `assignments`).
     - 요구사항이 충분히 수집되면 `isComplete`를 true로 반환하여 다음 단계로 넘어갑니다.
   - **`agentPlanTask`:**
     - 할당된 에이전트가 요구사항을 바탕으로 작업 계획을 수립하도록 프롬프트를 구성하고 스트리밍 방식으로 응답을 받습니다.
   - **`streamAgentExecute`:**
     - 승인된 계획을 바탕으로 실제 작업을 수행합니다.
     - 정규표현식(`/```html\n([\s\S]*?)\n```/`)을 사용하여 응답 텍스트에서 HTML 코드를 추출하고 `prototypeCode` 상태에 저장하여 프리뷰 탭에 렌더링합니다.

3. **UI 레이아웃 구성**
   - **좌측 패널 (Main View):** 탭(OFFICE, REQUIREMENTS.MD, PREVIEW)을 통해 오피스 전경, 요구사항 명세서, 생성된 결과물을 전환하며 볼 수 있습니다. 하단에는 현재 워크플로우 상태에 따른 승인(Approve) 버튼이 나타납니다.
   - **우측 패널 (Chat Log):** 대화 내역이 표시되며, 사용자가 명령을 내릴 수 있는 입력창이 위치합니다.
