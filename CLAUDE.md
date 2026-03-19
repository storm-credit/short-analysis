# Shorts Pulse — Project Rules

## Overview
YouTube Shorts 바이럴 분석 대시보드. Next.js 15 + TypeScript + Tailwind CSS v4 (App Router, `use client`).
모든 소스는 `shorts-pulse/` 하위에 있음.

## Architecture
- `src/app/page.tsx` — 메인 페이지 (single page app)
- `src/components/` — UI 컴포넌트 (Dashboard, Hero, Charts, Settings 등)
- `src/lib/api.ts` — YouTube Data API v3 호출, 키 로테이션, 스팸 필터
- `src/lib/scoring.ts` — 바이럴리티 점수 알고리즘 (softCap, median 정규화)
- `src/lib/insights.ts` — TF-IDF 키워드 엔진
- `src/lib/constants.ts` — 지역(RPM), 토픽 카테고리 설정
- `src/lib/utils.ts` — 유틸리티 (숫자 포맷, 시간 계산)
- `src/types/index.ts` — 타입 정의

## Tech Stack
- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS v4 (`@import "tailwindcss"` 방식)
- Chart.js + react-chartjs-2
- YouTube Data API v3 (다중 키 로테이션)

## Rules
- 한국어 주석/UI 유지
- `.env` 파일 수정 금지 — API 키는 브라우저 localStorage로 관리
- Shorts RPM 기준 사용 (일반 CPM 아님): $0.02~$0.09
- `relevanceLanguage` 파라미터로 언어 필터링
- 스팸/프로모 콘텐츠 필터 (official, MV, trailer, VEVO 등)
- 토픽 기반 카테고리 사용 (YouTube categoryId 대신 검색쿼리 매핑)

## Dev Commands
```bash
cd shorts-pulse && npm run dev -- -p 8002   # 개발 서버
cd shorts-pulse && npm run build             # 빌드 확인
```

## Common Issues
- HMR 캐시 문제 시: `.next/` 삭제 후 서버 재시작
- API 키는 브라우저별 localStorage에 저장됨 (브라우저 간 공유 안됨)
- `relevanceLanguage`는 soft preference — 완벽한 필터가 아님
