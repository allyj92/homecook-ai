package com.homecook.ai_recipe.util;

/** AI로부터 JSON 문자열을 받아오는 파이프라인 계약 */
public interface RecipeJsonPipeline {

    /** system + user 프롬프트로 호출 */
    String generate(String system, String user);

    /** system 없이 user만으로도 호출 가능하도록 기본 메서드 제공 */
    default String generate(String user) {
        return generate(null, user);
    }
}