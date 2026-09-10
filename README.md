# UM! Runner

Vite, TypeScript, HTML Canvas, Web Audio API만으로 만든 횡스크롤 러너 게임입니다. 게임 입력 계층과 음성 판정 계층을 분리해 이후 음성 알고리즘을 교체할 수 있도록 구성했습니다.

## 실행

Node.js 18 이상을 권장합니다.

```bash
npm install
npm run dev
```

프로덕션 빌드는 `npm run build`, 빌드 미리보기는 `npm run preview`로 실행합니다. 마이크 API는 보안 컨텍스트에서만 동작하므로 개발 중에는 `localhost`, 배포 시에는 HTTPS를 사용해야 합니다.

## 조작법

| 행동 | 키보드 | 음성 |
|---|---|---|
| 슬라이딩 | ArrowDown | “엄” |
| 짧은 점프 | Space | “예?” |
| 긴 점프 | ArrowUp | “줴줴이야” |

게임 오버 후 `R` 또는 Canvas 클릭으로 다시 시작합니다. 오른쪽 디버그 패널의 테스트 버튼으로도 세 행동을 실행할 수 있습니다.

## 마이크와 기준 음성

마이크 권한은 자동 요청하지 않습니다. 사용자가 **Enable microphone** 버튼을 누른 경우에만 `getUserMedia({ audio: true })`를 호출합니다. 권한을 거부하면 키보드와 테스트 버튼으로 계속 플레이할 수 있습니다.

앱 시작 시 다음 기준 파일을 불러옵니다.

- `public/audio/um.m4a`
- `public/audio/ye.m4a`
- `public/audio/jwejweiya.m4a`

브라우저/운영체제가 M4A 디코딩을 지원해야 합니다. 실패한 경우 디버그 패널에 오류가 표시됩니다.

## 현재 음성 판정 알고리즘

`AudioManager`가 AnalyserNode의 실시간 PCM 데이터를 읽고 RMS 임계값 기반 VAD로 0.15~2초 길이의 발화를 자릅니다. `AudioFeatureExtractor`는 발화와 기준 음성 양쪽에서 duration, RMS, zero-crossing rate, autocorrelation 기반 pitch contour, 평균/최소/최대 pitch를 계산합니다.

`VoiceCommandDetector`는 발화 길이, 평균 pitch, pitch range, 정규화한 pitch contour 형태의 유사도를 각각 0~1로 만들고 가중 합산합니다. 최고 점수가 기본 threshold 0.75 이상일 때만 명령을 발행합니다. 음성 결과는 반드시 `VoiceCommandDetector → InputManager → Game → Player`를 거칩니다. DebugPanel에서 threshold를 실시간 조절할 수 있습니다.

## 현재 한계와 개선 방향

- RMS VAD는 주변 소음과 마이크 입력 레벨에 민감하며 현재 임계값은 고정값입니다.
- 단순 autocorrelation pitch는 무성음, 잡음, 배음에 취약합니다.
- 비교 대상이 기준 샘플 하나씩이어서 화자·속도·억양 변화에 대한 일반화가 제한적입니다.
- 프레임 기반 pitch contour에는 DTW가 아닌 선형 리샘플링을 사용합니다.
- 다음 단계에서는 환경 소음 캘리브레이션, 기준 샘플 다중화, YIN 계열 pitch 검출, DTW contour 정렬, MFCC와 스펙트럼 특징 추가, 워커 기반 분석을 우선 고려할 수 있습니다.
