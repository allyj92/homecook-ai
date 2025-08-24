package com.homecook.ai_recipe.dto;

public class KakaoTokenResponse {
    public String access_token;
    public String token_type;
    public Integer expires_in;
    public String refresh_token;
    public Integer refresh_token_expires_in;
    public String scope;

    // (선택) 에러 디버깅용
    public String error;
    public String error_description;
}
