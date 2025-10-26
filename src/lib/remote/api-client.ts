import axios, { isAxiosError } from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  headers: {
    "Content-Type": "application/json",
  },
});

// Clerk 세션 토큰을 Authorization 헤더에 추가하는 인터셉터
apiClient.interceptors.request.use(
  async (config) => {
    // Clerk 세션 토큰 가져오기 (클라이언트 사이드에서만)
    if (typeof window !== "undefined") {
      try {
        // Clerk 인스턴스에서 세션 토큰 가져오기
        const clerk = (window as any).__clerk;
        if (clerk?.session) {
          const token = await clerk.session.getToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
      } catch (error) {
        console.warn("Failed to get Clerk token", error);
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

type ErrorPayload = {
  error?: {
    message?: string;
  };
  message?: string;
};

export const extractApiErrorMessage = (
  error: unknown,
  fallbackMessage = "API request failed."
) => {
  if (isAxiosError(error)) {
    const payload = error.response?.data as ErrorPayload | undefined;

    if (typeof payload?.error?.message === "string") {
      return payload.error.message;
    }

    if (typeof payload?.message === "string") {
      return payload.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};

export { apiClient, isAxiosError };
