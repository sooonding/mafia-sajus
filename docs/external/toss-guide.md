## 📘 토스페이먼츠 구독결제(빌링키) 연동 최종 가이드

이 문서는 토스페이먼츠의 구독결제(빌링키) 기능을 연동하는 데 필요한 SDK, API, Webhook의 역할과 사용법을 종합적으로 안내합니다. 최신 LTS 버전을 기준으로 유효성이 검증된 내용을 바탕으로 작성되었습니다.

구독결제 연동은 크게 세 가지 핵심 요소로 구성됩니다.

1.  **SDK (클라이언트)**: 사용자가 카드 정보를 입력하고, 결제 수단을 인증하기 위한 결제창을 생성합니다.
2.  **API (서버)**: SDK를 통해 얻은 인증 정보로 실제 빌링키를 발급받고, 이 빌링키를 이용해 정기적인 결제를 실행합니다.
3.  **Webhook (서버)**: 결제 성공, 실패, 취소 등 결제 상태 변경을 실시간으로 통보받아 후속 처리를 합니다.

---

### 1️⃣ SDK 연동 (클라이언트)

클라이언트(웹 브라우저) 환경에서 사용자의 카드 정보를 안전하게 인증하고, 빌링키 발급의 첫 단계인 `authKey`를 얻기 위해 사용됩니다.

#### 🎯 사용할 기능

- **결제창 생성**: 사용자가 카드 정보를 입력할 UI를 렌더링합니다.
- **카드 정보 인증 요청**: 사용자가 입력한 정보를 토스페이먼츠 서버로 보내 인증을 요청하고, 성공 시 `authKey`를 발급받습니다.

#### 📦 설치 및 세팅 방법

**1. 설치**
두 가지 방법 중 하나를 선택하여 SDK를 설치합니다.

- **Script 태그 방식 (권장)**: HTML 파일에 아래 스크립트 태그를 추가합니다.
  ```html
  <script src="https://js.tosspayments.com/v2/standard"></script>
  ```
- **NPM 방식**: 프로젝트에 패키지를 설치합니다.
  ```bash
  npm install @tosspayments/tosspayments-sdk
  ```

**2. 세팅 (초기화)**
`loadTossPayments` 함수에 **클라이언트 키**를 전달하여 SDK를 초기화하고 결제 객체를 생성합니다. `customerKey`는 각 사용자를 식별하는 고유한 값으로, UUID와 같은 임의의 문자열 사용이 권장됩니다.

```javascript
// NPM 방식 예시
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';

const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY; // 환경 변수에서 클라이언트 키 로드
let tossPayments;
let payment;

async function initialize() {
  tossPayments = await loadTossPayments(clientKey);
  payment = tossPayments.payment({
    customerKey: generateCustomerKey(), // 사용자별 고유 UUID 생성
  });
}
initialize();
```

#### 🔑 인증정보 관리

- **클라이언트 키 (Client Key)**: `test_ck_...` 또는 `live_ck_...` 형태의 키를 사용합니다. 이 키는 브라우저 환경에 노출되어도 안전하며, SDK 초기화에 사용됩니다.

#### 📞 호출 방법

사용자가 '구독하기' 버튼을 클릭했을 때 `requestBillingAuth` 함수를 호출하여 카드 정보 입력을 요청합니다.

```javascript
async function handleSubscribe() {
  try {
    await payment.requestBillingAuth({
      method: '카드',
      // 인증 성공/실패 시 이동할 서버의 URL
      successUrl: `${window.location.origin}/api/billing/success`,
      failUrl: `${window.location.origin}/api/billing/fail`,
      customerEmail: 'user@example.com', // 사용자 이메일
      customerName: '홍길동', // 사용자 이름
    });
  } catch (error) {
    console.error('빌링키 인증 요청 실패:', error);
    alert('카드 정보 인증에 실패했습니다.');
  }
}
```

---

### 2️⃣ API 연동 (서버)

서버 환경에서 빌링키를 최종적으로 발급, 관리하고 자동 결제를 실행하는 핵심적인 역할을 담당합니다.

#### 🎯 사용할 기능

- **빌링키 발급**: 클라이언트에서 전달받은 `authKey`를 사용하여 영구적인 `billingKey`를 발급받습니다.
- **자동결제 승인**: 저장된 `billingKey`를 이용해 추가 인증 없이 금액을 결제합니다.

#### 📦 설치 및 세팅 방법

- **설치**: 별도의 라이브러리 설치는 필요하지 않습니다. `fetch` API나 `axios` 같은 HTTP 클라이언트를 사용합니다.
- **세팅 (Base URL)**: 모든 API 요청은 아래의 Base URL로 전송합니다.
  - **테스트/라이브**: `https://api.tosspayments.com`

#### 🔑 인증정보 관리

- **시크릿 키 (Secret Key)**: `test_sk_...` 또는 `live_sk_...` 형태의 키를 사용합니다.
- **인증 방식 (Basic Auth)**: 모든 API 요청의 `Authorization` 헤더에 시크릿 키를 Base64로 인코딩한 값을 포함해야 합니다. **시크릿 키는 절대 외부에 노출되어서는 안 됩니다.**

````javascript
// Basic Auth 헤더 생성 방법
const secretKey = process.env.TOSS_SECRET_KEY; // 환경 변수에서 시크릿 키 로드
const basicToken = Buffer.from(`${secretKey}:`).toString('base64');
const authHeader = `Basic ${basicToken}`;

const headers = {
  'Authorization': authHeader,
  'Content-Type': 'application/json',
};```

#### 📞 호출 방법

**1. 빌링키 발급 (`POST /v1/billing/authorizations/issue`)**
`successUrl`로 전달된 `authKey`와 `customerKey`를 사용하여 빌링키를 발급받고, DB에 저장합니다.

```javascript
async function issueBillingKey(authKey, customerKey) {
  const response = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
    method: 'POST',
    headers: headers, // 위에서 생성한 인증 헤더
    body: JSON.stringify({
      authKey,
      customerKey,
    }),
  });
  const data = await response.json();
  // 성공 시 data.billingKey, data.card 등을 DB에 저장
  return data;
}
````

**2. 자동결제 승인 (`POST /v1/billing/{billingKey}`)**
저장된 빌링키로 정기결제를 실행합니다. `orderId`는 매 결제마다 고유한 값이어야 합니다.

```javascript
async function chargeSubscription(billingKey, customerKey, amount, orderId, orderName) {
  const response = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      customerKey,
      amount,
      orderId, // 매번 고유한 값으로 생성
      orderName,
    }),
  });
  const data = await response.json();
  // 성공 시 data.paymentKey, data.status 등을 DB에 저장
  return data;
}
```

---

### 3️⃣ Webhook 연동 (서버)

결제 상태가 비동기적으로 변경되었을 때 토스페이먼츠 서버가 우리 서버로 알려주는 기능입니다. 이를 통해 결제 성공, 실패 등의 상태를 안정적으로 처리할 수 있습니다.

#### 🎯 사용할 기능

- **결제 상태 변경 이벤트 수신**: `PAYMENT_STATUS_CHANGED` 이벤트를 받아 결제 상태(`DONE`, `ABORTED`, `CANCELED` 등)를 처리합니다.

#### 📦 설치 및 세팅 방법

**1. 설치 (엔드포인트 구현)**
외부에서 접근 가능한 `POST` 방식의 API 엔드포인트를 하나 생성합니다. (예: `https://yourdomain.com/api/webhook/tosspayments`)

**2. 세팅 (개발자센터 등록)**

- 토스페이먼츠 개발자센터에 로그인 후, `내 상점 > 웹훅` 메뉴로 이동합니다.
- 구현한 엔드포인트 URL을 '웹훅 URL'에 등록합니다.
- 수신할 이벤트로 `PAYMENT_STATUS_CHANGED`를 선택하고 저장합니다.

#### 🔑 인증정보 관리 (웹훅 검증)

웹훅 요청의 위변조를 방지하기 위해, 수신한 정보가 실제로 토스페이먼츠에서 보낸 것인지 검증해야 합니다. 요청 본문에 포함된 `data.paymentKey`를 사용해 내 DB에 저장된 결제 정보를 조회하고 일치 여부를 확인하는 방식을 권장합니다.

#### 📞 호출 방법 (수신 및 처리)

웹훅은 우리가 직접 호출하는 것이 아니라 토스페이먼츠 서버로부터 **호출받는** 방식입니다. 우리는 해당 요청을 받아 처리하는 핸들러 로직만 구현하면 됩니다.

**중요**: 웹훅 수신 후 **10초 이내에 `HTTP 200 OK`로 응답**해야 합니다. 그렇지 않으면 토스페이먼츠는 전송 실패로 간주하고 여러 번 재전송을 시도합니다.

```javascript
// app/api/webhook/tosspayments/route.ts 예시
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const webhookData = await request.json();

    // 1. paymentKey를 이용해 DB에서 결제 정보 조회 (검증 과정)
    const payment = await getPaymentFromDB(webhookData.data.paymentKey);
    if (!payment) {
      // 유효하지 않은 웹훅으로 간주하고 400 에러 응답
      return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 });
    }

    // 2. 이벤트 타입에 따라 상태 처리
    if (webhookData.eventType === 'PAYMENT_STATUS_CHANGED') {
      const newStatus = webhookData.data.status;
      // DB의 결제 상태를 newStatus로 업데이트하는 로직
      await updatePaymentStatus(webhookData.data.paymentKey, newStatus);
    }

    // 3. 정상 처리 후 200 OK 응답
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook 처리 실패:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```
