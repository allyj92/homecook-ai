// src/main/java/com/homecook/ai_recipe/service/RecipeAiService.java
package com.homecook.ai_recipe.service;

import com.fasterxml.jackson.core.json.JsonReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.homecook.ai_recipe.dto.RecommendRequest;
import com.homecook.ai_recipe.dto.RecommendResponse;
import com.homecook.ai_recipe.util.RecipeJsonPipeline;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.zip.CRC32;

@Service
@RequiredArgsConstructor
public class RecipeAiService {

    /* ---------------- DI ---------------- */
    private final RecipeJsonPipeline recipeJsonPipeline;

    /* ---------------- 디버그 스냅샷 버퍼 ---------------- */
    private final Deque<AiDebugSnapshot> debugBuffer = new ConcurrentLinkedDeque<>();
    private void pushDebug(AiDebugSnapshot s) {
        debugBuffer.addFirst(s);
        while (debugBuffer.size() > 10) debugBuffer.removeLast();
    }
    public AiDebugSnapshot latestDebug() { return debugBuffer.peekFirst(); }
    public List<AiDebugSnapshot> allDebug() { return new ArrayList<>(debugBuffer); }
    private static String clip(String s, int max) {
        if (s == null) return null;
        if (s.length() <= max) return s;
        return s.substring(0, max) + "...(+" + (s.length() - max) + ")";
    }

    /* ---------------- BMI ---------------- */
    private static class BmiInfo {
        final Double bmi; final String category;
        BmiInfo(Double bmi, String category) { this.bmi = bmi; this.category = category; }
    }
    private static BmiInfo bmiFor(Double heightCm, Double weightKg) {
        if (heightCm == null || weightKg == null || heightCm <= 0 || weightKg <= 0) {
            return new BmiInfo(null, "unknown");
        }
        double h = heightCm / 100.0;
        double bmi = weightKg / (h * h);
        String cat = (bmi < 18.5) ? "underweight"
                : (bmi < 23.0) ? "normal"
                : (bmi < 25.0) ? "overweight"
                : "obese";
        return new BmiInfo(Math.round(bmi * 10.0) / 10.0, cat);
    }

    /* ---------------- Mapper (관대한 파서) ---------------- */
    private final ObjectMapper permissive = JsonMapper.builder()
            .enable(JsonReadFeature.ALLOW_UNQUOTED_FIELD_NAMES)
            .enable(JsonReadFeature.ALLOW_SINGLE_QUOTES)
            .enable(JsonReadFeature.ALLOW_TRAILING_COMMA)
            .build();

    /* ---------------- Public API ---------------- */
    public RecommendResponse generate(RecommendRequest req, List<Long> excludeIds) {
        final String sys = """
                You are not just a culinary assistant — you are a creative Korean home-cooking chef. \s
                Your role is to invent new but realistic recipes that feel original yet practical for home kitchens. \s
                Act like a chef who balances Korean tradition with creativity.
                
                Return ONLY valid, compact JSON (no markdown, no comments). \s
                JSON keys (exactly these): \s
                  title, summary, kcal, carbs_g, protein_g, fat_g, sodium_mg, cook_time_min, ingredients_list, steps, tips
                
                Title policy:
                - Do NOT list all ingredients in the title.
                - Pick 1–2 main ingredients and generate a natural Korean dish name.
                - Reflect cooking style / taste / atmosphere in the title (e.g. ~볶음, ~구이, ~샐러드, ~조림, ~스튜, ~탕, ~무침).
                - Keep it concise, like a real Korean menu item (창의적이고 간결한 이름).
                - If only one ingredient is provided, creatively add complementary sub-ingredients to make a fuller dish name.
                
                Examples:
                - Input: “닭가슴살, 양파” → Title: “닭가슴살 양파 간장볶음”, “참깨향 닭가슴살 양파볶음”
                - Input: “두부” → Title: “두부 채소 된장국”, “들깨향 두부버섯 찌개”
                - Input: “연어, 시금치” → Title: “연어 시금치 크림구이”, “고소한 연어 시금치덮밥”
                - Input: “버섯” → Title: “표고버섯 채소조림”, “들기름 향 버섯볶음”
                
                Health/taste policy (Korean home cooking):
                - 한국 가정식 기준의 감칠맛과 균형(마늘/대파/참기름/간장/고추장/고춧가루)을 지키되, 과도한 소금/당/포화지방 억제.
                - 저염 우선: 저염 간장·표고/다시마 육수, 들깨·참기름 향으로 간 보완.
                - 단맛: 채소의 자연 단맛 활용(양파·대파 볶기), 필요 시 대체당(알룰로스/스테비아) 소량.
                - 기름: 올리브유/카놀라/아보카도유 등 불포화지방 위주로 최소 사용.
                - 사용자가 주는 모든 재료를 반드시 다 사용할 필요는 없음. \s
                  → 메인 재료 1~2개를 제목에 반영하고, 나머지는 서브 재료로 조화롭게 활용.
                
                Goal-specific targets (apply additively with BMI policy):
                - diet: kcal 250–500, fat_g↓, sodium_mg 300–700
                - low_sodium: sodium_mg 200–500
                - low_sugar: 정제당 최소, carbs_g↓, 대체당 허용
                - highProtein: protein_g 30–45
                - bulk: kcal 600–900
                - vegan: 동물성·액젓·멸치육수 금지
                - glutenFree: 밀가루·밀기반 간장 금지
                - quick: cook_time_min ≤ 20
                
                BMI policy (Asia-Pacific):
                - underweight: kcal/protein_g 상향
                - normal: 기본 범위 유지
                - overweight/obese: kcal·fat_g·sodium_mg 하향, 채소·단백질 비중↑
                
                Ingredients list (6–12 items): "재료명 수량 단위" (선택 재료는 "(선택)")
                Steps (6–10): 한국어 1–2문장/단계, 조리기구/불세기/시간/상태체크 포함.
                Tips (2–3): 줄바꿈(\\n)으로 구분한 단일 문자열.
                Return only the JSON object above.
                """;

        final String goals = String.join(", ",
                Optional.ofNullable(req).map(RecommendRequest::goalsNormalized).orElseGet(List::of));
        BmiInfo bmi = bmiFor(req != null ? req.getHeightCm() : null,
                req != null ? req.getWeightKg() : null);

        String diversityNonce = UUID.randomUUID().toString();

        long timeSeed = System.nanoTime();
        int rndSeed = new Random().nextInt(1_000_000);

        String excludeLine = (excludeIds != null && !excludeIds.isEmpty())
                ? excludeIds.toString()
                : "-";

        final String userBase = """
사용자 정보:
- 키: %s cm, 몸무게: %s kg
- BMI: %s (%s, Asia-Pacific)
- 목표: %s
- 사용하고 싶은 재료: %s

컨텍스트:
- 제외해야 할 레시피 ID 목록: %s
- diversity_nonce: %s
- random_hint: time=%d, rnd=%d

요청:
- 위 ‘Goal-specific targets’와 ‘BMI policy’를 동시에 반영해 kcal/protein_g/fat_g/sodium_mg/cook_time_min 산정.
- steps는 6–10개로 상세히(기구/불세기/시간/상태체크 포함).
- 저염·저당·건강한 기름 활용, 대체재 제안.
- 반드시 순수 JSON 객체만 반환(코드펜스/설명 금지).
""".formatted(
                safe(req != null ? req.getHeightCm() : null),
                safe(req != null ? req.getWeightKg() : null),
                (bmi.bmi == null ? "-" : String.valueOf(bmi.bmi)),
                bmi.category,
                (goals.isBlank() ? "-" : goals),
                nullToDash(req != null ? req.getIngredients() : null),
                excludeLine,
                diversityNonce,
                timeSeed,
                rndSeed
        );
        RecommendResponse lastParsed = null;

        // 최대 4회 시도: 중복 ID면 논스 갱신 후 재시도
        for (int attempt = 0; attempt < 4; attempt++) {
            String user = userBase;
            if (attempt > 0) {
                String newNonce = UUID.randomUUID().toString();
                long newTimeSeed = System.nanoTime();
                int newRndSeed = new Random().nextInt(1_000_000);

                user = user
                        .replaceFirst("diversity_nonce: .*", "diversity_nonce: " + newNonce)
                        .replaceFirst("random_hint: time=.*", "random_hint: time=" + newTimeSeed + ", rnd=" + newRndSeed)
                        + "\n재생성 지시: 이전 추천과 겹치지 않게 단백질/소스/채소/조리법을 바꿔 구성하세요.";
            }

            String rawOut = null;     // 파이프라인 원문
            String jsonBlock = null;  // 추출된 JSON
            String fixed = null;      // sanitize 결과
            try {
                rawOut = callPipelineGenerate(recipeJsonPipeline, sys, user);
                debugDump("OUTPUT_TEXT", rawOut);

                jsonBlock = extractFirstJsonObject(rawOut);
                debugDump("jsonBlock(extractFirstJsonObject)", jsonBlock);

                String normalized = deescapeIfNeeded(jsonBlock);
                debugDump("AFTER deescapeIfNeeded", normalized);

                fixed = sanitizeToJson(normalized);
                debugDump("AFTER sanitizeToJson", fixed);

                RecommendResponse parsed = safeParseAndBuildCore(
                        fixed,
                        Optional.ofNullable(req).map(RecommendRequest::goalsNormalized).orElseGet(List::of)
                );
                lastParsed = parsed;

                if (parsed == null) continue;

                // excludeIds에 걸리면 재시도
                if (excludeIds != null && excludeIds.contains(parsed.getId())) {
                    debugDump("DUP_HIT_RETRY", "id=" + parsed.getId() + ", attempt=" + attempt);
                    continue;
                }

                return parsed;

            } catch (Exception e) {
                debugDump("PARSE_FAIL_LAST_INPUT", fixed != null ? fixed : (jsonBlock != null ? jsonBlock : rawOut));
                System.err.println("[AI] PARSE_FAIL -> " + e.getClass().getSimpleName() + " : " + e.getMessage());
                // 다음 시도로 넘어감
            }
        }

        return lastParsed != null ? lastParsed : fallback();
    }

    /* ---------------- 파이프라인 호출 (시그니처 유연 지원) ---------------- */
    private static String callPipelineGenerate(RecipeJsonPipeline pipeline, String sys, String user) {
        if (pipeline == null) throw new IllegalStateException("RecipeJsonPipeline 빈이 주입되지 않았습니다.");
        try {
            try {
                Method m = pipeline.getClass().getMethod("generate", String.class, String.class);
                Object r = m.invoke(pipeline, sys, user);
                return Objects.toString(r, null);
            } catch (NoSuchMethodException ignore) {}

            try {
                Method m = pipeline.getClass().getMethod("generate", String.class);
                // 단일 인자 버전에는 USER만 넣는 게 안전
                Object r = m.invoke(pipeline, user);
                return Objects.toString(r, null);
            } catch (NoSuchMethodException ignore) {}

            throw new IllegalStateException("RecipeJsonPipeline에 호출 가능한 메서드를 찾지 못했습니다. generate(String,String) 혹은 generate(String)을 구현해 주세요.");
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("RecipeJsonPipeline 호출 중 오류: " + e.getClass().getSimpleName() + " - " + e.getMessage(), e);
        }
    }

    /* ---------------- JSON 추출/보정 유틸 ---------------- */

    /** 원문에서 첫 번째(혹은 최적) 레시피 JSON 하나를 뽑아낸다 */
    private static String extractFirstJsonObject(String text) {
        if (text == null) return null;
        final int n = text.length();
        final com.fasterxml.jackson.databind.ObjectMapper M = new com.fasterxml.jackson.databind.ObjectMapper();

        for (int start = 0; start < n; start++) {
            int braceStart = text.indexOf('{', start);
            if (braceStart == -1) break;

            int lookaheadEnd = Math.min(n, braceStart + 300);
            String look = text.substring(braceStart, lookaheadEnd);
            boolean looksLikeJson = look.contains("\"title\"") || look.contains("\":") || look.matches("(?s).*\"[a-zA-Z0-9_]+\"\\s*:\\s*.*");
            boolean looksLikeJavaToString = look.contains("=");
            if (!looksLikeJson || looksLikeJavaToString) {
                start = braceStart + 1;
                continue;
            }

            boolean inString = false;
            boolean escaped = false;
            int depth = 0;
            for (int i = braceStart; i < n; i++) {
                char ch = text.charAt(i);

                if (inString) {
                    if (escaped) {
                        escaped = false;
                    } else if (ch == '\\') {
                        escaped = true;
                    } else if (ch == '"') {
                        inString = false;
                    }
                } else {
                    if (ch == '"') {
                        inString = true;
                    } else if (ch == '{') {
                        depth++;
                    } else if (ch == '}') {
                        depth--;
                        if (depth == 0) {
                            String candidate = text.substring(braceStart, i + 1);
                            candidate = candidate.replaceAll("^```(json)?\\s*", "")
                                    .replaceAll("\\s*```\\s*$", "");
                            try {
                                M.readTree(candidate);
                                return candidate;
                            } catch (Exception ignore) {
                                break;
                            }
                        }
                    }
                }
            }

            start = braceStart;
        }
        return null;
    }

    /** 코드펜스 제거 */
    private static String stripCodeFence(String s) {
        if (s == null) return null;
        String t = s.trim();
        if (t.startsWith("```")) {
            int i = t.indexOf('\n');
            if (i > 0) t = t.substring(i + 1);
            else t = t.substring(3);
            int end = t.lastIndexOf("```");
            if (end >= 0) t = t.substring(0, end);
            return t.trim();
        }
        return s;
    }

    /** 원문에서 균형 잡힌 모든 JSON 객체 리스트 추출 */
    private static List<String> listBalancedJsonObjects(String s) {
        List<String> out = new ArrayList<>();
        if (s == null || s.isBlank()) return out;
        boolean inStr = false, esc = false;
        int depth = 0, start = -1;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (inStr) {
                if (esc) esc = false;
                else if (c == '\\') esc = true;
                else if (c == '"') inStr = false;
            } else {
                if (c == '"') inStr = true;
                else if (c == '{') { if (depth == 0) start = i; depth++; }
                else if (c == '}') {
                    if (depth > 0) depth--;
                    if (depth == 0 && start >= 0) {
                        out.add(s.substring(start, i + 1));
                        start = -1;
                    }
                }
            }
        }
        return out;
    }

    /** 후보들 중 레시피 JSON으로 보이는 것을 점수화해 선택 */
    private static String pickBestRecipeJson(List<String> cands) {
        if (cands == null || cands.isEmpty()) return null;
        String best = null;
        int bestScore = Integer.MIN_VALUE;
        for (String c : cands) {
            int score = 0;
            String low = c.toLowerCase(Locale.ROOT);
            if (low.contains("response{") || low.contains("instructions=") ||
                    low.contains("responseoutputmessage") || low.contains("object_=") ||
                    low.contains("createdat=")) {
                score -= 5;
            }
            if (low.matches("(?s).*([\"\\s{,])title([\\s\"=]*[:=]).*")) score += 2;
            if (low.matches("(?s).*([\"\\s{,])ingredients_list([\\s\"=]*[:=]).*")) score += 2;
            if (low.matches("(?s).*([\"\\s{,])steps([\\s\"=]*[:=]).*")) score += 2;
            if (low.matches("(?s).*([\"\\s{,])kcal([\\s\"=]*[:=]).*")) score += 1;
            score += Math.min(5, c.length() / 400);
            if (score > bestScore) { bestScore = score; best = c; }
        }
        return best;
    }

    private static String sanitizeToJson(String s) {
        if (s == null) return null;
        s = deescapeIfNeeded(s);

        String block = cutToBalancedJson(s);
        if (block == null) block = s;
        String t = block;

        t = t.replaceAll("(?m)(\\{|,|\\s)(\"?[A-Za-z_][A-Za-z0-9_]*\"?)\\s*=\\s*", "$1$2: ");
        t = t.replaceAll("(?m)(\\{|,|\\s)([A-Za-z_][A-Za-z0-9_]*)\\s*:", "$1\"$2\":");
        t = t.replace('\'', '\"');
        t = t.replaceAll(";\\s*", ",");
        t = t.replaceAll(",\\s*([}\\]])", "$1");

        t = hardQuoteLooseValues(t);

        return t.trim();
    }

    private static String deescapeIfNeeded(String s) {
        if (s == null) return null;
        String t = s.trim();

        if (t.startsWith("\"{") && t.endsWith("}\"")) {
            String inner = t.substring(1, t.length() - 1);
            return inner
                    .replace("\\\"", "\"")
                    .replace("\\\\", "\\")
                    .replace("\\n", "\n")
                    .replace("\\t", "\t");
        }
        if (t.startsWith("\\{") || t.startsWith("{\\") || t.startsWith("\\\"{") || t.startsWith("{\\\"")) {
            return t
                    .replace("\\\"", "\"")
                    .replace("\\\\", "\\")
                    .replace("\\n", "\n")
                    .replace("\\t", "\t");
        }
        return s;
    }

    private static String hardQuoteLooseValues(String json) {
        StringBuilder out = new StringBuilder(json.length() + 32);
        boolean inString = false, escape = false;

        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            out.append(c);

            if (inString) {
                if (escape) escape = false;
                else if (c == '\\') escape = true;
                else if (c == '"') inString = false;
                continue;
            } else if (c == '"') {
                inString = true; continue;
            }

            if (c == ':') {
                int j = i + 1;
                while (j < json.length() && Character.isWhitespace(json.charAt(j))) j++;
                if (j >= json.length()) break;

                char v0 = json.charAt(j);
                if (v0 == '"' || v0 == '{' || v0 == '[' || v0 == 't' || v0 == 'f' || v0 == 'n' || v0 == '-' || Character.isDigit(v0)) {
                    continue;
                }

                int k = j;
                boolean localInString = false, localEsc = false;
                int localDepth = 0;
                while (k < json.length()) {
                    char ck = json.charAt(k);
                    if (localInString) {
                        if (localEsc) localEsc = false;
                        else if (ck == '\\') localEsc = true;
                        else if (ck == '"') localInString = false;
                    } else {
                        if (ck == '"') localInString = true;
                        else if (ck == '{' || ck == '[') localDepth++;
                        else if (ck == '}' || ck == ']') {
                            if (localDepth == 0) break;
                            localDepth--;
                        } else if (ck == ',' && localDepth == 0) break;
                    }
                    k++;
                }

                String raw = json.substring(j, k);
                String trimmed = raw.trim();
                if (!(trimmed.startsWith("\"") && trimmed.endsWith("\""))) {
                    String quoted = trimmed
                            .replace("\\", "\\\\")
                            .replace("\"", "\\\"")
                            .replace("\r", "\\r")
                            .replace("\n", "\\n")
                            .replace("\t", "\\t");
                    out.append(' ').append('"').append(quoted).append('"');
                    i = k - 1;
                }
            }
        }
        return out.toString();
    }

    private static String cutToBalancedJson(String s) {
        if (s == null) return null;
        boolean inStr = false, esc = false;
        int depth = 0, start = -1;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (inStr) {
                if (esc) esc = false;
                else if (c == '\\') esc = true;
                else if (c == '"') inStr = false;
                continue;
            } else if (c == '"') {
                inStr = true; continue;
            }
            if (c == '{') { if (depth == 0) start = i; depth++; }
            else if (c == '}') {
                if (depth > 0) depth--;
                if (depth == 0 && start >= 0) return s.substring(start, i + 1);
            }
        }
        return null;
    }

    /* ---------------- JSON -> 값 추출 ---------------- */
    private static String asText(JsonNode n, String k, String def) {
        JsonNode v = n.get(k);
        return (v == null || v.isNull()) ? def : v.asText();
    }
    private static Integer asInt(JsonNode n, String k, int def) {
        JsonNode v = n.get(k);
        if (v == null || v.isNull()) return def;
        if (v.isNumber()) return v.asInt();
        try { return (int) Math.round(Double.parseDouble(v.asText().replaceAll("[^0-9.\\-]", ""))); }
        catch (Exception ignore) { return def; }
    }
    private static List<String> asStringList(JsonNode n, String k, List<String> def) {
        JsonNode v = n.get(k);
        if (v == null || v.isNull() || !v.isArray()) return def;
        List<String> out = new ArrayList<>();
        v.forEach(it -> {
            if (!it.isNull()) {
                String item = it.asText();
                if (item != null) {
                    item = item.trim();
                    if (!item.isEmpty()) out.add(item);
                }
            }
        });
        return out.isEmpty() ? def : out;
    }

    /* ---------------- 기타 ---------------- */
    private static long stableId(String title, List<String> ingredients) {
        var crc = new CRC32();
        String key = Objects.toString(title, "recipe").toLowerCase(Locale.ROOT).trim();
        if (ingredients != null) {
            for (int i = 0; i < Math.min(3, ingredients.size()); i++) {
                String ing = Objects.toString(ingredients.get(i), "")
                        .replaceAll("\\s+", " ")
                        .toLowerCase(Locale.ROOT).trim();
                key += "|" + ing;
            }
        }
        crc.update(key.getBytes(StandardCharsets.UTF_8));
        return crc.getValue();
    }
    private static long stableId(String title) { // 하위호환
        return stableId(title, null);
    }
    private static String nullToDash(String s){ return (s==null||s.isBlank())? "-" : s; }
    private static String safe(Object n){ return n==null? "-" : String.valueOf(n); }

    private static RecommendResponse fallback() {
        return RecommendResponse.builder()
                .id(0L)
                .title("간단 단백질 샐러드")
                .summary("입력값 기반 임시 레시피(파싱 실패 폴백)")
                .kcal(420).carbs_g(35).protein_g(35).fat_g(12).sodium_mg(600).cook_time_min(15)
                .ingredients_list(List.of("닭가슴살 150 g","양상추 한 줌","방울토마토 6개","올리브유 1작은술","발사믹 1작은술"))
                .steps(List.of("재료 손질","단백질 조리","드레싱 버무리기"))
                .tips("목표에 따라 드레싱/소금을 조절하세요.")
                .build();
    }

    /* ---------------- DEBUG DUMP ---------------- */
    private static void debugDump(String label, String s) {
        try {
            System.err.println("----------[DUMP:" + label + "]----------");
            if (s == null) {
                System.err.println("(null)");
                System.err.println("-----------------------------------------");
                return;
            }
            System.err.println("len=" + s.length());
            String pv = s.substring(0, Math.min(300, s.length()))
                    .replace("\n","\\n").replace("\r","\\r").replace("\t","\\t");
            System.err.println("preview=" + pv);

            StringBuilder cp = new StringBuilder();
            StringBuilder hx = new StringBuilder();
            int shown = 0;
            for (int i = 0; i < s.length() && shown < 200; ) {
                int c = s.codePointAt(i);
                cp.append(String.format("U+%04X ", c));
                byte[] bs = new String(Character.toChars(c)).getBytes(StandardCharsets.UTF_8);
                hx.append('[');
                for (int j = 0; j < bs.length; j++) {
                    if (j>0) hx.append(' ');
                    hx.append(String.format("%02X", bs[j]));
                }
                hx.append(']').append(' ');
                i += Character.charCount(c);
                shown++;
            }
            System.err.println("codepoints=" + cp);
            System.err.println("utf8-hex   =" + hx);

            String b64 = Base64.getEncoder().encodeToString(s.getBytes(StandardCharsets.UTF_8));
            System.err.println("base64(all)=" + b64);

            try {
                String path = Paths.get(System.getProperty("java.io.tmpdir"),
                        "ai_json_dump_"+System.currentTimeMillis()+".txt").toString();
                Files.writeString(Paths.get(path), s, StandardCharsets.UTF_8);
                System.err.println("saved -> " + path);
            } catch (Exception ignore) {}
            System.err.println("-----------------------------------------");
        } catch (Exception ignore) {}
    }

    /* ---------------- 디버그 스냅샷 DTO ---------------- */
    public static class AiDebugSnapshot {
        public String label;
        public String data;
        public AiDebugSnapshot() {}
        public AiDebugSnapshot(String label, String data) { this.label = label; this.data = data; }
    }

    /** 후보 문자열이 우리가 원하는 레시피 JSON "처럼" 보이는지 휴리스틱 체크 */
    private static boolean looksLikeRecipeJson(String cand) {
        if (cand == null) return false;

        String s = cand.trim();
        if (s.length() < 20) return false;
        if (!(s.startsWith("{") && s.endsWith("}"))) return false;

        String low = s.toLowerCase(Locale.ROOT);
        if (low.contains("response{") || low.contains("instructions=") || low.contains("responseoutputitem")
                || low.contains("createdat=") || low.contains("object_=") || low.contains("message=responseoutputmessage")) {
            return false;
        }

        boolean hasTitle = low.matches("(?s).*([\"\\s{,])title([\\s\"]*[:=]).*");
        boolean hasIngredients = low.matches("(?s).*([\"\\s{,])ingredients_list([\\s\"]*[:=]).*");
        boolean hasSteps = low.matches("(?s).*([\"\\s{,])steps([\\s\"]*[:=]).*");
        boolean hasKcal = low.matches("(?s).*([\"\\s{,])kcal([\\s\"]*[:=]).*");

        int score = 0;
        if (hasTitle) score += 2;
        if (hasIngredients) score += 2;
        if (hasSteps) score += 2;
        if (hasKcal) score += 1;

        if (s.length() < 60) score -= 1;

        return score >= 3;
    }

    /* ---------------- 고수준 파싱/매핑 ---------------- */
    private RecommendResponse safeParseAndBuildCore(String fixedJson, List<String> goals) {
        try {
            debugDump("BEFORE Jackson.readTree", fixedJson);

            JsonNode n;
            try {
                n = permissive.readTree(fixedJson);
            } catch (Exception first) {
                String fixedTwice = sanitizeToJson(fixedJson);
                debugDump("RETRY sanitizeToJson", fixedTwice);
                n = permissive.readTree(fixedTwice);
            }

            String title = asText(n, "title", "추천 레시피");
            List<String> ings = asStringList(n, "ingredients_list", List.of());
            long id = stableId(title, ings);

            return RecommendResponse.builder()
                    .id(id)
                    .title(title)
                    .summary(asText(n, "summary", "입력값 기반 추천"))
                    .kcal(asInt(n, "kcal", 420))
                    .carbs_g(asInt(n, "carbs_g", 35))
                    .protein_g(asInt(n, "protein_g", 30))
                    .fat_g(asInt(n, "fat_g", 12))
                    .sodium_mg(asInt(n, "sodium_mg", 550))
                    .cook_time_min(asInt(n, "cook_time_min", 15))
                    .ingredients_list(ings.isEmpty() ? List.of("필요 재료를 준비하세요.") : ings)
                    .steps(asStringList(n, "steps", List.of("손질","조리","마무리")))
                    .tips(asText(n, "tips", null))
                    .goals(goals != null ? goals : List.of())
                    .build();

        } catch (Exception e) {
            debugDump("PARSE_FAIL_LAST_INPUT", fixedJson);
            System.err.println("[AI] PARSE_FAIL -> " + e.getClass().getSimpleName() + " : " + e.getMessage());
            return fallback();
        }
    }
}