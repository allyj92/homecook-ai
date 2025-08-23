// src/api/index.js
import axios from 'axios';

// 배포 환경에서 VITE_API_BASE를 쓰고 싶다면 세팅(없으면 같은 오리진 사용)
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

const ax = axios.create({
  baseURL: API_BASE || undefined, // ''면 같은 오리진
  withCredentials: true,          // 세션 쿠키 포함(필요 없으면 false로)
  timeout: 90_000,
});

async function tryPost(paths, payload) {
  let lastErr;
  for (const p of paths) {
    try {
      const { data } = await ax.post(p, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      return data; // 첫 성공 반환
    } catch (e) {
      lastErr = e;
      // 다음 후보로 계속 시도
    }
  }
  throw lastErr || new Error('No endpoint matched');
}

/** 1건 추천 */
export async function requestRecommend(payload) {
  // 백엔드 경로가 프로젝트마다 달라질 수 있어 후보를 순차 시도
  const candidates = [
    '/api/recipes/recommend',  // 스프링에서 이렇게 만든 경우
    '/api/recommend',          // 단순 경로
  ];
  return tryPost(candidates, payload);
}

/** TOP N 추천(카드 리스트) */
export async function requestRecommendTop(payload, n = 3) {
  const body = { ...payload, n };
  const candidates = [
    '/api/recipes/recommend/top',
    '/api/recommend/top',
  ];
  return tryPost(candidates, body);
}
