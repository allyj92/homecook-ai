package com.homecook.ai_recipe.dto;

public class NaverProfileResponse {
    public String resultcode;
    public String message;
    public Profile response;
    public static class Profile {
        public String id;
        public String email;
        public String name;
        public String profile_image;
    }
}