package com.homecook.ai_recipe.service;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AiDebugSnapshot {
    String model;
    String phase;            // e.g. "before-parse", "after-extract", "parse-fail"
    String raw;              // Response.toString() 등 원본(최대 4kb로 잘라둠)
    String outputText;       // outputText()/getOutputText()가 있으면 그 값
    String extractedJson;    // 우리가 골라낸 JSON { ... }
    String sanitizedJson;    // sanitize 적용 후 문자열
    String error;            // 예외 메시지
    Long   elapsedMs;        // 호출~파싱까지 대략 시간
}