## النهائية: Next.js + Clerk + 토스페이먼츠 + Supabase 연동 통합 가이드 (2025년 10월 기준)

본 문서는 Next.js App Router 환경에서 사용자 인증(Clerk), 정기결제(토스페이먼츠), 데이터베이스(Supabase), AI 기능(Gemini API)을 통합하는 방법에 대한 최종 가이드입니다. 최신 공식 문서와 보안 권장 사항을 기반으로 작성되었습니다.

### 🎯 연동 아키텍처 요약

| 서비스           | 연동 수단               | 주요 기능                                                |
| :--------------- | :---------------------- | :------------------------------------------------------- |
| **Clerk**        | `SDK`, `Webhook`        | 사용자 인증, 세션 관리, UI 컴포넌트, DB 사용자 동기화    |
| **토스페이먼츠** | `SDK`, `API`, `Webhook` | 카드 등록 (빌링키 발급), 정기결제 승인, 결제 상태 동기화 |
| **Supabase**     | `SDK`                   | 사용자 정보, 구독 상태, API 사용량 데이터 저장 및 관리   |
| **Gemini API**   | `SDK`                   | 사용자 등급에 따른 AI 모델 호출 및 기능 제공             |

---

## 1️⃣ Clerk: 사용자 인증 및 관리

Clerk는 사용자 가입, 로그인, 프로필 관리 등 인증 관련 기능을 처리하고, Webhook을 통해 우리 서비스의 데이터베이스(Supabase)와 사용자 정보를 동기화합니다.

### ⚙️ 연동 수단 및 기능

- **SDK (`@clerk/nextjs`)**:
  - 로그인/회원가입 UI 컴포넌트 제공
  - `middleware.ts`를 통한 라우트 보호
  - 서버/클라이언트 컴포넌트에서 사용자 세션 정보 조회
- **Webhook**:
  - `user.created`: 신규 가입 시 Supabase `users` 테이블에 레코드 생성
  - `user.deleted`: 회원 탈퇴 시 Supabase `users` 테이블에서 레코드 삭제

### 📥 설치 및 설정

1.  **SDK 설치**: 최신 버전을 설치하여 보안 패치를 적용합니다.

    ```bash
    npm install @clerk/nextjs@latest
    ```

2.  **`middleware.ts` 설정**: 인증이 필요한 페이지를 보호하고 Webhook 엔드포인트는 공개 처리합니다.

    ```typescript
    // middleware.ts
    import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

    const isPublicRoute = createRouteMatcher([
      '/',
      '/sign-in(.*)',
      '/sign-up(.*)',
      '/api/webhooks/clerk', // Webhook 경로는 반드시 인증 예외 처리
    ]);

    export default clerkMiddleware((auth, req) => {
      if (!isPublicRoute(req)) {
        auth.protect();
      }
    });

    export const config = {
      matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
      ],
    };
    ```

3.  **Layout 설정**: 앱 전체에 Clerk 인증 컨텍스트를 제공합니다.

    ```typescript
    // app/layout.tsx
    import { ClerkProvider } from '@clerk/nextjs';

    export default function RootLayout({ children }: { children: React.ReactNode }) {
      return (
        <ClerkProvider>
          <html lang='ko'>
            <body>{children}</body>
          </html>
        </ClerkProvider>
      );
    }
    ```

### 🔑 인증 정보 관리

1.  [Clerk Dashboard](https://dashboard.clerk.com)에서 Application 생성 후 **API Keys** 메뉴로 이동합니다.
2.  `Publishable key`와 `Secret key`를 복사합니다.
3.  **Webhooks** 메뉴에서 `Add Endpoint`를 클릭하고, 엔드포인트 URL(`https://your-domain.com/api/webhooks/clerk`)과 구독할 이벤트(`user.created`, `user.deleted`)를 등록한 뒤 `Signing secret`을 복사합니다.
4.  복사한 키들을 `.env.local` 파일에 저장합니다.

    ```bash
    # .env.local
    # Clerk Keys
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
    CLERK_SECRET_KEY=sk_test_...
    CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
    ```

### 📞 호출 및 구현 방법

- **서버 컴포넌트에서 사용자 정보 호출**:

  ```typescript
  import { auth, currentUser } from '@clerk/nextjs/server';

  export default async function Page() {
    const { userId } = auth(); // 사용자 ID
    const user = await currentUser(); // 사용자 전체 정보

    if (!userId) return null;
    return <div>Welcome, {user?.firstName}</div>;
  }
  ```

- **Webhook 핸들러 구현**: Clerk의 `verifyWebhook` 유틸리티로 요청을 검증하고, 이벤트 타입에 따라 Supabase 데이터를 처리합니다.

  ```typescript
  // app/api/webhooks/clerk/route.ts
  import { Webhook } from 'svix';
  import { headers } from 'next/headers';
  import { WebhookEvent } from '@clerk/nextjs/server';
  import { createServerClient } from '@/lib/supabase/server'; // Supabase 서버 클라이언트

  export async function POST(req: Request) {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    if (!WEBHOOK_SECRET) {
      throw new Error(
        'Please add CLERK_WEBHOOK_SIGNING_SECRET from Clerk Dashboard to .env'
      );
    }

    // 헤더 가져오기
    const headerPayload = headers();
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response('Error occured -- no svix headers', { status: 400 });
    }

    const payload = await req.json();
    const body = JSON.stringify(payload);
    const wh = new Webhook(WEBHOOK_SECRET);
    let evt: WebhookEvent;

    // 웹훅 검증
    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return new Response('Error occured', { status: 400 });
    }

    const { id } = evt.data;
    const eventType = evt.type;
    const supabase = createServerClient();

    // 이벤트 타입에 따른 처리
    if (eventType === 'user.created') {
      await supabase.from('users').insert({
        clerk_user_id: id,
        email: evt.data.email_addresses[0].email_address,
      });
    }

    if (eventType === 'user.deleted') {
      await supabase.from('users').delete().eq('clerk_user_id', id);
    }

    return new Response('', { status: 200 });
  }
  ```

---

## 2️⃣ 토스페이먼츠: 정기결제 연동

빌링키(Billing Key) 방식을 사용하여 사용자의 결제 정보를 저장하고, 매월 자동으로 결제를 승인합니다.

### ⚙️ 연동 수단 및 기능

- **SDK (`@tosspayments/payment-sdk`)**:
  - 프론트엔드에서 카드 정보 입력을 위한 결제창 호출
- **API**:
  - `POST /v1/billing/authorizations/issue`: 사용자가 인증한 `authKey`를 서버에서 빌링키로 교환
  - `POST /v1/billing/{billingKey}`: 저장된 빌링키로 정기결제 승인 요청
- **Webhook**:
  - `PAYMENT_STATUS_CHANGED`: 결제 성공/실패 등 상태 변경 시 알림 수신 및 DB 업데이트

### 📥 설치 및 설정

1.  **SDK 로드**: CDN 방식을 권장하므로, 결제 페이지에서 스크립트 태그를 통해 동적으로 로드합니다.
    ```typescript
    // pages/subscribe.tsx
    import { loadTossPayments } from '@tosspayments/payment-sdk';
    ```

### 🔑 인증 정보 관리

1.  [토스페이먼츠 개발자센터](https://developers.tosspayments.com)에서 **API 키** 메뉴로 이동합니다.
2.  `클라이언트 키`와 `시크릿 키`를 복사합니다.
3.  `.env.local` 파일에 저장합니다.

    ```bash
    # .env.local
    # Toss Payments Keys
    NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...
    TOSS_SECRET_KEY=test_sk_...
    ```

### 📞 호출 및 구현 방법

- **클라이언트: 결제창 호출**: 사용자가 구독 버튼을 누르면 `requestBillingAuth`를 호출하여 카드 인증을 요청합니다.

  ```typescript
  // components/SubscribeButton.tsx
  'use client';
  import { loadTossPayments } from '@tosspayments/payment-sdk';
  import { nanoid } from 'nanoid';

  const handleSubscribe = async () => {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;
    const tossPayments = await loadTossPayments(clientKey);

    await tossPayments.requestBillingAuth('카드', {
      customerKey: nanoid(), // 각 사용자를 식별하는 고유한 키
      successUrl: `${window.location.origin}/api/billing/success`,
      failUrl: `${window.location.origin}/api/billing/fail`,
    });
  };
  ```

- **서버: 빌링키 발급 및 저장**: 인증 성공 후 리다이렉트된 `successUrl`에서 `authKey`를 받아 빌링키 발급 API를 호출합니다.

  ```typescript
  // app/api/billing/success/route.ts
  import { NextRequest, NextResponse } from 'next/server';

  export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const authKey = searchParams.get('authKey');
    const customerKey = searchParams.get('customerKey');
    const secretKey = process.env.TOSS_SECRET_KEY!;

    // 시크릿 키는 반드시 뒤에 ':'를 붙여 Base64 인코딩해야 합니다.
    const encryptedKey = Buffer.from(`${secretKey}:`).toString('base64');

    const response = await fetch(
      'https://api.tosspayments.com/v1/billing/authorizations/issue',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${encryptedKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authKey, customerKey }),
      }
    );

    if (!response.ok) {
      // 에러 처리
      return NextResponse.redirect(new URL('/error', request.url));
    }

    const { billingKey } = await response.json();

    // 1. billingKey와 customerKey를 Supabase DB에 저장
    // 2. 저장된 billingKey로 첫 결제 승인 요청

    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  ```

- **Webhook 핸들러 구현**: 토스페이먼츠의 요청인지 검증하는 로직을 포함해야 합니다. (토스페이먼츠는 공식 IP 대역을 제공하며, 일부 웹훅은 시그니처 검증을 지원합니다)

  ```typescript
  // app/api/webhooks/tosspayments/route.ts
  import { NextRequest, NextResponse } from 'next/server';

  export async function POST(req: NextRequest) {
    // 🚨 중요: 실제 프로덕션에서는 요청 IP가 토스페이먼츠 공식 IP 대역에 속하는지,
    // 또는 헤더의 시그니처를 검증하는 로직을 반드시 추가해야 합니다.

    const body = await req.json();

    if (body.eventType === 'PAYMENT_STATUS_CHANGED' && body.data.status === 'DONE') {
      // 결제 성공 시 DB 업데이트 (예: 구독 만료일 연장)
    }

    // 토스페이먼츠 서버에 정상 수신을 알리기 위해 200 OK 응답을 즉시 반환해야 합니다.
    return NextResponse.json({ received: true });
  }
  ```

---

## 3️⃣ Supabase: 데이터베이스 관리

사용자 정보, 구독 상태, API 사용량 등을 저장하는 메인 데이터베이스 역할을 합니다.

### ⚙️ 연동 수단 및 기능

- **SDK (`@supabase/supabase-js`)**:
  - 서버(API Route, 서버 컴포넌트)에서 데이터 CRUD 작업 수행
  - Row Level Security(RLS)와 연동하여 데이터 접근 제어

### 📥 설치 및 설정

1.  **SDK 설치**:

    ```bash
    npm install @supabase/supabase-js
    ```

2.  **테이블 스키마 생성**: Supabase 프로젝트의 SQL Editor에서 테이블을 생성합니다.

    ```sql
    -- users 테이블: Clerk 사용자와 1:1 매칭
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_user_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      subscription_tier TEXT DEFAULT 'free',
      billing_key TEXT, -- 토스페이먼츠 빌링키
      customer_key TEXT, -- 토스페이먼츠 고객키
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Row Level Security 활성화
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;

    -- 정책: 사용자는 자신의 정보만 조회/수정 가능 (Clerk JWT 연동 필요)
    -- 🚨 아래 정책은 Supabase에 Clerk을 외부 JWT 제공자로 등록한 후 유효합니다.
    CREATE POLICY "Users can manage their own data"
      ON users FOR ALL
      USING ( (select auth.jwt() ->> 'sub') = clerk_user_id );
    ```

### 🔑 인증 정보 관리

1.  [Supabase Dashboard](https://supabase.com)에서 프로젝트 생성 후 **Settings > API**로 이동합니다.
2.  `Project URL`, `anon public key`, `service_role secret key`를 복사합니다.
3.  `.env.local` 파일에 저장합니다. `service_role` 키는 서버 측에서만 사용해야 합니다.

    ```bash
    # .env.local
    # Supabase Keys
    NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
    SUPABASE_SERVICE_ROLE_KEY=... # 서버 전용 키
    ```

### 📞 호출 및 구현 방법

- **서버 전용 클라이언트 생성**: `service_role` 키를 사용하여 모든 RLS 정책을 우회할 수 있는 관리자용 클라이언트를 생성합니다. (주로 Webhook 핸들러나 내부 API에서 사용)

  ```typescript
  // lib/supabase/server.ts
  import { createClient } from '@supabase/supabase-js';

  export function createServerClient() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  ```

- **데이터 조회 및 수정**: 서버 클라이언트를 사용하여 데이터를 처리합니다.

  ```typescript
  // 예시: Clerk Webhook 핸들러 내부
  import { createServerClient } from '@/lib/supabase/server';

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('users')
    .update({ subscription_tier: 'pro', billing_key: '...' })
    .eq('clerk_user_id', 'user_...')
    .select();
  ```

---

## 4️⃣ Gemini API: AI 기능 연동

사용자의 구독 등급에 따라 다른 성능의 AI 모델을 호출하여 기능을 제공합니다.

### ⚙️ 연동 수단 및 기능

- **SDK (`@google/genai`)**:
  - 텍스트 생성을 위해 Gemini 모델 호출

### 📥 설치 및 설정

1.  **SDK 설치**:
    ```bash
    npm install @google/genai
    ```

### 🔑 인증 정보 관리

1.  [Google AI Studio](https://aistudio.google.com)에서 **Get API Key**를 클릭하여 키를 발급받습니다.
2.  `.env.local` 파일에 저장합니다.

    ```bash
    # .env.local
    # Gemini API Key
    GEMINI_API_KEY=AIzaSy...
    ```

### 📞 호출 및 구현 방법

- **API 호출**: 서버 측에서 SDK를 초기화하고, 사용자의 구독 등급(`tier`)에 따라 다른 모델을 호출하는 함수를 구현합니다.

  ```typescript
  // lib/gemini.ts
  import { GoogleGenerativeAI } from '@google/generative-ai';

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  export async function analyzeText(prompt: string, tier: 'free' | 'pro') {
    // 구독 등급에 따라 모델 분기
    const modelName = tier === 'pro' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API call failed:', error);
      throw new Error('AI 분석에 실패했습니다.');
    }
  }
  ```

- **API Route에서 사용**: 프론트엔드의 요청을 받아 `analyzeText` 함수를 호출하고, Supabase에서 API 사용량을 차감하는 로직을 추가합니다.

  ```typescript
  // app/api/analyze/route.ts
  import { analyzeText } from '@/lib/gemini';

  export async function POST(req: Request) {
    // 1. Clerk을 통해 사용자 인증 및 정보 조회
    // 2. Supabase에서 사용자 구독 등급(tier) 및 API 잔여 횟수 확인
    // 3. 잔여 횟수가 없으면 에러 반환
    // 4. analyzeText(prompt, tier) 호출하여 결과 받기
    // 5. Supabase의 API 사용 횟수 1 차감
    // 6. 결과를 클라이언트에 반환
  }
  ```
