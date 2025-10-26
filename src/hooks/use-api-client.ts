"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo } from "react";
import axios from "axios";

/**
 * Clerk 인증 토큰이 자동으로 포함되는 API 클라이언트를 반환하는 훅
 *
 * @example
 * ```tsx
 * const apiClient = useApiClient();
 * const { data } = await apiClient.get('/api/dashboard/me');
 * ```
 */
export function useApiClient() {
  const { getToken } = useAuth();

  const apiClient = useMemo(() => {
    const client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // 요청 인터셉터: 모든 요청에 Clerk 토큰 추가
    client.interceptors.request.use(
      async (config) => {
        try {
          const token = await getToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error("Failed to get Clerk token:", error);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    return client;
  }, [getToken]);

  return apiClient;
}
