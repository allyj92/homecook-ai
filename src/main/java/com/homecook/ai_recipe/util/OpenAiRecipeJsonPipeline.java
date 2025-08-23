package com.homecook.ai_recipe.util;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.models.responses.Response;
import com.openai.models.responses.ResponseCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class OpenAiRecipeJsonPipeline implements RecipeJsonPipeline {

    private final OpenAIClient openAIClient;

    @Value("${openai.model:gpt-4.1-mini}")
    private String model;

    public OpenAiRecipeJsonPipeline(OpenAIClient openAIClient) {
        this.openAIClient = openAIClient;
    }

    @Override
    public String generate(String system, String user) {
        try {
            var params = ResponseCreateParams.builder()
                    .model(model)
                    .instructions(system) // system이 null이면 SDK가 무시
                    .input(user)
                    .temperature(0.2)
                    .maxOutputTokens(1024)
                    .build();

            Response resp = openAIClient.responses().create(params);

            // 1) 공식/비공식 outputText 헬퍼
            try {
                var m = resp.getClass().getMethod("getOutputText");
                Object v = m.invoke(resp);
                if (v != null && !v.toString().isBlank()) return v.toString();
            } catch (Throwable ignore) {
                try {
                    var m2 = resp.getClass().getMethod("outputText");
                    Object v2 = m2.invoke(resp);
                    if (v2 != null && !v2.toString().isBlank()) return v2.toString();
                } catch (Throwable ignore2) {}
            }

            // 2) outputs -> content[].text.value 수집
            String collected = collectTextFromResponse(resp);
            if (collected != null && !collected.isBlank()) return collected;

            // 3) 최후 수단
            String flat = String.valueOf(resp);
            if (flat != null && !flat.isBlank()) return flat;

            throw new IllegalStateException("OpenAI response has no text content");
        } catch (Exception e) {
            // 파이프라인 레벨 폴백 (Service쪽에서 또 한 번 파싱 폴백 있음)
            return """
            {
              "title":"간단 단백질 샐러드",
              "summary":"파이프라인 오류: %s",
              "kcal":420,"carbs_g":35,"protein_g":35,"fat_g":12,"sodium_mg":600,"cook_time_min":15,
              "ingredients_list":["닭가슴살 150 g","양상추 한 줌","방울토마토 6개","올리브유 1작은술","발사믹 1작은술"],
              "steps":["재료 손질","단백질 조리","드레싱 버무리기"],
              "tips":"입맛에 맞게 간 조절\\n드레싱은 가볍게"
            }
            """.formatted(e.getMessage() == null ? "unknown" : e.getMessage());
        }
    }

    private static String collectTextFromResponse(Object resp) {
        try {
            var mOut = resp.getClass().getMethod("getOutput");
            Object outputs = mOut.invoke(resp);
            if (!(outputs instanceof java.util.List<?> list) || list.isEmpty()) return null;

            StringBuilder buf = new StringBuilder();
            for (Object item : list) {
                Object contents = null;
                try {
                    var mCnt = item.getClass().getMethod("getContent");
                    contents = mCnt.invoke(item);
                } catch (Throwable ignore) {
                    try {
                        var mCnt2 = item.getClass().getMethod("content");
                        contents = mCnt2.invoke(item);
                    } catch (Throwable ignore2) {}
                }
                if (!(contents instanceof java.util.List<?> clist) || clist.isEmpty()) continue;

                for (Object c : clist) {
                    Object textObj = null;
                    try {
                        var mt = c.getClass().getMethod("getText");
                        textObj = mt.invoke(c);
                    } catch (Throwable ignore) {
                        try {
                            var mt2 = c.getClass().getMethod("text");
                            textObj = mt2.invoke(c);
                        } catch (Throwable ignore2) {}
                    }
                    if (textObj == null) continue;

                    String value = null;
                    for (String m : new String[]{"getValue", "value", "toString"}) {
                        try {
                            var mm = textObj.getClass().getMethod(m);
                            Object v = mm.invoke(textObj);
                            if (v != null) { value = v.toString(); break; }
                        } catch (Throwable ignore) {}
                    }
                    if (value != null && !value.isBlank()) {
                        if (buf.length() > 0) buf.append('\n');
                        buf.append(value);
                    }
                }
            }
            String s = buf.toString().trim();
            return s.isEmpty() ? null : s;
        } catch (Throwable t) {
            return null;
        }
    }
}