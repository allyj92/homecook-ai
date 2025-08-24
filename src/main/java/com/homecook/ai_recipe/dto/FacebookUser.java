package com.homecook.ai_recipe.dto;

public class FacebookUser {
    public String id;
    public String name;
    public String email;
    public Picture picture;

    public static class Picture {
        public Data data;
        public static class Data {
            public String url;
            public Integer width;
            public Integer height;
            public Boolean is_silhouette;
        }
    }
}
