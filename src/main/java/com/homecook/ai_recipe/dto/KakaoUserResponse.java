package com.homecook.ai_recipe.dto;

public class KakaoUserResponse {
    public Long id;
    public KakaoAccount kakao_account;
    public static class KakaoAccount {
        public String email;
        public Boolean is_email_valid;
        public Boolean is_email_verified;
        public KakaoProfile profile;
    }
    public static class KakaoProfile {
        public String nickname;
        public String thumbnail_image_url;
        public String profile_image_url;
    }
}
